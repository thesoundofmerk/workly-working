import { Injectable, signal } from '@angular/core';

export interface User {
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly STORAGE_KEY = 'worklyUser';
  private _currentUser = signal<User | null>(null);

  constructor() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this._currentUser.set(JSON.parse(stored));
      }
    } catch {
      // ignore storage errors
    }
  }

  // Used all over your app (e.g. new-visit)
  currentUser(): User | null {
    return this._currentUser();
  }

  // Used by auth.guard.ts
  isAuthenticated(): boolean {
    return !!this._currentUser();
  }

  // Used by login.component.ts with 2 args and checked as boolean
  login(username: string, password: string): boolean {
    const trimmed = (username || '').trim();

    // Simple fake auth: require a non-empty username
    if (!trimmed) {
      return false;
    }

    const user: User = { name: trimmed };
    this._currentUser.set(user);

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    } catch {
      // ignore storage errors
    }

    return true;
  }

  logout(): void {
    this._currentUser.set(null);
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }
}
