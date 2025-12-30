export interface Deal {
  id: string;
  contactId: string;
  visitId?: string;
  sessionId?: string;
  title: string;
  status: 'Open' | 'Won' | 'Lost';
  quotedPrice?: number;
  finalPrice?: number;
  quoteDate: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  // Quote Breakdown
  drivewaySqft?: number;
  drivewayPrice?: number;
  crackFeet?: number;
  crackPrice?: number;
  asphaltSqft?: number;
  asphaltPrice?: number;
}