import { Injectable, signal, effect } from '@angular/core';
import { Contact, Deal, Activity, Visit } from '../models';

@Injectable({
  providedIn: 'root'
})
export class CrmService {
  #contacts = signal<Contact[]>([]);
  #deals = signal<Deal[]>([]);
  #activities = signal<Activity[]>([]);

  constructor() {
    this.loadFromLocalStorage();

    effect(() => {
      localStorage.setItem('worklyContacts', JSON.stringify(this.#contacts()));
      localStorage.setItem('worklyDeals', JSON.stringify(this.#deals()));
      localStorage.setItem('worklyActivities', JSON.stringify(this.#activities()));
    });
  }

  private loadFromLocalStorage() {
    const contacts = localStorage.getItem('worklyContacts');
    if (contacts) this.#contacts.set(JSON.parse(contacts));

    const deals = localStorage.getItem('worklyDeals');
    if (deals) this.#deals.set(JSON.parse(deals));
    
    const activities = localStorage.getItem('worklyActivities');
    if (activities) this.#activities.set(JSON.parse(activities));
  }
  
  // Contacts
  getContacts() {
    return this.#contacts();
  }
  
  getContactById(id: string) {
    return this.#contacts().find(c => c.id === id);
  }

  // Deals
  getDeals() {
    return this.#deals();
  }
  
  getDealsForContact(contactId: string) {
    return this.#deals().filter(d => d.contactId === contactId);
  }

  getDealById(id: string) {
    return this.#deals().find(d => d.id === id);
  }
  
  // Activities
  getActivitiesForContact(contactId: string) {
    return this.#activities()
      .filter(a => a.contactId === contactId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  getActivitiesForDeal(dealId: string) {
    return this.#activities()
      .filter(a => a.dealId === dealId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
  
  // CRM Logic
  private addActivity(activity: Omit<Activity, 'id'>) {
    const newActivity: Activity = {
      ...activity,
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    };
    this.#activities.update(activities => [...activities, newActivity]);
  }

  private findExistingContact(visit: Visit): Contact | undefined {
    const contacts = this.#contacts();
    if (visit.email) {
      const byEmail = contacts.find(c => c.email && c.email.toLowerCase() === visit.email!.toLowerCase());
      if (byEmail) return byEmail;
    }
    if (visit.phone) {
      const byPhone = contacts.find(c => c.phone === visit.phone);
      if (byPhone) return byPhone;
    }
    if (visit.street && visit.city && visit.state && visit.zip) {
      const byAddress = contacts.find(c => 
        c.street === visit.street &&
        c.city === visit.city &&
        c.state === visit.state &&
        c.zip === visit.zip
      );
      if (byAddress) return byAddress;
    }
    return undefined;
  }

  upsertContactFromVisit(visit: Visit): string {
    const existingContact = this.findExistingContact(visit);
    const now = new Date().toISOString();

    if (existingContact) {
      // Update existing contact with any new info
      const updatedContact: Contact = {
        ...existingContact,
        firstName: visit.firstName || existingContact.firstName,
        lastName: visit.lastName || existingContact.lastName,
        email: visit.email || existingContact.email,
        phone: visit.phone || existingContact.phone,
        leadStatus: visit.salesStatus || existingContact.leadStatus,
        notes: visit.notes || existingContact.notes,
        updatedAt: now,
      };
      this.#contacts.update(contacts => contacts.map(c => c.id === existingContact.id ? updatedContact : c));
      
      this.addActivity({
        contactId: existingContact.id,
        activityType: 'visit',
        title: `New Visit: ${visit.salesStatus}`,
        description: `A new visit was logged for this contact at ${visit.street}. Quote: $${visit.totalQuoted || 0}`,
        timestamp: visit.createdAt,
        metadata: { visitId: visit.id, sessionId: visit.sessionId }
      });

      return existingContact.id;
    } else {
      // Create new contact
      const newContact: Contact = {
        id: `con-${Date.now()}`,
        firstName: visit.firstName,
        lastName: visit.lastName,
        email: visit.email,
        phone: visit.phone,
        street: visit.street,
        city: visit.city,
        state: visit.state,
        zip: visit.zip,
        county: visit.county,
        latitude: visit.latitude,
        longitude: visit.longitude,
        leadSource: 'door_to_door',
        leadStatus: visit.salesStatus,
        notes: `Contact created from visit on ${new Date(visit.createdAt).toLocaleDateString()}. Notes: ${visit.notes || 'N/A'}`,
        createdAt: now,
        updatedAt: now,
      };
      this.#contacts.update(contacts => [...contacts, newContact]);
      
      this.addActivity({
        contactId: newContact.id,
        activityType: 'visit',
        title: `Initial Visit: ${visit.salesStatus}`,
        description: `Contact created from initial visit at ${visit.street}. Quote: $${visit.totalQuoted || 0}`,
        timestamp: visit.createdAt,
        metadata: { visitId: visit.id, sessionId: visit.sessionId }
      });
      
      return newContact.id;
    }
  }

  createDealForVisit(visit: Visit, contactId: string): string | null {
    const isOpportunity = visit.salesStatus?.toLowerCase() === 'opportunity';
    const hasQuote = (visit.totalQuoted ?? 0) > 0;

    if (!isOpportunity || !hasQuote) {
      return null;
    }
    
    const now = new Date().toISOString();
    const newDeal: Deal = {
      id: `deal-${Date.now()}`,
      contactId: contactId,
      visitId: visit.id?.toString(),
      sessionId: visit.sessionId,
      title: `Driveway Quote - ${visit.street}`,
      status: 'Open',
      quotedPrice: visit.totalQuoted,
      quoteDate: visit.createdAt,
      createdAt: now,
      updatedAt: now,
      notes: visit.notes,
      // Quote Breakdown
      drivewaySqft: visit.sqft,
      drivewayPrice: visit.drivewayQuoted,
      crackFeet: visit.crackFeet,
      crackPrice: visit.crackQuoted,
      asphaltSqft: visit.asphaltRepair,
      asphaltPrice: visit.asphalt,
    };
    
    this.#deals.update(deals => [...deals, newDeal]);

    this.addActivity({
        contactId: contactId,
        dealId: newDeal.id,
        activityType: 'deal_created',
        title: 'Deal Created from Visit',
        description: `An opportunity was identified and a deal was created with a quote of $${newDeal.quotedPrice}.`,
        timestamp: now,
        metadata: { visitId: visit.id, autoCreated: true }
    });

    return newDeal.id;
  }
}