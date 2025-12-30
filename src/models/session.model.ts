export interface Point {
  lat: number;
  lng: number;
  timestamp: string;
}

export interface SalesOutcomes {
  [key: string]: number;
}

export interface BaseSession {
  id?: number;
  sessionId: string;
  salesperson: string;
  startTime: string;
  endTime: string | null;
  duration: string | null;
  milesWalked: number;
  polyline: Point[];
  createdAt: string;
  synced: boolean;
  active: boolean;
  zipcodes: string[];
}

export interface Session extends BaseSession {
  salesOutcomes: SalesOutcomes;
  totalVisits: number;
  opportunityCount: number;
  opportunityTotal: number;
  estimatedCommission: number;
}