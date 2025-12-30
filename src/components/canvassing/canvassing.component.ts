import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal, NgZone } from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MapComponent } from '../map/map.component';
import { SessionService } from '../../services/session.service';
import { AuthService } from '../../services/auth.service';
import { VisitService } from '../../services/visit.service';
import { CanvassingSession } from '../../models/canvassing-session.model';
import { Point } from '../../models/session.model';
import { Visit } from '../../models/visit.model';

// This lets TypeScript know about the `google` object from the Maps API script
declare const google: any;

@Component({
  selector: 'app-canvassing',
  templateUrl: './canvassing.component.html',
  imports: [CommonModule, MapComponent, RouterLink, DecimalPipe, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanvassingComponent implements OnInit, OnDestroy {
  sessionService = inject(SessionService);
  private authService = inject(AuthService);
  private visitService = inject(VisitService);
  private router = inject(Router);
  private zone = inject(NgZone);
  private geocoder: any; // google.maps.Geocoder

  sessionVisits = signal<Visit[]>([]);
  currentPosition = signal<{lat: number, lng: number} | null>(null);
  elapsedTime = signal('00:00:00');

  private timerInterval: any;
  private geoWatchId: number | null = null;
  
  activeSession = computed<CanvassingSession | undefined>(() => {
    const session = this.sessionService.activeSession();
    if (session && 'doorHangersPlaced' in session) {
      return session as CanvassingSession;
    }
    return undefined;
  });
  activeSessionPolyline = computed<Point[]>(() => this.activeSession()?.polyline ?? []);
  
  ngOnInit(): void {
    const currentUser = this.authService.currentUser();
    if (currentUser) {
      if (!this.sessionService.hasActiveSession() || !('doorHangersPlaced' in this.sessionService.activeSession()!)) {
        this.sessionService.startCanvassingSession(currentUser.name);
      }
      const activeSession = this.activeSession();
      if (activeSession) {
        this.sessionVisits.set(this.visitService.getVisitsForSession(activeSession.sessionId));
      }
    } else {
      this.router.navigate(['/login']);
      return;
    }

    this.startGpsTracking();
    this.startTimer();
  }

  ngOnDestroy(): void {
    this.stopGpsTracking();
    clearInterval(this.timerInterval);
  }

  async addDoorHanger() {
    const pos = this.currentPosition();
    const session = this.activeSession();
    if (!pos || !session) {
      alert("Cannot add door hanger: no current position or active session.");
      return;
    }
    
    const address = await this.geocodePosition(pos);

    const newVisit: Visit = {
      latitude: pos.lat,
      longitude: pos.lng,
      salesStatus: 'Left Door Hanger',
      sessionId: session.sessionId,
      salesperson: session.salesperson,
      createdAt: new Date().toISOString(),
      synced: false,
      street: address?.street || `Visit at ${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`,
      city: address?.city,
      state: address?.state,
      zip: address?.zip,
      county: address?.county,
    };
    
    this.visitService.addVisit(newVisit);
    this.sessionService.incrementDoorHangers();
    this.sessionVisits.update(visits => [...visits, newVisit]);
  }

  endSession() {
    this.stopGpsTracking();
    this.sessionService.endSession();
    this.router.navigate(['/']);
  }
  
  navigateToNewQuote() {
    this.router.navigate(['/visits/new']);
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
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }

  private stopGpsTracking(): void {
    if (this.geoWatchId !== null) {
      navigator.geolocation.clearWatch(this.geoWatchId);
      this.geoWatchId = null;
    }
  }
  
  private startTimer() {
      clearInterval(this.timerInterval);
      this.timerInterval = setInterval(() => this.updateElapsedTime(), 1000);
  }

  private updateElapsedTime() {
    const session = this.activeSession();
    if (!session || !session.active) {
      clearInterval(this.timerInterval);
      return;
    };
    
    const start = new Date(session.startTime).getTime();
    const now = Date.now();
    const diff = Math.floor((now - start) / 1000);
    
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    
    this.elapsedTime.set(
      `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    );
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

  private geocodePosition(position: {lat: number, lng: number}): Promise<{ street: string, city: string, state: string, zip: string, county: string } | null> {
    return new Promise(async (resolve) => {
      await this.initializeGeocoder();
      if (!this.geocoder) {
        resolve(null);
        return;
      }
      this.geocoder.geocode({ location: position }, (results: any[], status: string) => {
        if (status === 'OK' && results?.length > 0) {
          const bestResult = results.find(r => 
            r.types.includes('street_address') || r.types.includes('premise')
          ) || results[0]; // Fallback to the first result
          
          resolve(this.parseAddressComponents(bestResult.address_components));
        } else {
          console.error('Geocoder failed due to: ' + status);
          resolve(null);
        }
      });
    });
  }
}