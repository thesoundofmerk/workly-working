import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CrmService } from '../../services/crm.service';
import { Contact, Deal } from '../../models';

@Component({
  selector: 'app-invoice',
  templateUrl: './invoice.component.html',
  imports: [CommonModule, RouterLink, DatePipe, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private crmService = inject(CrmService);

  deal = signal<Deal | undefined>(undefined);
  contact = signal<Contact | undefined>(undefined);
  
  invoiceDate = signal(new Date());
  isCopied = signal(false);

  dueDate = computed(() => {
    const date = new Date(this.invoiceDate());
    date.setDate(date.getDate() + 30); // Due in 30 days
    return date;
  });

  mailToLink = computed(() => {
    const deal = this.deal();
    const contact = this.contact();
    if (!deal || !contact || !contact.email) return '';

    const subject = `Invoice from Workly Pro (Invoice #${deal.id})`;
    const body = `Hi ${contact.firstName},

Please find your invoice details below. A PDF version can be generated from this invoice.

Invoice #: ${deal.id}
Total Due: ${(deal.finalPrice || deal.quotedPrice)?.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
Due Date: ${this.dueDate().toLocaleDateString()}

Thank you for your business!

Best,
Workly Pro
Artisan Outdoor Contractors LLC
    `.trim();

    return `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  ngOnInit(): void {
    const dealId = this.route.snapshot.paramMap.get('id');
    if (dealId) {
      const foundDeal = this.crmService.getDealById(dealId);
      this.deal.set(foundDeal);
      if (foundDeal) {
        this.contact.set(this.crmService.getContactById(foundDeal.contactId));
      }
    }
  }

  printInvoice(): void {
    window.print();
  }

  copyDetails(): void {
    const deal = this.deal();
    const contact = this.contact();
    if (!deal || !contact) return;

    const invoiceDate = this.invoiceDate().toLocaleDateString();
    const dueDate = this.dueDate().toLocaleDateString();
    const total = (deal.finalPrice || deal.quotedPrice)?.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

    let items = '';
    if (deal.drivewayPrice) {
        items += `Driveway Sealing (${deal.drivewaySqft} sq ft): ${deal.drivewayPrice.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}\n`;
    }
    if (deal.crackPrice) {
        items += `Crack Repair (${deal.crackFeet} ft): ${deal.crackPrice.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}\n`;
    }
    if (deal.asphaltPrice) {
        items += `Asphalt Patch (${deal.asphaltSqft} sq ft): ${deal.asphaltPrice.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}\n`;
    }
    if (!items && total) {
        items += `General Service: ${total}\n`;
    }

    const textToCopy = [
      'INVOICE',
      `Invoice #: ${deal.id}`,
      `Invoice Date: ${invoiceDate}`,
      `Due Date: ${dueDate}`,
      '',
      'BILL TO:',
      `${contact.firstName} ${contact.lastName}`,
      contact.street,
      `${contact.city}, ${contact.state} ${contact.zip}`,
      contact.email,
      '',
      'SERVICES:',
      items.trim(),
      '--------------------',
      `TOTAL DUE: ${total}`,
      '',
      'Thank you for your business!',
      'Workly Pro - Artisan Outdoor Contractors LLC'
    ].join('\n');

    navigator.clipboard.writeText(textToCopy.trim()).then(() => {
      this.isCopied.set(true);
      setTimeout(() => this.isCopied.set(false), 2000);
    }).catch(err => {
      console.error('Failed to copy invoice details: ', err);
    });
  }
}