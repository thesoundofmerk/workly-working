import { ChangeDetectionStrategy, Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MapComponent } from '../map/map.component';
import { SessionService } from '../../services/session.service';
import { VisitService } from '../../services/visit.service';
import { Session, CanvassingSession, Point } from '../../models';
import { Visit } from '../../models/visit.model';

@Component({
  selector: 'app-session-detail',
  templateUrl: './session-detail.component.html',
  imports: [CommonModule, RouterLink, MapComponent, DatePipe, DecimalPipe, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private sessionService = inject(SessionService);
  private visitService = inject(VisitService);

  session = signal<Session | CanvassingSession | undefined>(undefined);
  sessionVisits = signal<Visit[]>([]);

  sessionPolyline = computed<Point[]>(() => this.session()?.polyline ?? []);

  ngOnInit(): void {
    const sessionId = this.route.snapshot.paramMap.get('id');
    if (sessionId) {
      const foundSession = this.sessionService.getSessionById(sessionId);
      this.session.set(foundSession);
      if (foundSession) {
        this.sessionVisits.set(this.visitService.getVisitsForSession(foundSession.sessionId));
      }
    }
  }
  
  isVisitSession(session: Session | CanvassingSession | undefined): session is Session {
    return !!session && 'totalVisits' in session;
  }
}
