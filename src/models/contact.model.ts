export interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  latitude?: number;
  longitude?: number;
  leadSource?: string;
  leadStatus?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
