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

    // If it's a rea
