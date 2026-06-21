import type { Timestamp } from 'firebase/firestore';

export type AdminRole = 'super_admin' | 'department_head' | 'owner' | 'admin';

export type AdminUser = {
  uid: string;
  email?: string;
  displayName?: string;
  role?: AdminRole;
  department?: string;
  ownerName?: string;
};

export type ClientApprovalStatus = 'pending' | 'approved' | 'rejected' | 'accepted' | string;

export type DealRecord = {
  id: string;
  recordType?: string;

  clientId?: string;
  clientName?: string;
  companyName?: string;
  clientEmail?: string;
  contactName?: string;
  contactEmail?: string;
  clientPhone?: string;
  contactPhone?: string;

  dealTitle?: string;
  productService?: string;
  dealStatus?: 'Open' | 'Won' | 'Lost' | string;
  pipeline?: string;
  stage?: string;
  priority?: 'High' | 'Medium' | 'Low' | string;
  probability?: number;
  dealValue?: number;
  currency?: string;

  owner?: string;
  ownerUid?: string;
  ownerEmail?: string;
  department?: string;

  budgetRange?: string;
  customerTemperature?: 'Hot' | 'Warm' | 'Cold' | string;
  decisionMaker?: string;
  competitor?: string;
  notes?: string;
  nextAction?: string;

  activitySubject?: string;
  activityDueDate?: string;
  activityStatus?: 'Done' | 'Undone' | string;

  renewalDate?: string;
  paymentTerms?: string;

  clientApprovalRequired?: boolean;
  clientApprovalStatus?: ClientApprovalStatus;
  clientApprovedAt?: Timestamp;
  clientApprovedBy?: string;
  clientRejectedAt?: Timestamp;
  clientRejectedBy?: string;
  clientRejectionReason?: string;

  dealEmailSentAt?: Timestamp;
  dealEmailSentTo?: string;
  dealEmailError?: string;

  approvalActivityCreated?: boolean;
  approvalActivityCreatedAt?: Timestamp;
  feedbackActivityCreated?: boolean;
  feedbackActivityCreatedAt?: Timestamp;

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type ClientRecord = {
  id: string;
  recordType?: string;
  organizationName?: string;
  label?: string;
  companyEmail?: string;
  primaryContactEmail?: string;
  country?: string;
  city?: string;
  industry?: string;
  companySize?: string;
  customerTemperature?: 'Hot' | 'Warm' | 'Cold' | string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type InvoiceRecord = {
  id: string;
  invoiceNumber?: string;
  clientId?: string;
  clientName?: string;
  companyName?: string;
  dealDocId?: string;
  dealTitle?: string;
  productService?: string;
  status?: 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled' | string;
  total?: number;
  currency?: string;
  issueDate?: string;
  dueDate?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type ActivityStatus = 'Done' | 'Undone';

export type ActivityRecord = {
  id: string;
  recordType?: 'activity';
  subject?: string;
  type?: string;
  dueDate?: string;
  status?: ActivityStatus;
  department?: string;
  owner?: string;
  ownerUid?: string;
  ownerEmail?: string;
  nextAction?: string;
  notes?: string;
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  dealId?: string;
  dealTitle?: string;
  pipeline?: string;
  source?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  completedAt?: Timestamp;
};

export type ActiveServiceRecord = {
  id: string;
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  companyName?: string;
  serviceRequestId?: string;
  serviceId?: string;
  serviceNameAr?: string;
  serviceNameEn?: string;
  planId?: string;
  planNameAr?: string;
  planNameEn?: string;
  planPriceAr?: string;
  planPriceEn?: string;
  status?: 'not_started' | 'in_progress' | 'waiting_client' | 'delivered' | 'completed' | 'paused' | string;
  progress?: number;
  adminNote?: string;
  teamNote?: string;
  owner?: string;
  ownerUid?: string;
  ownerEmail?: string;
  department?: string;
  startDate?: string;
  expectedDeliveryDate?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};
