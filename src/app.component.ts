import { Component } from '@angular/core';
import { NgIf } from '@angular/common';
import { RouterOutlet } from '@angular/router';

import { AuthService } from './services/auth.service';
import { LoginComponent } from './components/login/login.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgIf, RouterOutlet, LoginComponent],
  templateUrl: './app.component.html'
})
export class AppComponent {
  constructor(public auth: AuthService) {}
}
