export interface CompanyBranch {
  id: string;
  name: string;
  city: string;
  createdAt: string;
  username?: string;
  password?: string;
  permissions?: UserPermissions;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
  smtpFromEmail?: string;
  smtpEnabled?: boolean;
  whatsappInstanceId?: string;
  whatsappToken?: string;
  whatsappGateway?: string;
  whatsappEnabled?: boolean;
}

export interface UserPermissions {
  manageClients?: boolean;
  manageTechnicians?: boolean;
  manageQuotes?: boolean;
  wipeDatabase?: boolean;
}

export interface Technician {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string;
  role: 'technician' | 'admin' | 'viewer';
  username?: string;
  password?: string;
  permissions?: UserPermissions;
  email?: string;
  emailNotificationsEnabled?: boolean;
  smsNotificationsEnabled?: boolean;
  whatsappNotificationsEnabled?: boolean;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
  smtpFromEmail?: string;
  smtpEnabled?: boolean;
  companyBranchId?: string;
}

export type VisitFrequency = '1' | '2' | '3' | '4' | '6' | '12'; // Visits per year

export interface ClientInquiry {
  id: string;
  text: string;
  createdAt: string;
  replyText?: string;
  repliedAt?: string;
  status?: 'pending' | 'completed';
}

export interface Branch {
  id: string;
  name: string;
  city: string; // e.g. الرياض, جدة
  locationText?: string;
  locationUrl?: string;
  managerPhone?: string;
  assignedTechnicianId?: string; // Designated technician for this specific branch
  contractNumber?: string;
  contractFile?: {
    name: string;
    url: string;
    uploadedAt: string;
    size?: string;
  };
  contractStartDate?: string;
  fireExtinguisherExpiry?: string; // YYYY-MM-DD
  contractEndDate?: string;
  contractDurationYears?: string; // '0.5' | '1' | '2' | '3'
  visitFrequency?: string; // Optional custom visit frequency for the branch
}

export interface Client {
  id: string;
  name: string;
  contractNumber: string;
  phone: string;
  locationText: string;
  locationUrl?: string;
  managerName?: string;
  managerPhone?: string;
  visitFrequency: VisitFrequency; // E.g. '4' times a year
  contractStartDate: string; // YYYY-MM-DD
  contractEndDate: string; // YYYY-MM-DD
  contractDurationYears?: string; // '0.5' | '1' | '2' | '3'
  assignedTechnicianId: string;
  contractSupervisorId?: string;
  status: 'active' | 'suspended';
  username?: string;
  password?: string;
  fireExtinguisherExpiry?: string; // YYYY-MM-DD
  inquiries?: ClientInquiry[];
  branches?: Branch[];
  subUsers?: ClientSubUser[];
  email?: string;
  delegateName?: string;
  contractFile?: {
    name: string;
    url: string;
    uploadedAt: string;
    size?: string;
  };
  companyBranchId?: string;
  taxNumber?: string; // الرقم الضريبي للعميل
  commercialRegister?: string; // السجل التجاري للعميل
  nationalAddress?: string; // العنوان الوطني للعميل
  contractRenewalHistory?: ContractRenewalRecord[];
  licenses?: ClientLicense[];
}

export type LicenseCategory = 
  | 'municipal'          // رخصة البلدية
  | 'civil_defense'      // رخصة الدفاع المدني
  | 'enjaz'              // رخصة انجاز
  | 'technical_report'   // تقرير فني
  | 'engineering_report' // تقرير هندسي
  | 'compliance_cert';   // شهادة انهاء ومطابقة اعمال

export interface ClientLicense {
  id: string;
  category: LicenseCategory;
  name: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  issuer?: string;
  notes?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  uploadedAt: string;
  uploadedBy?: string;
}

export interface ContractRenewalRecord {
  renewedAt: string; // ISO string
  previousStartDate: string;
  previousEndDate: string;
  previousContractNumber?: string;
  newStartDate: string;
  newEndDate: string;
  newContractNumber?: string;
  renewedBy?: string;
}

export interface RenewContractData {
  contractStartDate: string;
  contractEndDate: string;
  contractNumber?: string;
  visitFrequency?: VisitFrequency;
  contractFile?: {
    name: string;
    url: string;
    uploadedAt: string;
    size?: string;
  } | null;
  assignedTechnicianId?: string;
  applyToBranches?: boolean;
  branchRenewals?: Array<{
    branchId: string;
    contractStartDate?: string;
    contractEndDate?: string;
    contractNumber?: string;
    visitFrequency?: string;
  }>;
}

export interface ClientSubUser {
  id: string;
  name: string;
  phone: string;
  username: string;
  password?: string;
  role?: string;
  permissions?: {
    viewVisits?: boolean;
    replyQuotes?: boolean;
    submitInquiries?: boolean;
  };
}

export type VisitStatus = 'pending' | 'completed';
export type VisitResult = 'passed' | 'has_defects' | 'critical_issues' | 'not_visited';

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'video' | 'pdf';
  url: string; // data URL or mock file object URL
  uploadedAt: string;
}

export interface Visit {
  id: string;
  clientId: string;
  clientName: string; // Denormalized for quick query
  contractNumber: string;
  technicianId: string;
  technicianName: string; // Denormalized
  scheduledDate: string; // YYYY-MM-DD
  completedDate?: string; // YYYY-MM-DD
  status: VisitStatus;
  result: VisitResult;
  notes?: string;
  defects?: string;
  attachments?: Attachment[];
  branchName?: string;
  isEmergency?: boolean;
  emergencyReason?: string;
  emergencySeverity?: 'has_defects' | 'critical_issues';
  supervisorNotes?: string;
  fireExtinguisherExpiry?: string; // Expiry date of fire extinguishers
  clientSignature?: {
    name: string;
    url: string; // base64 dataUrl of the signed canvas or uploaded url
    signedAt: string;
    signatoryName?: string;
  };
  companyBranchId?: string;
  dismissedFromAwaitingPricing?: boolean;
}

export interface SystemSettings {
  daysBeforeVisitAlert: number; // Notification threshold
}

export interface CustomPage {
  id: string;
  title: string;
  icon: string;
  content: string;
  targetAudience: 'all' | 'admin' | 'clients' | 'technicians';
  createdAt: string;
  enabled: boolean;
}

export interface SystemCustomization {
  primaryColor: string; // Default #0f766e
  headerBgColor: string; // Default #0f172a
  companyName: string;
  unifiedNumber: string;
  companyPhone: string;
  companyEmail: string;
  companyTaxNumber: string;
  companyAddress: string;
  
  // Custom Tab / Module Labels
  overviewTabTitle?: string;
  clientsTabTitle?: string;
  emergencyTabTitle?: string;
  quotesTabTitle?: string;
  workOrdersTabTitle?: string;
  extinguishersTabTitle?: string;
  reportsArchiveTabTitle?: string;
  techniciansTabTitle?: string;
  smsTabTitle?: string;
  proformaInvoicesTabTitle?: string;
  
  // Custom Print Footer Note
  printFooterNote?: string;
  
  // Feature / Module Toggles
  enableQuotesModule: boolean;
  enableWorkOrdersModule: boolean;
  enableProformaInvoicesModule?: boolean;
  enableExtinguishersModule: boolean;
  enableEmergencyModule: boolean;
  enableSmsModule: boolean;
  enableClientInquiries: boolean;
  
  // Dynamic Super Admin Pages
  customPages: CustomPage[];
}

export interface QuotationItem {
  id: string;
  description: string; // البيان
  unitPrice: number; // سعر الوحدة
  quantity: number; // الكمية
  totalPrice: number; // السعر الإجمالي
  warranty?: string; // الضمان
}

export type QuotationStatus = 'pending' | 'approved' | 'rejected';

export interface QuotationExecutionReport {
  technicianName: string;
  technicianId: string;
  completedAt: string;
  completedItems: string[]; // array of QuotationItem.id which were checked/completed as done
  notes?: string;
  clientSignature?: {
    name: string;
    url: string; // base64 signature data URL
    signedAt: string;
    signatoryName?: string;
  };
  mediaUrls?: string[]; // array of photos/images
  videoUrls?: string[]; // array of videos
  paperReportUrl?: string; // paper report PDF/image data URL or file link
  paperReportName?: string; // paper report filename
}

export interface PaymentRecord {
  id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  method: string; // e.g. نقدي, تحويل بنكي, مدى, سداد, فيزا, etc.
  reference?: string; // رقم التحويل أو المرجع
  notes?: string; // ملاحظات أخرى
}

export interface PaymentReceipt {
  url: string;
  name: string;
  uploadedAt: string;
  fileType?: string;
  uploadedBy?: string;
}

export interface Quotation {
  id: string;
  visitId: string; // reference to the visit that generated this quotation
  clientId: string;
  clientName: string;
  branchName?: string;
  date: string; // YYYY-MM-DD format
  items: QuotationItem[];
  subtotal: number; // الاجمالي قبل الخصم والضريبة
  discountType?: 'percentage' | 'amount'; // نوع الخصم
  discountValue?: number; // قيمة الخصم (نسبة مئوية أو مبلغ)
  discountAmount?: number; // قيمة الخصم المحسوبة بالريال
  taxableSubtotal?: number; // الاجمالي الخاضع للضريبة بعد الخصم
  vat: number; // ضريبة القيمة المضافة 15 %
  grandTotal: number; // الاجمالي شامل ضريبة القيمة المضافة
  status: QuotationStatus; // 'pending' | 'approved' | 'rejected'
  clientNote?: string; // reply message or feedback note from the client
  repliedAt?: string; // date / time the client replied
  terms?: string; // الشروط والأحكام الخاصة بالعرض
  executionReport?: QuotationExecutionReport;
  assignedTechId?: string;
  assignedTechName?: string;
  workOrderStatus?: 'new' | 'pending' | 'partially_completed' | 'completed';
  workOrderAssignedDate?: string; // تاريخ التكليف وتوجيه أمر العمل للفني (YYYY-MM-DD)
  companyBranchId?: string;
  paymentStatus?: 'unpaid' | 'partially_paid' | 'paid';
  paidAmount?: number;
  paymentHistory?: PaymentRecord[];
  clientTaxNumber?: string;
  clientCrNumber?: string;
  clientNationalAddress?: string;
  clientPhone?: string;
  proformaInvoiceNumber?: string;
  paymentReceipt?: PaymentReceipt;
  isIndependentInvoice?: boolean; // فاتورة مبدئية مستقلة منشأة يدوياً
}

export interface NotificationLog {
  id: string;
  recipientPhone: string;
  recipientName: string;
  messageText: string;
  timestamp: string;
  status: 'sent' | 'failed' | 'simulated';
  type: 'manager_task' | 'technician_visit' | 'manager_email' | 'general';
  clientName: string;
  clientId?: string;
  inquiryId?: string;
  hasReply?: boolean;
  replyText?: string;
  repliedAt?: string;
  companyBranchId?: string;
}

export interface ExtinguisherItem {
  type: string;
  quantity: number;
  newExpiryDate: string;
}

export interface ExtinguisherReceipt {
  id: string;
  receiptNumber?: number; // الرقم التسلسلي للسند
  clientId: string;
  clientName: string;
  branchName?: string;
  technicianId: string;
  technicianName: string;
  date: string; // YYYY-MM-DD
  extinguisherType: string; // نوع الطفاية (تراجع خلفي)
  quantity: number; // الكمية (تراجع خلفي)
  notes: string; // ملاحظات
  newExpiryDate: string; // تاريخ الصلاحية الجديد (تراجع خلفي)
  signatoryName: string; // اسم المستلم
  signatureUrl: string; // base64 representation of drawing
  signedAt: string; // ISO or date string
  items?: ExtinguisherItem[]; // قائمة طفايات الحريق المتعددة في السند الواحد
  inspectionDate?: string; // تاريخ الفحص والصيانة الفعلي
  companyBranchId?: string;
}

