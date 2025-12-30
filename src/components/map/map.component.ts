import { ChangeDetectionStrategy, Component, ElementRef, AfterViewInit, OnDestroy, viewChild, input, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Visit } from '../../models/visit.model';
import { Point } from '../../models/session.model';
import { getStatusColor, POLYLINE_STYLE } from '../../utils/map-theme';
import { MapPlaceholderComponent } from '../map-placeholder/map-placeholder.component';

// This lets TypeScript know about the `google` object from the Maps API script
declare const google: any;

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  imports: [CommonModule, MapPlaceholderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block'
  }
})
export class MapComponent implements AfterViewInit, OnDestroy {
  markers = input<Visit[]>([]);
  polyline = input<Point[]>([]);
  currentPosition = input<{lat: number, lng: number} | null>(null);

  mapContainer = viewChild.required<ElementRef>('mapContainer');
  
  mapInitialized = signal(false);

  private map: any; // google.maps.Map;
  private drawnMarkers: any[] = []; // google.maps.marker.AdvancedMarkerElement[]
  private drawnPolyline: any; // google.maps.Polyline;
  private userMarker: any; // google.maps.marker.AdvancedMarkerElement;

  constructor() {
    effect(() => {
      this.updateMarkers(this.markers());
    });
    effect(() => {
      this.updatePolyline(this.polyline());
    });
    effect(() => {
      this.updateUserPosition(this.currentPosition());
    });
     effect(() => {
      if(this.mapInitialized()) {
        this.fitBounds();
      }
    });
  }

  ngAfterViewInit(): void {
    this.waitForGoogleMaps()
      .then(() => this.initMap())
      .catch(error => {
        console.error("Failed to load Google Maps:", error);
        this.mapInitialized.set(false);
      });
  }

  ngOnDestroy(): void {
    this.map = null;
    this.drawnMarkers.forEach(marker => marker.map = null);
    this.drawnMarkers = [];
  }

  private async waitForGoogleMaps(): Promise<void> {
    if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
      return;
    }
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
          clearInterval(interval);
          resolve();
        } else if (attempts > 50) { // 5-second timeout
          clearInterval(interval);
          reject('Google Maps API did not load in time.');
        }
      }, 100);
    });
  }

  private initMap(): void {
    try {
      const mapOptions = {
        center: { lat: 40.730610, lng: -73.935242 },
        zoom: 14,
        disableDefaultUI: true,
        // A Map ID is required to use Advanced Markers.
        // Custom map styles must be associated with this ID in the Google Cloud Console.
        mapId: 'WORKLY_DARK_MAP',
      };
      this.map = new google.maps.Map(this.mapContainer().nativeElement, mapOptions);
      this.drawnPolyline = new google.maps.Polyline({ ...POLYLINE_STYLE, map: this.map });

      // Defensive check to ensure map and polyline objects are fully functional.
      // This prevents the `setAt` runtime error if the API partially fails to initialize
      // due to configuration issues like ApiNotActivatedMapError.
      if (!this.map.getCenter || !this.drawnPolyline.setPath) {
        throw new Error('Google Maps objects did not initialize correctly.');
      }

      this.mapInitialized.set(true);
    } catch (e) {
      console.error("Error initializing Google Map. This is often due to an invalid API key or not-activated APIs.", e);
      this.mapInitialized.set(false);
    }
  }

  private async updateMarkers(visits: Visit[]): Promise<void> {
    if (!this.mapInitialized()) return;

    const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");

    this.drawnMarkers.forEach(marker => marker.map = null);
    this.drawnMarkers = [];

    visits.forEach(visit => {
      if (visit.latitude != null && visit.longitude != null) {
        const pin = new PinElement({
          background: getStatusColor(visit.salesStatus),
          borderColor: '#1e293b',
          glyphColor: '#ffffff'
        });
        const marker = new AdvancedMarkerElement({
          position: { lat: visit.latitude, lng: visit.longitude },
          map: this.map,
          content: pin.element,
          title: `${visit.salesStatus}: ${visit.street}`,
        });
        this.drawnMarkers.push(marker);
      }
    });
  }

  private updatePolyline(points: Point[]): void {
    if (!this.mapInitialized() || !this.drawnPolyline) return;
    this.drawnPolyline.setPath(points);
  }
  
  private fitBounds(): void {
    if (!this.mapInitialized() || (this.polyline().length === 0 && this.markers().length === 0)) {
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    this.polyline().forEach(p => bounds.extend(p));
    this.drawnMarkers.forEach(m => {
      if (m.position) {
        bounds.extend(m.position);
      }
    });

    if (!bounds.isEmpty()) {
      this.map.fitBounds(bounds, 100);
    }
  }

  private async updateUserPosition(pos: {lat: number, lng: number} | null): Promise<void> {
    if (!this.mapInitialized() || !pos) return;

    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

    const userMarkerDiv = document.createElement('div');
    userMarkerDiv.style.width = '16px';
    userMarkerDiv.style.height = '16px';
    userMarkerDiv.style.backgroundColor = '#4285F4';
    userMarkerDiv.style.border = '2px solid white';
    userMarkerDiv.style.borderRadius = '50%';
    userMarkerDiv.style.boxShadow = '0 0 5px rgba(0,0,0,0.5)';

    if (!this.userMarker) {
      this.userMarker = new AdvancedMarkerElement({
        position: pos,
        map: this.map,
        content: userMarkerDiv,
        title: 'Your Location'
      });
      this.map.setCenter(pos);
    } else {
      this.userMarker.position = pos;
    }
  }
}