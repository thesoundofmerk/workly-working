import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  username: string = '';
  password: string = '';
  error: string | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  login(): void {
    const ok = this.authService.login(this.username.trim(), this.password);

    if (!ok) {
      this.error = 'Username and password are required.';
      return;
    }

    this.error = null;
    this.router.navigateByUrl('/');
  }
}
