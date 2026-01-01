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
      localStorage.setItem('worklyVisitSessions', JSON.stringify(this.#visitSessions()));
    });
    effect(() => {
      localStorage.setItem('worklyCanvassingSessions', JSON.stringify(this.#canvassingSessions()));
    });
  }

  startVisitSession(salesperson: string): Session {
    const existingActiveSession = this.activeSession();
    if (existingActiveSession && 'totalVisits' in existingActiveSession) {
      return existingActiveSession;
    }

    const now = new Date().toISOString();
    const sessionId = `V-${Date.now()}`;
    
    const newSession: Session = {
      sessionId: sessionId,
      salesperson: salesperson,
      startTime: now,
      endTime: null,
      duration: null,
      milesWalked: 0,
      zipcodes: [],
      salesOutcomes: {},
      polyline: [],
      createdAt: now,
      synced: false,
      active: true,
      totalVisits: 0,
      opportunityCount: 0,
      opportunityTotal: 0,
      estimatedCommission: 0,
    };

    this.#visitSessions.update(sessions => [...sessions, newSession]);
    this.#activeSessionId.set(sessionId);
    localStorage.setItem(this.ACTIVE_SESSION_ID_KEY, sessionId);
    
    return newSession;
  }
  
  startCanvassingSession(salesperson: string): CanvassingSession {
    const existingActiveSession = this.activeSession();
    if (existingActiveSession && 'doorHangersPlaced' in existingActiveSession) {
      return existingActiveSession;
    }

    const now = new Date().toISOString();
    const sessionId = `C-${Date.now()}`;
    
    const newSession: CanvassingSession = {
      sessionId: sessionId,
      salesperson: salesperson,
      startTime: now,
      endTime: null,
      duration: null,
      milesWalked: 0,
      zipcodes: [],
      polyline: [],
      createdAt: now,
      synced: false,
      active: true,
      doorHangersPlaced: 0,
    };

    this.#canvassingSessions.update(sessions => [...sessions, newSession]);
    this.#activeSessionId.set(sessionId);
    localStorage.setItem(this.ACTIVE_SESSION_ID_KEY, sessionId);
    
    return newSession;
  }

  convertActiveCanvassingToVisitSession(): Session | null {
    const activeSessionId = this.#activeSessionId();
    if (!activeSessionId || !activeSessionId.startsWith('C-')) {
        return null;
    }

    const canvassingSession = this.#canvassingSessions().find(s => s.sessionId === activeSessionId);
    if (!canvassingSession) return null;

    // 1. Remove from canvassing sessions
    this.#canvassingSessions.update(sessions => 
        sessions.filter(s => s.sessionId !== activeSessionId)
    );

    // 2. Create a new visit session, preserving canvassing data and adding visit-specific fields
    const newVisitSession: Session = {
        ...canvassingSession,
        salesOutcomes: { 'Left Door Hanger': canvassingSession.doorHangersPlaced },
        totalVisits: canvassingSession.doorHangersPlaced,
        opportunityCount: 0,
        opportunityTotal: 0,
        estimatedCommission: 0,
    };
    
    // 3. Add to visit sessions
    this.#visitSessions.update(sessions => [...sessions, newVisitSession]);
    
    return newVisitSession;
  }

  updateStatsForNewVisit(visit: Visit) {
    const sessionId = this.#activeSessionId();
    if (!sessionId) return;

    this.#visitSessions.update(sessions => {
      return sessions.map(s => {
        if (s.sessionId === sessionId) {
          const newTotalVisits = s.totalVisits + 1;
          const newSalesOutcomes = { ...s.salesOutcomes };
          const status = visit.salesStatus || 'Unknown';
          newSalesOutcomes[status] = (newSalesOutcomes[status] || 0) + 1;

          let newOppCount = s.opportunityCount;
          let newOppTotal = s.opportunityTotal;
          if(visit.salesStatus?.toLowerCase() === 'opportunity') {
            newOppCount++;
            newOppTotal += visit.totalQuoted || 0;
          }

          const newCommission = (newOppTotal * 0.45 * 0.15);

          return { 
            ...s,
            totalVisits: newTotalVisits,
            salesOutcomes: newSalesOutcomes,
            opportunityCount: newOppCount,
            opportunityTotal: newOppTotal,
            estimatedCommission: newCommission,
          };
        }
        return s;
      });
    });
  }
  
  incrementDoorHangers() {
    const sessionId = this.#activeSessionId();
    if (!sessionId || !sessionId.startsWith('C-')) return;
    
    this.#canvassingSessions.update(sessions => {
      return sessions.map(s => {
        if (s.sessionId === sessionId) {
          return { ...s, doorHangersPlaced: s.doorHangersPlaced + 1 };
        }
        return s;
      });
    });
  }

  addPointToActiveSessionPolyline(point: Point) {
    const sessionId = this.#activeSessionId();
    if (!sessionId) return;

    const updateLogic = (s: BaseSession) => {
      const newPolyline = [...s.polyline, point];
      let newMiles = s.milesWalked;
      if (newPolyline.length > 1) {
        const lastPoint = newPolyline[newPolyline.length - 2];
        newMiles += haversine(
          { lat: lastPoint.lat, lng: lastPoint.lng },
          { lat: point.lat, lng: point.lng }
        );
      }
      return {
        ...s,
        polyline: newPolyline,
        milesWalked: newMiles,
      };
    }

    if (this.#visitSessions().some(s => s.sessionId === sessionId)) {
      this.#visitSessions.update(sessions => sessions.map(s => s.sessionId === sessionId ? updateLogic(s) as Session : s));
    } else if (this.#canvassingSessions().some(s => s.sessionId === sessionId)) {
      this.#canvassingSessions.update(sessions => sessions.map(s => s.sessionId === sessionId ? updateLogic(s) as CanvassingSession : s));
    }
  }

  endSession() {
    const sessionId = this.#activeSessionId();
    if (!sessionId) return;
    
    const endLogic = (s: BaseSession) => {
        const startTime = new Date(s.startTime).getTime();
        const endTime = Date.now();
        const durationMs = endTime - startTime;
        const hours = Math.floor(durationMs / 3600000);
        const minutes = Math.floor((durationMs % 3600000) / 60000);
        const seconds = Math.floor(((durationMs % 3600000) % 60000) / 1000);
        
        return {
          ...s,
          active: false,
          endTime: new Date(endTime).toISOString(),
          duration: `${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`
        };
    };

    if (this.#visitSessions().some(s => s.sessionId === sessionId)) {
       this.#visitSessions.update(sessions => sessions.map(s => s.sessionId === sessionId ? endLogic(s) as Session : s));
    } else if (this.#canvassingSessions().some(s => s.sessionId === sessionId)) {
      this.#canvassingSessions.update(sessions => sessions.map(s => s.sessionId === sessionId ? endLogic(s) as CanvassingSession : s));
    }
    
    this.#activeSessionId.set(null);
    localStorage.removeItem(this.ACTIVE_SESSION_ID_KEY);
  }

  hasActiveSession(): boolean {
    return !!this.#activeSessionId();
  }
  
  getAllSessionsForUser(salesperson: string): (Session | CanvassingSession)[] {
    const visits = this.#visitSessions().filter(s => s.salesperson === salesperson);
    const canvassing = this.#canvassingSessions().filter(s => s.salesperson === salesperson);
    return [...visits, ...canvassing].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }
  
  getSessionById(sessionId: string): Session | CanvassingSession | undefined {
    let session = this.#visitSessions().find(s => s.sessionId === sessionId);
    if (session) return session;
    return this.#canvassingSessions().find(s => s.sessionId === sessionId);
  }
}
