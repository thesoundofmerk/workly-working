import { ChangeDetectionStrategy, Component, OnInit, inject, signal, OnDestroy, computed, NgZone } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { debounceTime, filter } from 'rxjs/operators';

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
  currentPosition = signal<{lat: number, lng: number} | null>(null);

  activeSessionPolyline = computed<Point[]>(() => this.sessionService.activeSession()?.polyline ?? []);

  displaySession = computed<Session | undefined>(() => {
    const activeSession = this.sessionService.activeSession();
    if (!activeSession) {
      return undefined;
    }

    // If it's a real D2D session, return it as is.
    if ('totalVisits' in activeSession) {
      return activeSession as Session;
    }

    // If it's a canvassing session, adapt it for the sidebar component.
    if ('doorHangersPlaced' in activeSession) {
      const canvassSession = activeSession as CanvassingSession;
      // Create a Session-like object for display purposes
      return {
        ...canvassSession,
        salesOutcomes: { 'Left Door Hanger': canvassSession.doorHangersPlaced },
        totalVisits: canvassSession.doorHangersPlaced,
        opportunityCount: 0, // Canvassing sessions don't track this live
        opportunityTotal: 0,
        estimatedCommission: 0,
      };
    }

    return undefined;
  });

  private pricingSubscription: Subscription | null = null;
  private geoWatchId: number | null = null;

  ngOnInit(): void {
    const currentUser = this.authService.currentUser();
    if (currentUser) {
      if (!this.sessionService.hasActiveSession()) {
        this.sessionService.startVisitSession(currentUser.name);
      }
      const activeSession = this.sessionService.activeSession();
      if (activeSession) {
        if (activeSession.sessionId.startsWith('C-')) {
          this.isCanvassingQuote.set(true);
        }
        this.sessionVisits.set(this.visitService.getVisitsForSession(activeSession.sessionId));
      }
    } else {
      this.router.navigate(['/login']);
      return;
    }

    this.startGpsTracking();

    this.pricingSubscription = this.visitForm.valueChanges.pipe(
      debounceTime(300),
      filter(values => values.sqft != null || values.crackFeet != null || values.asphaltRepair != null)
    ).subscribe(values => {
      const details = this.pricingService.calculateAll(
        values.sqft ?? 0,
        values.crackFeet ?? 0,
        values.asphaltRepair ?? 0
      );
      this.pricingDetails.set(details);
    });

    // Initial calculation
    this.pricingDetails.set(this.pricingService.calculateAll(0,0,0));
  }

  ngOnDestroy(): void {
    this.pricingSubscription?.unsubscribe();
    this.stopGpsTracking();
  }

  openFormModal(): void {
    this.isFormModalVisible.set(true);
  }

  closeFormModal(): void {
    this.isFormModalVisible.set(false);
  }

  saveVisit() {
    const activeSession = this.sessionService.activeSession();
    if (!activeSession) {
      alert("No active session. Cannot save visit.");
      return;
    }

    const formValue = this.visitForm.value;
    const pricing = this.pricingDetails();

    const visitLat = formValue.latitude ?? this.currentPosition()?.lat;
    const visitLng = formValue.longitude ?? this.currentPosition()?.lng;

    let street = formValue.street;
    if (!street && visitLat != null && visitLng != null) {
      street = `Visit at ${visitLat.toFixed(4)}, ${visitLng.toFixed(4)}`;
    }

    const newVisit: Visit = {
      id: Date.now(),
      ...formValue,
      street: street,
      latitude: visitLat,
      longitude: visitLng,
      sqft: formValue.sqft ?? 0,
      crackFeet: formValue.crackFeet ?? 0,
      asphaltRepair: formValue.asphaltRepair ?? 0,
      ...pricing,
      sessionId: activeSession.sessionId,
      salesperson: activeSession.salesperson,
      createdAt: new Date().toISOString(),
      synced: false,
    };

    this.visitService.addVisit(newVisit);

    // Only update live session stats if it's a proper D2D session
    if ('totalVisits' in activeSession) {
      this.sessionService.updateStatsForNewVisit(newVisit);
    }

    const contactId = this.crmService.upsertContactFromVisit(newVisit);
    this.crmService.createDealForVisit(newVisit, contactId);

    this.sessionVisits.update(visits => [...visits, newVisit]);

    // Navigate back to canvassing if that's where we came from
    if (activeSession.sessionId.startsWith('C-')) {
      this.router.navigate(['/canvassing/new']);
    } else {
      // For standard D2D sessions, just reset the form for the next house
      this.visitForm.reset({
        salesStatus: 'Left Door Hanger'
      });
      this.pricingDetails.set(this.pricingService.calculateAll(0, 0, 0));
    }
    this.closeFormModal();
  }

  endSession() {
    this.stopGpsTracking();
    this.sessionService.endSession();
    this.router.navigate(['/']);
  }

  cancel() {
    this.router.navigate(['/canvassing/new']);
  }

  private startGpsTracking(): void {
    if (navigator.geolocation) {
      this.geoWatchId = navigator.geolocation.watchPosition(
        (position) => {
          const point = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          this.currentPosition.set(point);
          this.sessionService.addPointToActiveSessionPolyline({
            ...point,
            timestamp: new Date().toISOString()
          });
        },
        (error: GeolocationPositionError) => {
          console.error(`Error watching position: ${error.message} (code: ${error.code})`);
          if(this.geoWatchId) navigator.geolocation.clearWatch(this.geoWatchId);
          this.geoWatchId = null;
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      console.error("Geolocation is not supported by this browser.");
    }
  }

  private stopGpsTracking(): void {
    if (this.geoWatchId !== null) {
      navigator.geolocation.clearWatch(this.geoWatchId);
      this.geoWatchId = null;
    }
  }

  private async initializeGeocoder() {
    if (this.geocoder) return;
    if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
      this.geocoder = new google.maps.Geocoder();
    } else {
      await new Promise<void>(resolve => {
        const interval = setInterval(() => {
          if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
            clearInterval(interval);
            this.geocoder = new google.maps.Geocoder();
            resolve();
          }
        }, 100);
      });
    }
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

  async useCurrentLocation() {
    const pos = this.currentPosition();
    if (!pos) {
      alert('Could not determine current location.');
      return;
    }

    this.visitForm.patchValue({
      latitude: pos.lat,
      longitude: pos.lng
    });

    await this.initializeGeocoder();

    this.geocoder.geocode({ location: pos }, (results: any[], status: string) => {
      this.zone.run(() => {
        if (status === 'OK' && results?.length > 0) {
          // Find the most specific address, typically a street address or premise.
          const bestResult = results.find(r =>
            r.types.includes('street_address') ||
            r.types.includes('premise')
          ) || results[0]; // Fallback to the first result if no specific address found

          const address = this.parseAddressComponents(bestResult.address_components);
          this.visitForm.patchValue({
            street: address.street,
            city: address.city,
            state: address.state,
            zip: address.zip,
            county: address.county,
          });
        } else {
          console.error('Geocoder failed due to: ' + status);
          alert('Could not find an address for this location.');
        }
      });
    });
  }
}
