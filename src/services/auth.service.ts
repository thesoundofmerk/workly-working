import { Injectable, signal } from '@angular/core';

export interface AuthUser {
  name: string;
  email?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly STORAGE_KEY = 'worklyCurrentUser';

  // Internal user signal
  #user = signal<AuthUser | null>(this.loadInitialUser());

  constructor() {}

  private loadInitialUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as AuthUser;
    } catch {
      localStorage.removeItem(this.STORAGE_KEY);
      return null;
    }
  }

  /** Returns the current user (or null if not logged in) */
  currentUser(): AuthUser | null {
    return this.#user();
  }

  /** Simple boolean check for auth guard / template use */
  isAuthenticated(): boolean {
    return !!this.#user();
  }

  /**
   * Fake login: accepts any non-empty username+password.
   * Returns true on success, false otherwise.
   */
  login(username: string, password: string): boolean {
    if (!username || !password) {
      return false;
    }

    const user: AuthUser = {
      name: username,
      email: `${username}@example.com`
    };

    this.#user.set(user);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    return true;
  }

  /** Log out and clear storage */
  logout(): void {
    this.#user.set(null);
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
