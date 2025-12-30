import { ChangeDetectionStrategy, Component, output, input, signal, effect, OnDestroy } from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { Session } from '../../models/session.model';

@Component({
  selector: 'app-session-sidebar',
  templateUrl: './session-sidebar.component.html',
  imports: [CommonModule, CurrencyPipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionSidebarComponent implements OnDestroy {
  session = input<Session | undefined>();
  endSession = output();

  elapsedTime = signal('00:00:00');
  private timerInterval: any;

  constructor() {
    effect(() => {
      const currentSession = this.session();
      clearInterval(this.timerInterval);

      if (currentSession && currentSession.active) {
        this.updateElapsedTime();
        this.timerInterval = setInterval(() => this.updateElapsedTime(), 1000);
      } else if (currentSession && !currentSession.active) {
        this.elapsedTime.set(currentSession.duration || '00:00:00');
      } else {
        this.elapsedTime.set('00:00:00');
      }
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.timerInterval);
  }
  
  updateElapsedTime() {
    const currentSession = this.session();
    if (!currentSession || !currentSession.active) return;
    
    const start = new Date(currentSession.startTime).getTime();
    const now = Date.now();
    const diff = Math.floor((now - start) / 1000);
    
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    
    this.elapsedTime.set(
      `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    );
  }

  onEndSessionClick() {
    this.endSession.emit();
  }
}
