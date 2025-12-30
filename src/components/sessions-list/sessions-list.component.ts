import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SessionService } from '../../services/session.service';
import { AuthService } from '../../services/auth.service';
import { Session, CanvassingSession } from '../../models';

@Component({
  selector: 'app-sessions-list',
  templateUrl: './sessions-list.component.html',
  imports: [CommonModule, RouterLink, DatePipe, CurrencyPipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionsListComponent implements OnInit {
  private sessionService = inject(SessionService);
  private authService = inject(AuthService);
  private router = inject(Router);

  sessions = signal<(Session | CanvassingSession)[]>([]);

  ngOnInit(): void {
    const currentUser = this.authService.currentUser();
    if (currentUser) {
      this.sessions.set(this.sessionService.getAllSessionsForUser(currentUser.name));
    }
  }

  isVisitSession(session: Session | CanvassingSession): session is Session {
    return 'totalVisits' in session;
  }
  
  viewSession(session: Session | CanvassingSession): void {
    if (session.active) {
      if (this.isVisitSession(session)) {
        this.router.navigate(['/visits/new']);
      } else {
        this.router.navigate(['/canvassing/new']);
      }
    } else {
      this.router.navigate(['/sessions', session.sessionId]);
    }
  }
}