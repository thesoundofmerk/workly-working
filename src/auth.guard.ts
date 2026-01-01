import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Allow access to /login always
  if (state.url === '/login') {
    return true;
  }

  if (auth.isAuthenticated()) {
    return true;
  }

  // Not logged in → send to login
  router.navigate(['/login']);
  return false;
};
