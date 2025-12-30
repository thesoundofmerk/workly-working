import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { SessionService } from '../../services/session.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  authService = inject(AuthService);
  sessionService = inject(SessionService);
  router = inject(Router);

  startD2DSession() {
    this.router.navigate(['/visits/new']);
  }
  
  startCanvassingSession() {
    this.router.navigate(['/canvassing/new']);
  }
  
  viewSessions() {
    this.router.navigate(['/sessions']);
  }

  viewCrm() {
    this.router.navigate(['/crm/contacts']);
  }

  logout() {
    this.authService.logout();
  }
}
