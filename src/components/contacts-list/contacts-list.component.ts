import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CrmService } from '../../services/crm.service';
import { Contact } from '../../models/contact.model';

@Component({
  selector: 'app-contacts-list',
  templateUrl: './contacts-list.component.html',
  imports: [CommonModule, RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsListComponent implements OnInit {
  private crmService = inject(CrmService);
  private router = inject(Router);
  
  contacts = signal<Contact[]>([]);

  ngOnInit(): void {
    const sortedContacts = this.crmService.getContacts().sort((a,b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    this.contacts.set(sortedContacts);
  }

  viewContact(contactId: string) {
    this.router.navigate(['/crm/contacts', contactId]);
  }
}
