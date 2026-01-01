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

    const visitSession = this.#visitSessions().find(session => session.sessionId === id);
    if (visitSession) {
      return visitSession;
    }

    return this.#canvassingSessions().find(session => session.sessionId === id);
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
      localStorage.setItem('worklyVisitSessions', JSON.stringify(this.#visitSessions()));
    });

    effect(() => {
      localStorage.setItem('worklyCanvassingSessions', JSON.stringify(this.#canvassingSessions()));
    });

    effect(() => {
      const activeSessionId = this.#activeSessionId();
      if (activeSessionId) {
        localStorage.setItem(this.ACTIVE_SESSION_ID_KEY, activeSessionId);
      } else {
        localStorage.removeItem(this.ACTIVE_SESSION_ID_KEY);
      }
    });
  }

  startVisitSession(salesperson: string): Session {
    const now = new Date().toISOString();
    const session: Session = {
      sessionId: `S-${Date.now()}`,
      salesperson,
      startTime: now,
      endTime: null,
      duration: null,
      milesWalked: 0,
      polyline: [],
      createdAt: now,
      synced: false,
      active: true,
      zipcodes: [],
      salesOutcomes: {},
      totalVisits: 0,
      opportunityCount: 0,
      opportunityTotal: 0,
      estimatedCommission: 0,
    };

    this.#visitSessions.update(sessions => [...sessions, session]);
    this.#activeSessionId.set(session.sessionId);
    return session;
  }

  startCanvassingSession(salesperson: string): CanvassingSession {
    const now = new Date().toISOString();
    const session: CanvassingSession = {
      sessionId: `C-${Date.now()}`,
      salesperson,
      startTime: now,
      endTime: null,
      duration: null,
      milesWalked: 0,
      polyline: [],
      createdAt: now,
      synced: false,
      active: true,
      zipcodes: [],
      doorHangersPlaced: 0,
    };

    this.#canvassingSessions.update(sessions => [...sessions, session]);
    this.#activeSessionId.set(session.sessionId);
    return session;
  }

  convertActiveCanvassingToVisitSession(): Session | null {
    const session = this.activeSession();
    if (!session || !('doorHangersPlaced' in session)) {
      return null;
    }

    const visitSession: Session = {
      sessionId: session.sessionId,
      salesperson: session.salesperson,
      startTime: session.startTime,
      endTime: null,
      duration: null,
      milesWalked: session.milesWalked,
      polyline: [...session.polyline],
      createdAt: session.createdAt,
      synced: session.synced,
      active: true,
      zipcodes: [...session.zipcodes],
      salesOutcomes: {},
      totalVisits: 0,
      opportunityCount: 0,
      opportunityTotal: 0,
      estimatedCommission: 0,
    };

    this.#canvassingSessions.update(sessions => sessions.filter(item => item.sessionId !== session.sessionId));
    this.#visitSessions.update(sessions => [...sessions, visitSession]);
    this.#activeSessionId.set(visitSession.sessionId);

    return visitSession;
  }

  updateStatsForNewVisit(visit: Visit): void {
    const session = this.activeSession();
    if (!session || !('totalVisits' in session)) {
      return;
    }

    const statusKey = visit.salesStatus || 'Unknown';
    const isOpportunity = statusKey.toLowerCase() === 'opportunity';
    const opportunityAmount = visit.totalQuoted ?? 0;
    const commissionRate = 0.1;

    this.updateVisitSession(session.sessionId, current => ({
      ...current,
      totalVisits: current.totalVisits + 1,
      salesOutcomes: {
        ...current.salesOutcomes,
        [statusKey]: (current.salesOutcomes[statusKey] || 0) + 1,
      },
      opportunityCount: current.opportunityCount + (isOpportunity ? 1 : 0),
      opportunityTotal: current.opportunityTotal + (isOpportunity ? opportunityAmount : 0),
      estimatedCommission: current.estimatedCommission + (isOpportunity ? opportunityAmount * commissionRate : 0),
    }));
  }

  incrementDoorHangers(): void {
    const session = this.activeSession();
    if (!session || !('doorHangersPlaced' in session)) {
      return;
    }

    this.#canvassingSessions.update(sessions =>
      sessions.map(item =>
        item.sessionId === session.sessionId
          ? { ...item, doorHangersPlaced: item.doorHangersPlaced + 1 }
          : item
      )
    );
  }

  addPointToActiveSessionPolyline(point: Point): void {
    const session = this.activeSession();
    if (!session || !session.active) {
      return;
    }

    const previous = session.polyline[session.polyline.length - 1];
    const distance = previous ? haversine(previous, point) : 0;

    if ('totalVisits' in session) {
      this.updateVisitSession(session.sessionId, current => ({
        ...current,
        polyline: [...current.polyline, point],
        milesWalked: current.milesWalked + distance,
      }));
    } else {
      this.#canvassingSessions.update(sessions =>
        sessions.map(item =>
          item.sessionId === session.sessionId
            ? { ...item, polyline: [...item.polyline, point], milesWalked: item.milesWalked + distance }
            : item
        )
      );
    }
  }

  endSession(): void {
    const session = this.activeSession();
    if (!session) {
      return;
    }

    const endTime = new Date().toISOString();
    const duration = this.calculateDuration(session.startTime, endTime);

    if ('totalVisits' in session) {
      this.updateVisitSession(session.sessionId, current => ({
        ...current,
        endTime,
        duration,
        active: false,
      }));
    } else {
      this.#canvassingSessions.update(sessions =>
        sessions.map(item =>
          item.sessionId === session.sessionId
            ? { ...item, endTime, duration, active: false }
            : item
        )
      );
    }

    this.#activeSessionId.set(null);
  }

  hasActiveSession(): boolean {
    const session = this.activeSession();
    return !!session && session.active;
  }

  getAllSessionsForUser(salesperson: string): (Session | CanvassingSession)[] {
    const visitSessions = this.#visitSessions().filter(session => session.salesperson === salesperson);
    const canvassingSessions = this.#canvassingSessions().filter(session => session.salesperson === salesperson);
    return [...visitSessions, ...canvassingSessions].sort((a, b) =>
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  getSessionById(sessionId: string): Session | CanvassingSession | undefined {
    return (
      this.#visitSessions().find(session => session.sessionId === sessionId) ||
      this.#canvassingSessions().find(session => session.sessionId === sessionId)
    );
  }

  private updateVisitSession(sessionId: string, updater: (session: Session) => Session): void {
    this.#visitSessions.update(sessions =>
      sessions.map(session => (session.sessionId === sessionId ? updater(session) : session))
    );
  }

  private calculateDuration(start: string, end: string): string {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const diffSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));
    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;

    const parts = [hours, minutes, seconds].map(value => value.toString().padStart(2, '0'));
    return parts.join(':');
  }
}
