import { Injectable, signal, effect } from '@angular/core';
import { Visit } from '../models/visit.model';

@Injectable({
  providedIn: 'root'
})
export class VisitService {
  #visits = signal<Visit[]>([]);

  constructor() {
    const storedVisits = localStorage.getItem('worklyVisits');
    if (storedVisits) {
      this.#visits.set(JSON.parse(storedVisits));
    }

    effect(() => {
      localStorage.setItem('worklyVisits', JSON.stringify(this.#visits()));
    });
  }

  getVisitsForSession(sessionId: string): Visit[] {
    return this.#visits().filter(v => v.sessionId === sessionId);
  }

  addVisit(visit: Visit) {
    this.#visits.update(visits => [...visits, visit]);
  }
}
