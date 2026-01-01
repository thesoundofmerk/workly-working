import { ChangeDetectionStrategy, Component, OnInit, inject, signal, OnDestroy, computed, NgZone } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { ALL_STATUSES } from '../../utils/constants';
import { SessionSidebarComponent } from '../session-sidebar/session-sidebar.component';
import { MapComponent } from '../map/map.component';
import { SessionService } from '../../services/session.service';
import { PricingService } from '../../services/pricing.service';
import { AuthService } from '../../services/auth.service';
import { VisitService } from '../../services/visit.service';
import { CrmService } from '../../services/crm.service';
import { Visit } from '../../models/visit.model';
import { Point, Session } from '../../models/session.model';
import { CanvassingSession } from '../../models/canvassing-session.model';

// This lets TypeScript know about the `google` object from the Maps API script
declare const google: any;

interface PricingDetails {
  drivewayUndiscounted: number;
  drivewayQuoted: number;
  crackUndisc: number;
  crackQuoted: number;
  asphalt: number;
  totalUndisc: number;
  totalQuoted: number;
  totalDiscount: number;
}

@Component({
  selector: 'app-new-visit',
  templateUrl: './new-visit.component.html',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SessionSidebarComponent,
    MapComponent,
    CurrencyPipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewVisitComponent implements OnInit, OnDestroy {
  sessionService = inject(SessionService);
  private pricingService = inject(PricingService);
  private authService = inject(AuthService);
  private visitService = inject(VisitService);
  private crmService = inject(CrmService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private zone = inject(NgZone);

  private geocoder: any; // google.maps.Geocoder
  isFormModalVisible = signal(false);
  isCanvassingQuote = signal(false);

  statuses = ALL_STATUSES;
  visitForm = this.fb.group({
    firstName: [''],
    lastName: [''],
    email: ['', [Validators.email]],
    phone: [''],
    street: [''],
    city: [''],
    state: [''],
    zip: [''],
    county: [''],
    latitude: [null as number | null],
    longitude: [null as number | null],
    sqft: [null as number | null],
    crackFeet: [null as number | null],
    asphaltRepair: [null as number | null],
    salesStatus: ['Left Door Hanger'],
    notes: [''],
  });

  pricingDetails = signal<PricingDetails | null>(null);
  sessionVisits = signal<Visit[]>([]);
  currentPosition = signal<{ lat: number; lng: number } | null>(null);

  activeSessionPolyline = computed<Point[]>(() => this.sessionService.activeSession()?.polyline ?? []);

  displaySession = computed<Session | undefined>(() => {
    const activeSession = this.sessionService.activeSession();
    if (!activeSession) {
      return undefined;
    }

    if ('totalVisits' in activeSession) {
      return activeSession;
    }

    return undefined;
  });

  private pricingSubscription = new Subscription();
  private geoWatchId: number | null = null;

  ngOnInit(): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    const activeSession = this.sessionService.activeSession();
    if (activeSession && 'doorHangersPlaced' in activeSession) {
      this.isCanvassingQuote.set(true);
    }

    if (!activeSession) {
      this.sessionService.startVisitSession(currentUser.name);
    }

    const session = this.sessionService.activeSession();
    if (session) {
      this.sessionVisits.set(this.visitService.getVisitsForSession(session.sessionId));
    }

    this.pricingSubscription = this.visitForm.valueChanges
      .pipe(debounceTime(300))
      .subscribe(value => {
        const pricing = this.pricingService.calculateAll(
          value.sqft ?? 0,
          value.crackFeet ?? 0,
          value.asphaltRepair ?? 0
        );
        this.pricingDetails.set(pricing);
      });

    this.startGpsTracking();
  }

  ngOnDestroy(): void {
    this.pricingSubscription.unsubscribe();
    this.stopGpsTracking();
  }

  openFormModal(): void {
    this.isFormModalVisible.set(true);
  }

  closeFormModal(): void {
    this.isFormModalVisible.set(false);
  }

  cancel(): void {
    if (this.isCanvassingQuote()) {
      this.router.navigate(['/canvassing/new']);
    } else {
      this.router.navigate(['/']);
    }
  }

  endSession(): void {
    this.stopGpsTracking();
    this.sessionService.endSession();
    this.router.navigate(['/']);
  }

  async useCurrentLocation(): Promise<void> {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(async position => {
      const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
      this.currentPosition.set(coords);
      this.visitForm.patchValue({
        latitude: coords.lat,
        longitude: coords.lng,
      });

      await this.initializeGeocoder();
      if (!this.geocoder) {
        alert('Google Maps API is not available. Unable to look up address.');
        return;
      }

      const address = await this.geocodePosition(coords);
      if (address) {
        this.visitForm.patchValue(address);
      }
    });
  }

  saveVisit(): void {
    if (this.visitForm.invalid) {
      this.visitForm.markAllAsTouched();
      return;
    }

    let session = this.sessionService.activeSession();
    if (session && 'doorHangersPlaced' in session) {
      session = this.sessionService.convertActiveCanvassingToVisitSession();
    }

    if (!session || !('totalVisits' in session)) {
      return;
    }

    const formValue = this.visitForm.getRawValue();
    const pricing = this.pricingDetails() ?? this.pricingService.calculateAll(
      formValue.sqft ?? 0,
      formValue.crackFeet ?? 0,
      formValue.asphaltRepair ?? 0
    );

    const visit: Visit = {
      ...formValue,
      sessionId: session.sessionId,
      salesperson: session.salesperson,
      drivewayUndiscounted: pricing.drivewayUndiscounted,
      drivewayQuoted: pricing.drivewayQuoted,
      crackUndisc: pricing.crackUndisc,
      crackQuoted: pricing.crackQuoted,
      asphalt: pricing.asphalt,
      totalUndisc: pricing.totalUndisc,
      totalQuoted: pricing.totalQuoted,
      totalDiscount: pricing.totalDiscount,
      createdAt: new Date().toISOString(),
      synced: false,
    };

    this.visitService.addVisit(visit);
    this.sessionService.updateStatsForNewVisit(visit);
    this.sessionVisits.update(visits => [...visits, visit]);

    const contactId = this.crmService.upsertContactFromVisit(visit);
    this.crmService.createDealForVisit(visit, contactId);

    this.visitForm.reset({
      salesStatus: 'Left Door Hanger',
    });
    this.pricingDetails.set(null);

    if (this.isCanvassingQuote()) {
      this.router.navigate(['/canvassing/new']);
    }
  }

  private startGpsTracking(): void {
    if (!navigator.geolocation) {
      return;
    }

    this.geoWatchId = navigator.geolocation.watchPosition(
      position => {
        const point = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        this.currentPosition.set(point);
        this.sessionService.addPointToActiveSessionPolyline({
          ...point,
          timestamp: new Date().toISOString(),
        });
      },
      (error: GeolocationPositionError) => {
        console.error(`Error watching position: ${error.message} (code: ${error.code})`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  private stopGpsTracking(): void {
    if (this.geoWatchId !== null) {
      navigator.geolocation.clearWatch(this.geoWatchId);
      this.geoWatchId = null;
    }
  }

  private async initializeGeocoder(): Promise<void> {
    if (this.geocoder) return;
    if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
      this.geocoder = new google.maps.Geocoder();
      return;
    }

    await new Promise<void>(resolve => {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts += 1;
        if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
          clearInterval(interval);
          this.geocoder = new google.maps.Geocoder();
          resolve();
        } else if (attempts >= 50) {
          clearInterval(interval);
          console.error('Google Maps API did not load in time.');
          resolve();
        }
      }, 100);
    });
  }

  private parseAddressComponents(components: any[]): { street: string; city: string; state: string; zip: string; county: string } {
    const addr = { street: '', city: '', state: '', zip: '', county: '' };
    let streetNumber = '';
    let route = '';

    for (const comp of components || []) {
      const types = comp.types || [];
      if (types.includes('street_number')) streetNumber = comp.long_name;
      if (types.includes('route')) route = comp.long_name;
      if (types.includes('locality')) addr.city = comp.long_name;
      if (types.includes('administrative_area_level_1')) addr.state = comp.short_name;
      if (types.includes('postal_code')) addr.zip = comp.long_name;
      if (types.includes('administrative_area_level_2')) addr.county = comp.long_name.replace(/ County$/i, '');
    }

    addr.street = `${streetNumber} ${route}`.trim();
    return addr;
  }

  private geocodePosition(position: { lat: number; lng: number }): Promise<{ street: string; city: string; state: string; zip: string; county: string } | null> {
    return new Promise(resolve => {
      if (!this.geocoder) {
        resolve(null);
        return;
      }

      this.geocoder.geocode({ location: position }, (results: any[], status: string) => {
        if (status === 'OK' && results?.length > 0) {
          const bestResult = results.find(r =>
            r.types.includes('street_address') || r.types.includes('premise')
          ) || results[0];

          resolve(this.parseAddressComponents(bestResult.address_components));
        } else {
          console.error('Geocoder failed due to: ' + status);
          resolve(null);
        }
      });
    });
  }
}
