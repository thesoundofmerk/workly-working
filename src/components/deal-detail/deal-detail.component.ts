import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CrmService } from '../../services/crm.service';
import { Contact, Deal, Activity } from '../../models';

@Component({
  selector: 'app-deal-detail',
  templateUrl: './deal-detail.component.html',
  imports: [CommonModule, RouterLink, DatePipe, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DealDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private crmService = inject(CrmService);

  deal = signal<Deal | undefined>(undefined);
  contact = signal<Contact | undefined>(undefined);
  activities = signal<Activity[]>([]);

  ngOnInit(): void {
    const dealId = this.route.snapshot.paramMap.get('id');
    if (dealId) {
      const foundDeal = this.crmService.getDealById(dealId);
      this.deal.set(foundDeal);
      if (foundDeal) {
        this.contact.set(this.crmService.getContactById(foundDeal.contactId));
        this.activities.set(this.crmService.getActivitiesForDeal(dealId));
      }
    }
  }

  getActivityIcon(type: Activity['activityType']): string {
    switch (type) {
      case 'visit': return 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M12 21a9 9 0 100-18 9 9 0 000 18z';
      case 'deal_created': return 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z';
      case 'note': return 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z';
      default: return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    }
  }
}
