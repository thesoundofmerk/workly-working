export interface Activity {
  id: string;
  contactId: string;
  dealId?: string;
  activityType: 'visit' | 'deal_created' | 'note' | 'call' | 'email';
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}
