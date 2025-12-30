import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';

export const APP_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(c => c.LoginComponent),
  },
  {
    path: 'visits/new',
    loadComponent: () => import('./components/new-visit/new-visit.component').then(c => c.NewVisitComponent),
    canActivate: [authGuard],
  },
  {
    path: 'canvassing/new',
    loadComponent: () => import('./components/canvassing/canvassing.component').then(c => c.CanvassingComponent),
    canActivate: [authGuard],
  },
  {
    path: 'sessions',
    loadComponent: () => import('./components/sessions-list/sessions-list.component').then(c => c.SessionsListComponent),
    canActivate: [authGuard],
  },
  {
    path: 'sessions/:id',
    loadComponent: () => import('./components/session-detail/session-detail.component').then(c => c.SessionDetailComponent),
    canActivate: [authGuard],
  },
  {
    path: 'crm/contacts',
    loadComponent: () => import('./components/contacts-list/contacts-list.component').then(c => c.ContactsListComponent),
    canActivate: [authGuard],
  },
  {
    path: 'crm/contacts/:id',
    loadComponent: () => import('./components/contact-detail/contact-detail.component').then(c => c.ContactDetailComponent),
    canActivate: [authGuard],
  },
  {
    path: 'crm/deals/:id',
    loadComponent: () => import('./components/deal-detail/deal-detail.component').then(c => c.DealDetailComponent),
    canActivate: [authGuard],
  },
  {
    path: 'crm/deals/:id/invoice',
    loadComponent: () => import('./components/invoice/invoice.component').then(c => c.InvoiceComponent),
    canActivate: [authGuard],
  },
  {
    path: '',
    loadComponent: () => import('./components/dashboard/dashboard.component').then(c => c.DashboardComponent),
    canActivate: [authGuard],
    pathMatch: 'full'
  },
  { path: '**', redirectTo: '' }
];