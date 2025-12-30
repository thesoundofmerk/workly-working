import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private authService = inject(AuthService);
  username = signal('');
  password = signal('');
  error = signal<string | null>(null);

  login() {
    this.error.set(null);
    const success = this.authService.login(this.username(), this.password());
    if (!success) {
      this.error.set('Invalid username or password.');
    }
  }
}
