import { Injectable, signal, computed, effect } from '@angular/core';
import { Session, Point, BaseSession } from '../models/session.model';
import { CanvassingSession } from '../models/canvassing-session.model';
import { Visit } from '../models/visit.model';
import haversine from '../utils/haversine';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private readonly ACTIVE_SESSION_ID_KEY = 'activeSessionId';
  
  #visitSessions = signal<Session[]>([]); 
  #canvassingSessions = signal<CanvassingSession[]>([]);
  #activeSessionId = signal<string | null>(localStorage.getItem(this.ACTIVE_SESSION_ID_KEY));

  activeSession = computed<Session | CanvassingSession | undefined>(() => {
    const id = this.#activeSessionId();
    if (!id) return undefined;
    
    // A session ID can start with 'C-' but be a full 'Visit' session after conversion.
    // So we must check both lists, starting with the more specific type.
    let session = this.#visitSessions().find(s => s.sessionId === id);
    if (session) {
      return session;
    }
    
    return this.#canvassingSessions().find(s => s.sessionId === id);
  });
  
  constructor() {
    const storedVisitSessions = localStorage.getItem('worklyVisitSessions');
    if (storedVisitSessions) {
      try {
        this.#visitSessions.set(JSON.parse(storedVisitSessions));
      } catch (error) {
        console.warn('Unable to parse worklyVisitSessions from localStorage.', error);
        localStorage.removeItem('worklyVisitSessions');
      }
    }

    const storedCanvassingSessions = localStorage.getItem('worklyCanvassingSessions');
    if (storedCanvassingSessions) {
      try {
        this.#canvassingSessions.set(JSON.parse(storedCanvassingSessions));
      } catch (error) {
        console.warn('Unable to parse worklyCanvassingSessions from localStorage.', error);
        localStorage.removeItem('worklyCanvassingSessions');
      }
    }

    effect(() => {
      localStorage.setItem('work
