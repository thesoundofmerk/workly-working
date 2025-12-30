import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '../models/user.model';

interface MockUser extends User {
  password_plaintext: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private router = inject(Router);
  
  // Mock user database
  private MOCK_USERS: MockUser[] = [
    { id: 1, name: 'John Doe', username: 'johndoe', role: 'Salesperson', password_plaintext: 'password' },
    { id: 2, name: 'Jane Smith', username: 'janesmith', role: 'Admin', password_plaintext: 'password' }
  ];
  
  #currentUser = signal<User | null>(null);

  constructor() {
    const userJson = localStorage.getItem('currentUser');
    if (userJson) {
      this.#currentUser.set(JSON.parse(userJson));
    }
  }

  currentUser = computed(() => this.#currentUser());
  isAuthenticated = computed(() => !!this.#currentUser());

  login(username: string, password: string):boolean {
    // In a real app, this would be an API call.
    // Plaintext password check as per spec.
    const user = this.MOCK_USERS.find(u => u.username === username && u.password_plaintext === password);
    if (user) {
      const token = `mock-token-for-${user.username}`;
      localStorage.setItem('authToken', token);
      
      const userToStore: User = {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role
      };

      localStorage.setItem('currentUser', JSON.stringify(userToStore));
      this.#currentUser.set(userToStore);
      this.router.navigate(['/']);
      return true;
    }
    return false;
  }

  logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    this.#currentUser.set(null);
    this.router.navigate(['/login']);
  }
}
