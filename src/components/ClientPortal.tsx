import { useState, FormEvent, ChangeEvent } from 'react';
import { Client, Branch, Visit, Technician, ClientInquiry, Quotation, QuotationItem, Attachment, ExtinguisherReceipt, SystemCustomization, PaymentReceipt, ClientLicense, LicenseCategory } from '../types';
import { 
  Shield, Calendar, Clock, FileText, CheckCircle2, AlertTriangle, 
  MessageSquare, Send, Phone, MapPin, User, LogOut, Download, 
  Eye, ExternalLink, HelpCircle, AlertCircle, Sparkles, Printer, X, Check,
  ThumbsUp, ThumbsDown, Edit, Trash2, Camera, Upload, Wrench, Search,
  ChevronDown, ChevronUp, Film, FileCheck, Award
} from 'lucide-react';
import { Language, translations } from '../lib/translations';
import { formatContractDuration } from '../lib/contractUtils';
import { dt } from '../lib/dynamicTranslate';
import { compressImageIfNeeded } from '../lib/imageCompressor';
import { formatVideoUrl, isVideoUrl, isImageUrl } from '../lib/mediaUtils';
import ExecutionReportModal from './ExecutionReportModal';

export const LICENSE_CATEGORIES: {
  category: LicenseCategory;
  titleAr: string;
  titleEn: string;
  icon: string;
  descriptionAr: string;
  descriptionEn: string;
}[] = [
  {
    category: 'municipal',
    titleAr: 'رخصة البلدية',
    titleEn: 'Municipality License',
    icon: '🏛️',
    descriptionAr: 'رخصة الأنشطة التجارية والبلدية الصادرة من وزارة الشؤون البلدية والقروية والإسكان (بلدي)',
    descriptionEn: 'Municipal commercial activity license issued by Balady',
  },
  {
    category: 'civil_defense',
    titleAr: 'رخصة الدفاع المدني',
    titleEn: 'Civil Defense License',
    icon: '🚒',
    descriptionAr: 'ترخيص السلامة ومكافحة الحريق الصادر من المديرية العامة للدفاع المدني (سلامة)',
    descriptionEn: 'Safety and fire prevention license issued by Civil Defense (Salama)',
  },
  {
    category: 'enjaz',
    titleAr: 'رخصة إنجاز',
    titleEn: 'Enjaz License',
    icon: '⚡',
    descriptionAr: 'شهادة ترخيص وتوثيق أعمال السلامة والتركيبات المعتمدة عبر منصة إنجاز',
    descriptionEn: 'Enjaz safety works & installations certification',
  },
  {
    category: 'technical_report',
    titleAr: 'تقرير فني',
    titleEn: 'Technical Report',
    icon: '📋',
    descriptionAr: 'تقرير الكشف الفني واختبار فاعلية شبكات الإنذار ومضخات الحريق وتمديدات السلامة',
    descriptionEn: 'Technical audit report for alarm networks, pumps and safety systems',
  },
  {
    category: 'engineering_report',
    titleAr: 'تقرير هندسي',
    titleEn: 'Engineering Report',
    icon: '📐',
    descriptionAr: 'التقرير والمخطط الهندسي المعتمد من مكتب هندسي استشاري مرخص للسلامة الوقائية',
    descriptionEn: 'Certified engineering drawing & audit report by licensed engineering firm',
  },
  {
    category: 'compliance_cert',
    titleAr: 'شهادة إنهاء ومطابقة أعمال',
    titleEn: 'Work Completion & Compliance Certificate',
    icon: '🎖️',
    descriptionAr: 'شهادة إنجاز ومطابقة الأعمال الميدانية لكود البناء السعودي ومتطلبات السلامة المعتمدة',
    descriptionEn: 'Work completion and compliance certificate according to SBC safety codes',
  },
];

export const MONTHS_LIST = [
  { value: '01', labelAr: '1 - يناير', labelEn: 'January' },
  { value: '02', labelAr: '2 - فبراير', labelEn: 'February' },
  { value: '03', labelAr: '3 - مارس', labelEn: 'March' },
  { value: '04', labelAr: '4 - أبريل', labelEn: 'April' },
  { value: '05', labelAr: '5 - مايو', labelEn: 'May' },
  { value: '06', labelAr: '6 - يونيو', labelEn: 'June' },
  { value: '07', labelAr: '7 - يوليو', labelEn: 'July' },
  { value: '08', labelAr: '8 - أغسطس', labelEn: 'August' },
  { value: '09', labelAr: '9 - سبتمبر', labelEn: 'September' },
  { value: '10', labelAr: '10 - أكتوبر', labelEn: 'October' },
  { value: '11', labelAr: '11 - نوفمبر', labelEn: 'November' },
  { value: '12', labelAr: '12 - ديسمبر', labelEn: 'December' },
];

export const YEARS_LIST = ['2024', '2025', '2026', '2027', '2028', '2029', '2030'];

interface ClientPortalProps {
  client: Client;
  visits: Visit[];
  technicians: Technician[];
  quotations: Quotation[];
  emergencyVisits?: Visit[];
  onReplyQuotation: (id: string, status: 'approved' | 'rejected', clientNote?: string) => void;
  onAddEmergencyVisit?: (newEmergency: Visit) => void;
  lang: Language;
  onLogout: () => void;
  onSubmitInquiry: (clientId: string, text: string) => void;
  onSelectVisit: (visit: Visit) => void;
  adminName?: string;
  managerPhone?: string;
  subUserPermissions?: {
    viewVisits?: boolean;
    replyQuotes?: boolean;
    submitInquiries?: boolean;
  };
  onEditInquiry?: (clientId: string, inquiryId: string, text: string) => void;
  onDeleteInquiry?: (clientId: string, inquiryId: string) => void;
  extinguisherReceipts?: ExtinguisherReceipt[];
  onSetExtinguisherReceipts?: (receipts: ExtinguisherReceipt[]) => void;
  onUpdateQuotation?: (updatedQuote: Quotation) => void;
  customization?: SystemCustomization;
  onUpdateClient?: (updatedClient: Client) => void;
}

const COMPANY_STAMP_SVG = `
<svg viewBox="0 0 290 102" width="235" height="83" style="display: inline-block; transform: rotate(-1.5deg); margin: 3px; filter: drop-shadow(1px 1px 2px rgba(226,35,26,0.15));" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <!-- Outer Rounded Rectangle -->
  <rect x="6" y="6" width="278" height="90" rx="12" fill="none" stroke="#e2231a" stroke-width="2.3" />
  <rect x="10" y="10" width="270" height="82" rx="9" fill="none" stroke="#e2231a" stroke-width="1.0" stroke-dasharray="3 1" />

  <!-- LOGO GRAPHIC (Left Section, Centered and Enlarged) -->
  <g>
    <image href="/logo_nesma.png?v=2" xlink:href="/logo_nesma.png?v=2" x="12" y="8" width="62" height="86" preserveAspectRatio="xMidYMid contain" />
  </g>

  <!-- DEPT/COMPANY TEXT (Right Section, balanced equal line spacing) -->
  <g transform="translate(80, 8)">
    <text x="96" y="21" font-family="'Cairo', 'Inter', system-ui, -apple-system, sans-serif" font-size="12" font-weight="950" fill="#e2231a" text-anchor="middle" letter-spacing="0.5">شركة نسما الاولى لأنظمة السلامة</text>
    
    <text x="96" y="38" font-family="'Cairo', 'Inter', system-ui, -apple-system, sans-serif" font-size="10.8" font-weight="900" fill="#e2231a" text-anchor="middle">تدقيق واعتماد قسم الصيانة</text>
    
    <text x="96" y="54" font-family="'Cairo', 'Inter', system-ui, -apple-system, sans-serif" font-size="8.6" font-weight="800" fill="#7f1d1d" text-anchor="middle">معدات وأنظمة السلامة | الرقم الموحد 7003489890</text>
    
    <text x="96" y="70" font-family="monospace" font-size="6.8" font-weight="bold" fill="#e2231a" text-anchor="middle">MAINTENANCE DEPT - OFFICIALLY APPROVED</text>
  </g>
</svg>
`;

export const printHtmlContent = (html: string) => {
  try {
    // Create a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.zIndex = '-9999';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    // Write the HTML content into the iframe
    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      // Focus and trigger print after styles/fonts load
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (printErr) {
          console.error('[SAS Print Error] Print failed in iframe:', printErr);
          // Fallback: open a new window if blocked
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            setTimeout(() => { printWindow.print(); }, 500);
          }
        }

        // Clean up the iframe
        setTimeout(() => {
          iframe.remove();
        }, 3000);
      }, 600);
    }
  } catch (err) {
    console.error('[SAS Print Error] Failed to use hidden iframe print:', err);
    // Ultimate fallback: open a new window
    try {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => { printWindow.print(); }, 500);
      }
    } catch (fallbackErr) {
      console.error('[SAS Print Error] All print methods failed:', fallbackErr);
    }
  }
};

export default function ClientPortal({
  client,
  visits,
  technicians,
  quotations = [],
  emergencyVisits = [],
  onReplyQuotation,
  extinguisherReceipts = [],
  onSetExtinguisherReceipts,
  onAddEmergencyVisit,
  lang,
  onLogout,
  onSubmitInquiry,
  onSelectVisit,
  adminName = 'المشرف العام',
  managerPhone = '0555012345',
  subUserPermissions,
  onEditInquiry,
  onDeleteInquiry,
  onUpdateQuotation,
  customization,
  onUpdateClient
}: ClientPortalProps) {
  const t = translations[lang];
  const isRtl = lang === 'ar';

  const canViewVisits = subUserPermissions?.viewVisits ?? true;
  const canReplyQuotes = subUserPermissions?.replyQuotes ?? true;
  const canSubmitInquiries = subUserPermissions?.submitInquiries ?? true;

  const [inquiryText, setInquiryText] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<string>('overview');
  const [selectedReceipt, setSelectedReceipt] = useState<ExtinguisherReceipt | null>(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<Quotation | null>(null);
  const [selectedBranchForModal, setSelectedBranchForModal] = useState<Branch | null>(null);
  const [viewingPaymentReceiptModal, setViewingPaymentReceiptModal] = useState<PaymentReceipt | null>(null);
  const [proformaPaymentFilter, setProformaPaymentFilter] = useState<'all' | 'unpaid' | 'partially_paid' | 'paid' | 'independent'>('all');
  const [proformaSearch, setProformaSearch] = useState('');

  // Calendar Search in Archive
  const [archiveFilterYear, setArchiveFilterYear] = useState<string>('all');
  const [archiveFilterMonth, setArchiveFilterMonth] = useState<string>('all');

  // Licenses Tab States
  const [editingLicenseCategory, setEditingLicenseCategory] = useState<LicenseCategory | null>(null);
  const [licenseDocNumber, setLicenseDocNumber] = useState('');
  const [licenseIssueDate, setLicenseIssueDate] = useState('');
  const [licenseExpiryDate, setLicenseExpiryDate] = useState('');
  const [licenseNotes, setLicenseNotes] = useState('');
  const [licenseFile, setLicenseFile] = useState<{ url: string; name: string; size?: string } | null>(null);
  const [isUploadingLicense, setIsUploadingLicense] = useState(false);
  const [licenseSaveSuccessMsg, setLicenseSaveSuccessMsg] = useState('');
  const [licenseSearchQuery, setLicenseSearchQuery] = useState('');
  const [licenseStatusFilter, setLicenseStatusFilter] = useState<'all' | 'valid' | 'expiring' | 'expired' | 'missing'>('all');

  const handleUploadPaymentReceipt = (e: ChangeEvent<HTMLInputElement>, quote: Quotation) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 12 * 1024 * 1024) {
      alert(isRtl ? 'حجم الملف كبير جداً. الحد الأقصى المسموح به هو 12 ميجابايت.' : 'File size is too large. Maximum allowed size is 12MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Url = reader.result as string;
      const paymentReceipt: PaymentReceipt = {
        url: base64Url,
        name: file.name,
        uploadedAt: new Date().toLocaleDateString('ar-SA') + ' ' + new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        fileType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        uploadedBy: isRtl ? 'العميل' : 'Client'
      };

      const updatedQuote: Quotation = {
        ...quote,
        paymentReceipt
      };

      if (onUpdateQuotation) {
        onUpdateQuotation(updatedQuote);
      }
      alert(isRtl ? 'تم إرفاق إشعار السداد بنجاح!' : 'Payment receipt attached successfully!');
    };
    reader.readAsDataURL(file);
  };

  const getLicenseStatus = (expiryDateStr?: string) => {
    if (!expiryDateStr) return 'none';
    const exp = new Date(expiryDateStr);
    const t = new Date();
    t.setHours(0,0,0,0);
    exp.setHours(0,0,0,0);
    const diffDays = Math.ceil((exp.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'expired';
    if (diffDays <= 30) return 'expiring';
    return 'valid';
  };

  const getLicenseRemainingDays = (expiryDateStr?: string) => {
    if (!expiryDateStr) return null;
    const exp = new Date(expiryDateStr);
    const t = new Date();
    t.setHours(0,0,0,0);
    exp.setHours(0,0,0,0);
    return Math.ceil((exp.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
  };

  const handleOpenEditLicense = (category: LicenseCategory) => {
    const existing = (client.licenses || []).find(l => l.category === category);
    setEditingLicenseCategory(category);
    setLicenseDocNumber(existing?.documentNumber || '');
    setLicenseIssueDate(existing?.issueDate || '');
    setLicenseExpiryDate(existing?.expiryDate || '');
    setLicenseNotes(existing?.notes || '');
    setLicenseFile(existing?.fileUrl ? {
      url: existing.fileUrl,
      name: existing.fileName || (existing.name + '.pdf'),
      size: existing.fileSize
    } : null);
  };

  const handleLicenseFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert(isRtl ? 'حجم الملف كبير جداً (أكثر من 20 ميجابايت).' : 'File size too large (>20MB).');
      return;
    }

    setIsUploadingLicense(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Content = reader.result as string;
      try {
        const resp = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            type: file.type || 'application/pdf',
            base64: base64Content
          })
        });
        const data = await resp.json();
        if (data.success && data.url) {
          setLicenseFile({
            url: data.url,
            name: file.name,
            size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`
          });
        } else {
          setLicenseFile({
            url: base64Content,
            name: file.name,
            size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`
          });
        }
      } catch (err) {
        setLicenseFile({
          url: base64Content,
          name: file.name,
          size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`
        });
      } finally {
        setIsUploadingLicense(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveLicense = (category: LicenseCategory) => {
    const catMeta = LICENSE_CATEGORIES.find(c => c.category === category);
    const existingLicenses = client.licenses ? [...client.licenses] : [];
    const existingIdx = existingLicenses.findIndex(l => l.category === category);

    const updatedLicense: ClientLicense = {
      id: existingIdx >= 0 ? existingLicenses[existingIdx].id : `lic_${Date.now()}_${category}`,
      category,
      name: catMeta ? catMeta.titleAr : category,
      documentNumber: licenseDocNumber.trim() || undefined,
      issueDate: licenseIssueDate || undefined,
      expiryDate: licenseExpiryDate || undefined,
      notes: licenseNotes.trim() || undefined,
      fileUrl: licenseFile?.url || (existingIdx >= 0 ? existingLicenses[existingIdx].fileUrl : undefined),
      fileName: licenseFile?.name || (existingIdx >= 0 ? existingLicenses[existingIdx].fileName : undefined),
      fileSize: licenseFile?.size || (existingIdx >= 0 ? existingLicenses[existingIdx].fileSize : undefined),
      uploadedAt: new Date().toISOString().split('T')[0],
      uploadedBy: client.managerName || client.name
    };

    if (existingIdx >= 0) {
      existingLicenses[existingIdx] = updatedLicense;
    } else {
      existingLicenses.push(updatedLicense);
    }

    const updatedClient: Client = {
      ...client,
      licenses: existingLicenses
    };

    if (onUpdateClient) {
      onUpdateClient(updatedClient);
    }

    setLicenseSaveSuccessMsg(isRtl ? 'تم حفظ وتوثيق بيانات الرخصة بنجاح! تظهر الآن في سجل العملاء لدى المشرف العام.' : 'License saved successfully! Visible to supervisor.');
    setTimeout(() => setLicenseSaveSuccessMsg(''), 4000);
    setEditingLicenseCategory(null);
  };

  const handleDeleteLicense = (category: LicenseCategory) => {
    if (!confirm(isRtl ? 'هل تريد بالتأكيد حذف ملف وبيانات هذه الرخصة؟' : 'Are you sure you want to remove this license?')) {
      return;
    }
    const existingLicenses = (client.licenses || []).filter(l => l.category !== category);
    const updatedClient: Client = {
      ...client,
      licenses: existingLicenses
    };
    if (onUpdateClient) {
      onUpdateClient(updatedClient);
    }
  };
  
  // Collapse state for Dashboard Overview sections
  const [isBranchesSectionCollapsed, setIsBranchesSectionCollapsed] = useState<boolean>(true);
  const [isVisitsSectionCollapsed, setIsVisitsSectionCollapsed] = useState<boolean>(true);

  const today = new Date();
  const getFireExtinguisherStatus = (expiryDateStr?: string) => {
    if (!expiryDateStr) return 'none';
    const expiryDate = new Date(expiryDateStr);
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'expired';
    if (diffDays <= 30) return 'expiring';
    return 'valid';
  };

  const formatDateDMY = (dateVal: string | Date | undefined | null): string => {
    if (!dateVal) return '---';
    try {
      if (typeof dateVal === 'string') {
        const trimmed = dateVal.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          const parts = trimmed.split('-');
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        if (/^\d{4}\/\d{2}\/\d{2}$/.test(trimmed)) {
          const parts = trimmed.split('/');
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }
      const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
      if (isNaN(d.getTime())) {
        return String(dateVal);
      }
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      return String(dateVal);
    }
  };

  // Inquiry edit/delete states
  const [editingInquiryId, setEditingInquiryId] = useState<string | null>(null);
  const [editingInquiryText, setEditingInquiryText] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteReplyId, setConfirmDeleteReplyId] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<{ name: string; url: string; clientName?: string; contractNumber?: string; type?: string } | null>(null);

  const handleStartEdit = (id: string, text: string) => {
    setEditingInquiryId(id);
    setEditingInquiryText(text);
  };

  const handleSaveEdit = (id: string) => {
    if (!editingInquiryText.trim()) return;
    if (onEditInquiry) {
      onEditInquiry(client.id, id, editingInquiryText.trim());
    }
    setEditingInquiryId(null);
    setEditingInquiryText('');
  };

  const handleCancelEdit = () => {
    setEditingInquiryId(null);
    setEditingInquiryText('');
  };

  const handleDeleteClick = (id: string) => {
    if (onDeleteInquiry) {
      onDeleteInquiry(client.id, id);
    }
    setConfirmDeleteId(null);
  };

  // Quotations and approvals state
  const [showViewQuoteModal, setShowViewQuoteModal] = useState(false);
  const [viewingQuotation, setViewingQuotation] = useState<Quotation | null>(null);
  const [viewingExecutionReportQuote, setViewingExecutionReportQuote] = useState<Quotation | null>(null);
  const [clientReplyNote, setClientReplyNote] = useState('');

  // Client Request Emergency Visit States
  const [isNewEmergencyModalOpenClient, setIsNewEmergencyModalOpenClient] = useState(false);
  const [clientEmergencyBranchOption, setClientEmergencyBranchOption] = useState('');
  const [clientEmergencyReasonInput, setClientEmergencyReasonInput] = useState('');
  const [clientEmergencySeverity, setClientEmergencySeverity] = useState<'has_defects' | 'critical_issues'>('has_defects');
  const [clientEmergencyImage, setClientEmergencyImage] = useState<Attachment | null>(null);
  const [clientEmergencyUploadProgress, setClientEmergencyUploadProgress] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [localPreviewName, setLocalPreviewName] = useState<string>('');

  // Tab KPI Filter States
  const [emergencyVisitFilter, setEmergencyVisitFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [quotationFilter, setQuotationFilter] = useState<'all' | 'pending' | 'approved' | 'unpaid' | 'paid' | 'partially_paid'>('all');
  const [workOrderFilter, setWorkOrderFilter] = useState<'all' | 'new' | 'pending' | 'partially_completed' | 'completed'>('all');

  // Archive Filter States
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('');
  const [archiveFilterStatus, setArchiveFilterStatus] = useState('all');
  const [archiveFilterResult, setArchiveFilterResult] = useState('all');
  const [archiveFilterMedia, setArchiveFilterMedia] = useState('all');

  const handlePrintQuotation = (quote: Quotation) => {
    const isArabic = isRtl;
    
    const itemsHtml = quote.items.map(item => `
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: ${isArabic ? 'right' : 'left'};">
          <strong style="color: #1e293b; display: block;">${item.description}</strong>
          ${item.warranty ? `<span style="font-size: 10px; color: #0f766e; font-weight: bold; display: block; margin-top: 2px;">${isArabic ? 'ضمان:' : 'Warranty:'} ${item.warranty}</span>` : ''}
        </td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; font-family: monospace;">
          ${item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${isArabic ? 'ر.س' : 'SAR'}
        </td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: ${isArabic ? 'left' : 'right'}; font-family: monospace; font-weight: bold;">
          ${item.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${isArabic ? 'ر.س' : 'SAR'}
        </td>
      </tr>
    `).join('');

    const termsHtml = (quote.terms || '')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => `<li>${line}</li>`)
      .join('');

    const statusBadge = quote.status === 'approved' 
      ? `<span style="color: #047857; background: #d1fae5; padding: 4px 10px; border-radius: 9999px; font-weight: bold;">✓ ${isArabic ? 'مقبول ومعتمد من قبلك' : 'APPROVED & ACCEPTED'}</span>`
      : quote.status === 'rejected'
        ? `<span style="color: #b91c1c; background: #fee2e2; padding: 4px 10px; border-radius: 9999px; font-weight: bold;">✕ ${isArabic ? 'مرفوض من قبلك' : 'REJECTED BY CLIENT'}</span>`
        : `<span style="color: #b45309; background: #fef3c7; padding: 4px 10px; border-radius: 9999px; font-weight: bold;">● ${isArabic ? 'بانتظار قرار وسداد العميل' : 'PENDING YOUR REVIEW'}</span>`;

    const html = `
      <!DOCTYPE html>
      <html dir="${isArabic ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="utf-8">
        <title>Nesma_Quotation_${quote.id.split('_')[1] || quote.id}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page {
            size: A4;
            margin: 15mm;
          }
          body {
            font-family: 'Cairo', 'Inter', sans-serif;
            background: #ffffff;
            color: #1e293b;
            padding: 0;
            margin: 0;
            font-size: 11px;
            line-height: 1.5;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
            border-bottom: 2px solid #0f766e;
            padding-bottom: 15px;
          }
          .title {
            font-size: 16px;
            font-weight: 800;
            color: #111827;
            margin: 0;
            white-space: nowrap;
          }
          .subtitle {
            font-size: 10px;
            color: #64748b;
            max-width: 450px;
            line-height: 1.4;
            margin-top: 4px;
          }
          .meta-box {
            width: 100%;
            border-collapse: collapse;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            margin-bottom: 25px;
          }
          .meta-td {
            padding: 12px;
            vertical-align: top;
            width: 50%;
          }
          .label {
            font-size: 9px;
            font-weight: bold;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 3px;
          }
          .value {
            font-size: 11px;
            font-weight: bold;
            color: #0f172a;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
          }
          .items-table th {
            background: #111827;
            color: #ffffff;
            font-weight: bold;
            padding: 10px;
            font-size: 10px;
            border: 1px solid #111827;
          }
          .summary-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
          }
          .summary-td {
            vertical-align: top;
          }
          .totals-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px;
            width: 250px;
            margin-${isArabic ? 'right' : 'left'}: auto;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 6px;
            font-size: 10px;
          }
          .totals-row.grand {
            border-top: 1px solid #cbd5e1;
            padding-top: 6px;
            font-size: 12px;
            font-weight: 850;
            color: #0f766e;
          }
          .terms-list {
            padding-right: 15px;
            padding-left: 15px;
            margin: 0;
            font-size: 9px;
            color: #64748b;
            line-height: 1.5;
          }
          .signature-section {
            width: 100%;
            border-collapse: collapse;
            margin-top: 40px;
          }
          .signature-col {
            width: 50%;
            vertical-align: top;
          }
          .signature-box {
            height: 60px;
            border: 1px solid #e2e8f0;
            background: #fafafa;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #94a3b8;
            font-style: italic;
            font-size: 10px;
            margin-top: 5px;
            text-align: center;
          }
          .stamp {
            border: 2px dashed #0f766e;
            color: #0f766e;
            padding: 6px 12px;
            font-weight: 800;
            border-radius: 6px;
            transform: rotate(-3deg);
            display: inline-block;
            background: rgba(15, 118, 110, 0.05);
            font-size: 10px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <table class="header-table" style="width: 100%;">
          <tr>
            <td style="width: 115px; vertical-align: middle; padding-${isArabic ? 'left' : 'right'}: 15px;">
              <img src="/logo_nesma.png?v=2" style="width: 115px; height: auto; object-fit: contain; display: block;" referrerPolicy="no-referrer" />
            </td>
            <td style="vertical-align: middle;">
              <h1 class="title">${isArabic ? 'شركة نسما الأولى لأنظمة السلامة' : 'Nesma First Safety Systems'}</h1>
              <div class="subtitle">
                ${isArabic 
                  ? 'شركة معتمدة لتركيب وصيانة شبكات إنذار ومكافحة الحريق ومعدات السلامة بترخيص الدفاع المدني لمختلف المنشآت.' 
                  : 'Certified company for the installation and inspection of safety networks, fire alarm and protection hardware approved by Civil Defense.'}
              </div>
            </td>
            <td style="text-align: ${isArabic ? 'left' : 'right'}; font-family: monospace; vertical-align: middle; width: 180px;">
              <div style="font-size: 13px; font-weight: 800; border: 1px solid #111827; padding: 4px 10px; background: #f8fafc; display: inline-block; border-radius: 4px; margin-bottom: 5px;">
                ${isArabic ? 'عرض سعر رقم' : 'QUOTE REF'}: #${quote.id.split('_')[1] || quote.id}
              </div>
              <div style="font-size: 10px; color: #64748b;">
                <strong>${isArabic ? 'تاريخ التحرير' : 'Date'}:</strong> ${quote.date}
              </div>
            </td>
          </tr>
        </table>

        <!-- Metadata Box -->
        <table class="meta-box">
          <tr>
            <td class="meta-td" style="border-${isArabic ? 'left' : 'right'}: 1px solid #e2e8f0;">
              <div class="label">${isArabic ? 'مرسل إلى العميل' : 'BILL TO CLIENT'}</div>
              <div class="value" style="font-size: 12px; color: #0f172a; margin-bottom: 4px;">${quote.clientName}</div>
              <div style="font-size: 10px; color: #64748b;">
                ${isArabic ? 'الفرع/الموقع المخصّص' : 'Target Branch/Location'}: <strong style="color: #334155;">${quote.branchName}</strong>
              </div>
            </td>
            <td class="meta-td">
              <div class="label">${isArabic ? 'حالة الاعتماد والرد الحالي' : 'QUOTATION STATUS'}</div>
              <div style="margin-top: 4px; margin-bottom: 4px;">${statusBadge}</div>
              ${quote.repliedAt ? `
                <div style="font-size: 9px; color: #94a3b8; font-family: monospace; margin-top: 6px;">
                  ${isArabic ? 'تاريخ الرد:' : 'Replied At:'} ${new Date(quote.repliedAt).toLocaleString(isArabic ? 'ar-EG' : 'en-US')}
                </div>
              ` : ''}
            </td>
          </tr>
        </table>

        <!-- Items Table -->
        <table class="items-table">
          <thead>
            <tr>
              <th style="text-align: ${isArabic ? 'right' : 'left'};">${isArabic ? 'البيان ومواصفات قطعة الغيار المطلوبة' : 'Description / Repair Item'}</th>
              <th style="width: 110px; text-align: center;">${isArabic ? 'سعر الوحدة' : 'Unit Price'}</th>
              <th style="width: 70px; text-align: center;">${isArabic ? 'الكمية' : 'Qty'}</th>
              <th style="width: 130px; text-align: ${isArabic ? 'left' : 'right'};">${isArabic ? 'السعر الإجمالي' : 'Total Price'}</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <!-- Summary section -->
        <table class="summary-table">
          <tr>
            <td class="summary-td">
              <div style="font-weight: bold; color: #0f172a; margin-bottom: 4px;">${isArabic ? 'الشروط والأحكام الخاصة بالعرض:' : 'Quotation Terms & Conditions:'}</div>
              <ul class="terms-list">
                ${termsHtml ? termsHtml : `
                  <li>${isArabic ? 'يسري هذا العرض لمدة خمسة عشر (15) يوماً من تاريخ التحرير.' : 'This pricing sheet is valid for 15 days from issue date.'}</li>
                  <li>${isArabic ? 'الأسعار المدرجة أعلاه خاضعة لضريبة القيمة المضافة الإلزامية بنسبة 15%.' : 'All listed prices are subject to mandatory 15% VAT.'}</li>
                  <li>${isArabic ? 'ساعات وأجور العمل مشمولة في الأسعار إلا إذا ذكر خلاف ذلك.' : 'Labor cost and installation efforts are included unless specified.'}</li>
                `}
              </ul>
            </td>
            <td class="summary-td" style="width: 300px; text-align: ${isArabic ? 'left' : 'right'};">
              <div class="totals-box">
                <div class="totals-row">
                  <span>${isArabic ? 'المجموع الفرعي' : 'Subtotal'}:</span>
                  <span style="font-weight: bold; color: #334155;">${quote.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${isArabic ? 'ريال' : 'SAR'}</span>
                </div>
                ${(quote.discountAmount || 0) > 0 ? `
                  <div class="totals-row" style="color: #dc2626;">
                    <span>${isArabic ? 'خصم خاص للعميل' : 'Client Discount'} ${quote.discountType === 'percentage' ? `(${quote.discountValue}%)` : ''}:</span>
                    <span style="font-weight: bold;">-${(quote.discountAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${isArabic ? 'ريال' : 'SAR'}</span>
                  </div>
                  <div class="totals-row" style="background: #f8fafc;">
                    <span>${isArabic ? 'الإجمالي الخاضع للضريبة' : 'Taxable Subtotal'}:</span>
                    <span style="font-weight: bold; color: #0f172a;">${(quote.taxableSubtotal ?? (quote.subtotal - (quote.discountAmount || 0))).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${isArabic ? 'ريال' : 'SAR'}</span>
                  </div>
                ` : ''}
                <div class="totals-row">
                  <span>${isArabic ? 'ضريبة القيمة المضافة (15%)' : 'VAT (15%)'}:</span>
                  <span style="font-weight: bold; color: #334155;">${quote.vat.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${isArabic ? 'ريال' : 'SAR'}</span>
                </div>
                <div class="totals-row grand">
                  <span>${isArabic ? 'الإجمالي النهائي' : 'Grand Total'}:</span>
                  <span>${quote.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${isArabic ? 'ريال' : 'SAR'}</span>
                </div>
              </div>
            </td>
          </tr>
        </table>

        <!-- Signatures & Seal -->
        <table class="signature-section">
          <tr>
            <td class="signature-col" style="padding-${isArabic ? 'left' : 'right'}: 20px;">
              <div style="font-weight: bold; color: #64748b; font-size: 10px;">${isArabic ? 'توقيع واعتماد العميل المستفيد' : 'Customer Acceptance Signature'}</div>
              <div class="signature-box" style="line-height:60px; font-weight: bold; color: ${quote.status === 'approved' ? '#047857' : (quote.status === 'rejected' ? '#b91c1c' : '#94a3b8')};">
                ${quote.status === 'approved' 
                  ? (isArabic ? '✓ تم التوقيع الإلكتروني المعتمد' : '✓ ELECTRONICALLY SIGNED & ACCEPTED') 
                  : quote.status === 'rejected' 
                    ? (isArabic ? '✕ تم الرفض' : '✕ REJECTED WITH NOTES') 
                    : (isArabic ? 'بانتظار توقيع المفوض...' : 'Awaiting signature...')}
              </div>
            </td>
            <td class="signature-col" style="text-align: ${isArabic ? 'left' : 'right'};">
              <div style="font-weight: bold; color: #64748b; font-size: 10px; margin-bottom: 5px;">${isArabic ? 'الختم والتوقيع الرسمي لشركة نسما الاولى لأنظمة السلامة' : 'Official Nesma First Safety Systems Seal & Authority'}</div>
              <div style="margin-top: 5px;">
                ${COMPANY_STAMP_SVG}
              </div>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    printHtmlContent(html);
  };

  const handlePrintProformaInvoice = (quote: Quotation) => {
    const isArabic = isRtl;
    const clientTax = quote.clientTaxNumber || client.taxNumber || '';
    const clientCR = quote.clientCrNumber || client.commercialRegister || '';
    const clientAddress = quote.clientNationalAddress || client.nationalAddress || client.locationText || (isArabic ? 'المملكة العربية السعودية - الرياض' : 'Riyadh, KSA');
    const clientPhone = quote.clientPhone || client.phone || client.managerPhone || '05xxxxxxxx';
    const proformaNo = quote.proformaInvoiceNumber || `PI-${quote.id.split('_')[1] || quote.id}`;

    const printPaid = quote.paidAmount || (quote.paymentHistory ? quote.paymentHistory.reduce((s, p) => s + p.amount, 0) : 0);
    const printSurplus = printPaid > quote.grandTotal ? parseFloat((printPaid - quote.grandTotal).toFixed(2)) : 0;
    const printRemaining = printPaid >= quote.grandTotal ? 0 : parseFloat((quote.grandTotal - printPaid).toFixed(2));
    const printStatus = quote.paymentStatus || (printPaid >= quote.grandTotal ? 'paid' : (printPaid > 0 ? 'partially_paid' : 'unpaid'));

    // Dynamic Company Details from Customization or LocalStorage
    const compName = customization?.companyName || 'شركة نسما الأولى لأنظمة السلامة';
    const compTax = customization?.companyTaxNumber || localStorage.getItem('sas_company_tax_number') || '310456789000003';
    const compCR = customization?.unifiedNumber || localStorage.getItem('sas_company_unified_number') || '7003489890';
    const compAddress = customization?.companyAddress || localStorage.getItem('sas_company_address') || (isArabic ? 'الرياض - المملكة العربية السعودية' : 'Riyadh, KSA');
    const compEmail = 'info@nesmaasafety.com';

    const itemsHtml = quote.items.map((item, idx) => `
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold;">${idx + 1}</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: ${isArabic ? 'right' : 'left'};">
          <strong style="color: #0f172a; display: block;">${item.description}</strong>
          ${item.warranty ? `<span style="font-size: 10px; color: #0f766e; font-weight: bold; display: block; margin-top: 2px;">${isArabic ? 'الضمان:' : 'Warranty:'} ${item.warranty}</span>` : ''}
        </td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; font-family: monospace;">${item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${isArabic ? 'ر.س' : 'SAR'}</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: ${isArabic ? 'left' : 'right'}; font-family: monospace; font-weight: bold; color: #0f172a;">${item.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${isArabic ? 'ر.س' : 'SAR'}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html dir="${isArabic ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="utf-8">
        <title>Proforma_Invoice_${proformaNo}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @page { size: A4; margin: 0mm; }
          body { font-family: 'Cairo', 'Inter', sans-serif; background: #ffffff; color: #1e293b; padding: 15mm; margin: 0; font-size: 11px; line-height: 1.5; }
          .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border-bottom: 3px double #0f766e; padding-bottom: 15px; }
          .title { font-size: 18px; font-weight: 900; color: #0f766e; margin: 0; text-transform: uppercase; }
          .sub-title { font-size: 11px; font-weight: bold; color: #334155; margin-top: 2px; }
          .badge-proforma { font-size: 13px; font-weight: 900; border: 2px solid #0f766e; padding: 5px 12px; background: #f0fdf4; color: #0f766e; display: inline-block; border-radius: 6px; }
          
          .grid-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .grid-td { width: 48%; vertical-align: top; padding: 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; }

          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .items-table th { background: #0f172a; color: #ffffff; font-weight: bold; padding: 10px; font-size: 10.5px; border: 1px solid #0f172a; }

          .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .bank-box { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 12px 14px; font-size: 10.5px; color: #115e59; }

          .footer-stamp-section { width: 100%; border-collapse: collapse; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; }
        </style>
      </head>
      <body>
        <!-- Header -->
        <table class="header-table">
          <tr>
            <td style="width: 110px; vertical-align: middle; padding-${isArabic ? 'left' : 'right'}: 15px;">
              <img src="/logo_nesma.png?v=2" style="width: 110px; height: auto; display: block;" referrerPolicy="no-referrer" />
            </td>
            <td style="vertical-align: middle;">
              <h1 class="title">${compName}</h1>
              <div class="sub-title">${isArabic ? 'فاتورة مبدئية للإخطار والسداد' : 'PROFORMA INVOICE FOR PAYMENT'}</div>
              <div style="font-size: 9.5px; color: #64748b; margin-top: 4px;">
                ${isArabic ? 'الرقم الضريبي الموحد للشركة:' : 'Company Tax Reg No:'} <strong>${compTax}</strong> | ${isArabic ? 'الرقم الموحد:' : 'Unified ID:'} <strong>${compCR}</strong>
              </div>
            </td>
            <td style="text-align: ${isArabic ? 'left' : 'right'}; vertical-align: middle; width: 220px;">
              <div class="badge-proforma">
                ${isArabic ? 'فاتورة مبدئية' : 'PROFORMA INVOICE'}
              </div>
              <div style="font-size: 11px; font-weight: bold; color: #0f172a; margin-top: 6px; font-family: monospace;">
                ${isArabic ? 'رقم الفاتورة المبدئية' : 'Proforma No'}: ${proformaNo}
              </div>
              <div style="font-size: 10px; color: #475569; font-family: monospace;">
                ${isArabic ? 'مرجع رقم العرض' : 'Quotation Ref'}: #${quote.id.split('_')[1] || quote.id}
              </div>
              <div style="font-size: 10px; color: #64748b;">
                ${isArabic ? 'تاريخ الإصدار' : 'Issue Date'}: ${quote.date}
              </div>
            </td>
          </tr>
        </table>

        <!-- Client & Supplier Info Box -->
        <table class="grid-table">
          <tr>
            <!-- Client Info Column -->
            <td class="grid-td">
              <div style="font-size: 12px; font-weight: 900; color: #0f766e; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px;">
                📋 ${isArabic ? 'بيانات العميل المستفيد (Bill To)' : 'Client Information'}
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
                <tr>
                  <td style="padding: 3px 0; color: #64748b; font-weight: bold; width: 120px;">${isArabic ? 'اسم العميل / المنشأة:' : 'Client Name:'}</td>
                  <td style="padding: 3px 0; color: #0f172a; font-weight: 800;">${quote.clientName}</td>
                </tr>
                <tr>
                  <td style="padding: 3px 0; color: #64748b; font-weight: bold;">${isArabic ? 'الفرع / الموقع:' : 'Branch / Location:'}</td>
                  <td style="padding: 3px 0; color: #334155; font-weight: 700;">${quote.branchName || 'الفرع الرئيسي'}</td>
                </tr>
                <tr>
                  <td style="padding: 3px 0; color: #64748b; font-weight: bold;">${isArabic ? 'الرقم الضريبي للعميل:' : 'Client Tax Number:'}</td>
                  <td style="padding: 3px 0; color: #0f172a; font-weight: 800; font-family: monospace;">${clientTax}</td>
                </tr>
                <tr>
                  <td style="padding: 3px 0; color: #64748b; font-weight: bold;">${isArabic ? 'السجل التجاري للعميل:' : 'Client CR Number:'}</td>
                  <td style="padding: 3px 0; color: #0f172a; font-weight: 800; font-family: monospace;">${clientCR}</td>
                </tr>
                <tr>
                  <td style="padding: 3px 0; color: #64748b; font-weight: bold;">${isArabic ? 'العنوان الوطني:' : 'National Address:'}</td>
                  <td style="padding: 3px 0; color: #0f172a; font-weight: 700;">${clientAddress}</td>
                </tr>
                <tr>
                  <td style="padding: 3px 0; color: #64748b; font-weight: bold;">${isArabic ? 'رقم الهاتف / الجوال:' : 'Phone Number:'}</td>
                  <td style="padding: 3px 0; color: #0f172a; font-weight: 800; font-family: monospace;">${clientPhone}</td>
                </tr>
              </table>
            </td>

            <td style="width: 4%;"></td>

            <!-- Company Info Column -->
            <td class="grid-td">
              <div style="font-size: 12px; font-weight: 900; color: #0f766e; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px;">
                🏢 ${isArabic ? 'بيانات المورد (Issued By)' : 'Supplier Details'}
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
                <tr>
                  <td style="padding: 3px 0; color: #64748b; font-weight: bold; width: 110px;">${isArabic ? 'اسم المورد:' : 'Supplier Name:'}</td>
                  <td style="padding: 3px 0; color: #0f172a; font-weight: 800;">${compName}</td>
                </tr>
                <tr>
                  <td style="padding: 3px 0; color: #64748b; font-weight: bold;">${isArabic ? 'الرقم الضريبي:' : 'VAT Number:'}</td>
                  <td style="padding: 3px 0; color: #0f172a; font-weight: 800; font-family: monospace;">${compTax}</td>
                </tr>
                <tr>
                  <td style="padding: 3px 0; color: #64748b; font-weight: bold;">${isArabic ? 'الرقم الموحد:' : 'Unified Number:'}</td>
                  <td style="padding: 3px 0; color: #0f172a; font-weight: 800; font-family: monospace;">${compCR}</td>
                </tr>
                <tr>
                  <td style="padding: 3px 0; color: #64748b; font-weight: bold;">${isArabic ? 'العنوان / المركز الرئيسي:' : 'Address / HQ:'}</td>
                  <td style="padding: 3px 0; color: #0f172a; font-weight: 700;">${compAddress}</td>
                </tr>
                <tr>
                  <td style="padding: 3px 0; color: #64748b; font-weight: bold;">${isArabic ? 'البريد الإلكتروني:' : 'Email Address:'}</td>
                  <td style="padding: 3px 0; color: #0f172a; font-weight: 700; font-family: monospace;">${compEmail}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Items Table -->
        <table class="items-table" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #0f172a; color: #ffffff;">
              <th style="width: 40px; padding: 10px; text-align: center;">#</th>
              <th style="padding: 10px; text-align: ${isArabic ? 'right' : 'left'};">${isArabic ? 'الوصف والتفاصيل المعتمدة' : 'Description'}</th>
              <th style="width: 110px; padding: 10px; text-align: center;">${isArabic ? 'سعر الوحدة' : 'Unit Price'}</th>
              <th style="width: 65px; padding: 10px; text-align: center;">${isArabic ? 'الكمية' : 'Qty'}</th>
              <th style="width: 130px; padding: 10px; text-align: ${isArabic ? 'left' : 'right'};">${isArabic ? 'الإجمالي الصافي' : 'Total Price'}</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <!-- Totals & Payment Info Section -->
        <table class="summary-table">
          <tr>
            <td style="vertical-align: top; padding-${isArabic ? 'left' : 'right'}: 15px;">
              <div class="bank-box">
                <div style="font-weight: 900; font-size: 11px; margin-bottom: 6px; color: #0f766e;">
                  💳 ${isArabic ? 'معلومات التحويل والسداد البنكي المعتمد:' : 'Approved Bank Transfer Account:'}
                </div>
                <div style="font-size: 10.5px; line-height: 1.7;">
                  <div>• <strong>${isArabic ? 'مصرف الراجحي (Al Rajhi Bank)' : 'Al Rajhi Bank'}:</strong> <span style="font-family: monospace; font-weight: bold; color: #0f172a; font-size: 11px;">SA3680000561608010200955</span></div>
                  <div style="margin-top: 6px; color: #047857; font-weight: bold; font-size: 10px;">
                    * ${isArabic ? 'يرجى إرفاق إشعار التحويل البنكي ورقم الفاتورة المبدئية عند إتمام السداد.' : 'Please attach bank transfer receipt referencing Proforma No.'}
                  </div>
                </div>
              </div>
            </td>

            <td style="width: 280px; vertical-align: top;">
              <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 10.5px;">
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 6px 12px; font-weight: bold; color: #475569;">${isArabic ? 'المجموع الفرعي:' : 'Subtotal:'}</td>
                  <td style="padding: 6px 12px; font-weight: bold; color: #0f172a; text-align: ${isArabic ? 'left' : 'right'}; font-family: monospace;">${quote.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} SAR</td>
                </tr>
                ${(quote.discountAmount || 0) > 0 ? `
                  <tr style="border-bottom: 1px solid #e2e8f0; color: #dc2626;">
                    <td style="padding: 6px 12px; font-weight: bold;">${isArabic ? 'خصم خاص للعميل:' : 'Client Discount:'}</td>
                    <td style="padding: 6px 12px; font-weight: bold; text-align: ${isArabic ? 'left' : 'right'}; font-family: monospace;">-${(quote.discountAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} SAR</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0; background: #f1f5f9;">
                    <td style="padding: 6px 12px; font-weight: bold; color: #0f172a;">${isArabic ? 'الإجمالي الخاضع للضريبة:' : 'Taxable Amount:'}</td>
                    <td style="padding: 6px 12px; font-weight: bold; color: #0f172a; text-align: ${isArabic ? 'left' : 'right'}; font-family: monospace;">${(quote.taxableSubtotal ?? (quote.subtotal - (quote.discountAmount || 0))).toLocaleString(undefined, { minimumFractionDigits: 2 })} SAR</td>
                  </tr>
                ` : ''}
                <tr style="border-bottom: 1px solid #cbd5e1;">
                  <td style="padding: 6px 12px; font-weight: bold; color: #475569;">${isArabic ? 'ضريبة القيمة المضافة (15%):' : 'VAT (15%):'}</td>
                  <td style="padding: 6px 12px; font-weight: bold; color: #0f172a; text-align: ${isArabic ? 'left' : 'right'}; font-family: monospace;">${quote.vat.toLocaleString(undefined, { minimumFractionDigits: 2 })} SAR</td>
                </tr>
                <tr style="font-size: 13px; font-weight: 900; background: #f0fdf4; color: #047857;">
                  <td style="padding: 8px 12px;">${isArabic ? 'الإجمالي النهائي المطلوب:' : 'Grand Total:'}</td>
                  <td style="padding: 8px 12px; text-align: ${isArabic ? 'left' : 'right'}; font-family: monospace;">${quote.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} SAR</td>
                </tr>
                ${printPaid > 0 ? `
                  <tr style="border-top: 2px solid #cbd5e1; border-bottom: 1px solid #e2e8f0; background: #f8fafc;">
                    <td style="padding: 6px 12px; font-weight: bold; color: #047857;">${isArabic ? 'المبلغ المسدد الفعلي:' : 'Actual Paid Amount:'}</td>
                    <td style="padding: 6px 12px; font-weight: bold; color: #047857; text-align: ${isArabic ? 'left' : 'right'}; font-family: monospace;">${printPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })} SAR</td>
                  </tr>
                  ${printSurplus > 0 ? `
                    <tr style="border-bottom: 1px solid #e2e8f0; background: #ecfdf5; color: #065f46;">
                      <td style="padding: 6px 12px; font-weight: bold;">${isArabic ? 'رصيد زائد للعميل (فائض):' : 'Client Credit Surplus:'}</td>
                      <td style="padding: 6px 12px; font-weight: bold; text-align: ${isArabic ? 'left' : 'right'}; font-family: monospace;">+${printSurplus.toLocaleString(undefined, { minimumFractionDigits: 2 })} SAR</td>
                    </tr>
                  ` : ''}
                  ${printRemaining > 0 ? `
                    <tr style="border-bottom: 1px solid #e2e8f0; background: #fff1f2; color: #be123c;">
                      <td style="padding: 6px 12px; font-weight: bold;">${isArabic ? 'المتبقي للسداد:' : 'Remaining Balance:'}</td>
                      <td style="padding: 6px 12px; font-weight: bold; text-align: ${isArabic ? 'left' : 'right'}; font-family: monospace;">${printRemaining.toLocaleString(undefined, { minimumFractionDigits: 2 })} SAR</td>
                    </tr>
                  ` : ''}
                  <tr style="background: ${printStatus === 'paid' ? '#f0fdf4' : printStatus === 'partially_paid' ? '#fffbeb' : '#f8fafc'}; color: ${printStatus === 'paid' ? '#15803d' : printStatus === 'partially_paid' ? '#b45309' : '#475569'}; font-weight: bold;">
                    <td style="padding: 6px 12px;">${isArabic ? 'حالة السداد:' : 'Payment Status:'}</td>
                    <td style="padding: 6px 12px; text-align: ${isArabic ? 'left' : 'right'};">
                      ${printStatus === 'paid' 
                        ? (printSurplus > 0 ? (isRtl ? `✓ مسدد بالكامل (+فائض)` : `✓ Fully Paid (+Surplus)`) : (isRtl ? '✓ مسدد بالكامل' : '✓ Paid in Full'))
                        : printStatus === 'partially_paid' 
                          ? (isRtl ? '⏳ مسدد جزئياً' : '⏳ Partially Paid') 
                          : (isRtl ? '🔴 بانتظار السداد' : '🔴 Unpaid')}
                    </td>
                  </tr>
                ` : ''}
              </table>
            </td>
          </tr>
        </table>

        <!-- Signatures & Stamp Section (أسفل الصفحة) -->
        <table class="footer-stamp-section" style="width: 100%; border-collapse: collapse; margin-top: 35px;">
          <tr>
            <td style="width: 50%; vertical-align: bottom; padding-${isArabic ? 'left' : 'right'}: 20px;">
              <div style="font-size: 10px; font-weight: bold; color: #64748b; margin-bottom: 4px;">${isArabic ? 'موافقة واعتماد العميل المستفيد:' : 'Customer Acceptance:'}</div>
              <div style="border: 1px solid #cbd5e1; background: #fafafa; border-radius: 8px; padding: 12px; text-align: center; height: 50px; line-height: 50px; font-weight: bold; color: #047857; font-size: 11px;">
                ✓ ${isArabic ? 'تم اعتماد القبول والسداد إلكترونياً' : 'ACCEPTED & APPROVED ELECTRONICALLY'}
              </div>
            </td>
            <td style="width: 50%; vertical-align: bottom; text-align: ${isArabic ? 'left' : 'right'};">
              <div style="font-size: 10px; font-weight: bold; color: #0f766e; margin-bottom: 6px;">
                ${isArabic ? 'اسم وختم الشركة الرسمي (شركة نسما الأولى لأنظمة السلامة):' : 'Official Stamp & Authority - Nesma First Safety Systems'}
              </div>
              <div style="display: inline-block;">
                ${COMPANY_STAMP_SVG}
              </div>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    printHtmlContent(html);
  };

  const branchesList = client.branches || [];
  const hasIndependentBranchContracts = client.branches && client.branches.length > 0 && client.branches.some(br => br.contractStartDate || br.contractEndDate || br.contractNumber);
  const uniqueCities = Array.from(new Set(branchesList.map(b => b.city).filter(Boolean)));
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [searchBranchQuery, setSearchBranchQuery] = useState<string>('');
  const [activeStatusFilter, setActiveStatusFilter] = useState<'all' | 'overdue' | 'upcoming' | 'completed' | 'extinguisher'>('all');

  const clientVisits = visits.filter(v => v.clientId === client.id);
  const completedVisits = clientVisits.filter(v => v.status === 'completed');
  const pendingVisits = clientVisits.filter(v => v.status === 'pending');
  const assignedTech = technicians.find(tech => tech.id === client.assignedTechnicianId);

  // Find contract owner (manager)
  const getContractOwnerName = () => {
    const supervisorId = client.contractSupervisorId || client.assignedTechnicianId;
    if (supervisorId === 'admin') {
      return adminName;
    }
    const foundManager = technicians.find(t => t.id === supervisorId);
    return foundManager ? foundManager.name : adminName;
  };

  const getContractOwnerPhone = () => {
    const supervisorId = client.contractSupervisorId || client.assignedTechnicianId;
    if (supervisorId === 'admin') {
      return managerPhone;
    }
    const foundManager = technicians.find(t => t.id === supervisorId);
    return foundManager ? foundManager.phone : managerPhone;
  };

  const getClientFireExtinguisherAlerts = () => {
    const alerts: { id: string; name: string; fireExtinguisherExpiry: string; isBranch?: boolean }[] = [];
    const hasBranches = client.branches && client.branches.length > 0;
    if (hasBranches) {
      client.branches!.forEach(br => {
        if (br.fireExtinguisherExpiry) {
          const status = getFireExtinguisherStatus(br.fireExtinguisherExpiry);
          if (status === 'expired' || status === 'expiring') {
            alerts.push({
              id: br.id || `branch_${br.name}`,
              name: br.name,
              fireExtinguisherExpiry: br.fireExtinguisherExpiry,
              isBranch: true
            });
          }
        }
      });
      if (client.fireExtinguisherExpiry) {
        const status = getFireExtinguisherStatus(client.fireExtinguisherExpiry);
        if (status === 'expired' || status === 'expiring') {
          alerts.push({
            id: 'hq',
            name: isRtl ? 'الإدارة الرئيسية' : 'HQ',
            fireExtinguisherExpiry: client.fireExtinguisherExpiry,
            isBranch: false
          });
        }
      }
    } else {
      if (client.fireExtinguisherExpiry) {
        const status = getFireExtinguisherStatus(client.fireExtinguisherExpiry);
        if (status === 'expired' || status === 'expiring') {
          alerts.push({
            id: 'client-main',
            name: client.name,
            fireExtinguisherExpiry: client.fireExtinguisherExpiry,
            isBranch: false
          });
        }
      }
    }
    return alerts;
  };

  const clientExtinguisherAlerts = getClientFireExtinguisherAlerts();

  // Filter visits dynamically based on selected city/branch
  const displayedVisits = clientVisits.filter(visit => {
    if (selectedCity !== 'all') {
      // Find branch matching visit.branchName
      const visitBranch = branchesList.find(b => b.name === visit.branchName);
      if (!visitBranch || visitBranch.city !== selectedCity) return false;
    }
    if (selectedBranchId !== 'all') {
      const selectedBranch = branchesList.find(b => b.id === selectedBranchId);
      if (!selectedBranch || visit.branchName !== selectedBranch.name) return false;
    }
    if (searchBranchQuery.trim() !== '') {
      const query = searchBranchQuery.toLowerCase().trim();
      const matchBranch = visit.branchName && visit.branchName.toLowerCase().includes(query);
      const matchClient = (visit.clientName || client.name || '').toLowerCase().includes(query);
      if (!matchBranch && !matchClient) return false;
    }
    return true;
  });

  // Calculate safety score out of 100 dynamically
  let safetyScore = 100;
  if (completedVisits.length > 0) {
    const passedCount = completedVisits.filter(v => v.result === 'passed').length;
    const defectCount = completedVisits.filter(v => v.result === 'has_defects').length;
    const criticalCount = completedVisits.filter(v => v.result === 'critical_issues').length;
    
    // Weight logic: 100 for pass, 70 for minor defects, 30 for critical defects
    const totalPoints = (passedCount * 100) + (defectCount * 70) + (criticalCount * 30);
    safetyScore = Math.round(totalPoints / completedVisits.length);
  }

  // Calculate Fire Extinguisher Expiry Alerts
  const todayVal = new Date();
  todayVal.setHours(0, 0, 0, 0);
  const expiryDate = client.fireExtinguisherExpiry ? new Date(client.fireExtinguisherExpiry) : null;
  if (expiryDate) {
    expiryDate.setHours(0, 0, 0, 0);
  }
  const isExpired = expiryDate ? expiryDate.getTime() < todayVal.getTime() : false;
  const isExpiringSoon = expiryDate ? (!isExpired && (expiryDate.getTime() - todayVal.getTime()) <= 30 * 24 * 60 * 60 * 1000) : false;

  // Handle client posting inquiry
  const handleInquirySubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!inquiryText.trim()) return;
    
    onSubmitInquiry(client.id, inquiryText.trim());
    setInquiryText('');
    alert(isRtl 
      ? 'تم إرسال ملاحظتك / استفسارك بنجاح إلى الإدارة والمشرفين للمتابعة الفورية!' 
      : 'Your inquiry/comment was dispatched to Nesma First Administrators successfully!'
    );
  };

  return (
    <div className="space-y-6 animate-fade-in text-start">
      <div className="space-y-6 print:hidden">
      
      {/* Top Welcome Title Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 text-white rounded-3xl p-6 shadow-xl border border-slate-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start w-full">
          <img src="/logo_nesma.png?v=2" className="w-24 h-12 sm:w-32 sm:h-16 object-contain shrink-0" alt="Nesma Logo" referrerPolicy="no-referrer" />
          <div className="space-y-2 font-sans flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-500/10 text-teal-400 font-semibold text-xs rounded-full border border-teal-500/15">
              <Shield className="w-3.5 h-3.5" />
              <span>{isRtl ? 'بوابة العميل المعتمدة لأعمال صيانة معدات السلامة' : 'Nesma First Certified Client Safety Portal'}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{dt(client.name)}</h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              {isRtl 
                ? 'مرحبا بك في لوحة التحكم الموحدة لأعمال الصيانة الخاصة بعقدك. هنا يمكنك متابعة تقارير الصيانة الدورية لمعدات مكافحة الحريق، وفحص شبكات الإنذار والمخارج المعتمدة من قبل شركة نسما الاولى لأنظمة السلامة.' 
                : 'Welcome to your safe facility dashboard. Access and control periodic fire alarm checks, safety certificates, and safety reviews uploaded directly by our certified technicians.'}
            </p>
            <div className="flex flex-wrap gap-2 items-center pt-1.5 text-xs">
              <span className="bg-white/10 text-white px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1 font-bold">
                👨‍💼 {isRtl ? 'المسئول عن العقد:' : 'Contract Owner:'} {dt(getContractOwnerName())}
              </span>
              {getContractOwnerPhone() && (
                <span className="bg-teal-500/20 text-teal-300 px-2.5 py-1 rounded-lg border border-teal-500/10 font-bold font-mono">
                  📞 {getContractOwnerPhone()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Corporate Metadata Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Fire Extinguisher Validity Period Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
            isExpired 
              ? 'bg-rose-50 border-rose-100 text-rose-600 font-bold' 
              : isExpiringSoon 
                ? 'bg-amber-50 border-amber-150 text-amber-600 animate-pulse font-bold' 
                : 'bg-teal-50 border-teal-100 text-safety-emerald font-bold'
          }`}>
            <span>🧯</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block font-medium uppercase tracking-wider">
              {t.fireExtinguisherExpiryLabel}
            </span>
            <span className={`font-mono text-xs font-bold block mt-0.5 ${
              isExpired ? 'text-rose-605' : isExpiringSoon ? 'text-amber-605' : 'text-slate-800'
            }`}>
              {client.fireExtinguisherExpiry || t.notSpecified}
            </span>
            {isExpired && (
              <span className="text-[8px] font-bold text-rose-600 block leading-none mt-0.5">{t.expiredAlert}</span>
            )}
            {isExpiringSoon && (
              <span className="text-[8px] font-bold text-amber-605 block leading-none mt-0.5">{t.expiringSoonAlert}</span>
            )}
          </div>
        </div>

        {/* Contract Code Card */}
        <div 
          onClick={() => {
            setViewingFile({
              name: client.contractFile?.name || (isRtl ? 'وثيقة عقد صيانة رقم ' + client.contractNumber : 'Contract Certificate #' + client.contractNumber),
              url: client.contractFile?.url || '#simulated',
              clientName: client.name,
              contractNumber: client.contractNumber,
              type: 'contract'
            });
          }}
          className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-between hover:border-sky-500 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-sky-50 group-hover:bg-sky-100 rounded-xl flex items-center justify-center text-sky-600 shrink-0 transition">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block font-medium uppercase tracking-wider">
                {isRtl ? 'رقم العقد المعتمد' : 'Registered Contract'}
              </span>
              <span className="font-mono text-xs sm:text-sm font-bold text-slate-800 block mt-0.5 sm:mt-0 flex items-center gap-1.5">
                {client.contractNumber}
                <span className="text-[10px] text-sky-500 font-bold hover:underline">({isRtl ? 'عرض وتحميل العقد المرفق' : 'View Attachments'})</span>
              </span>
            </div>
          </div>
          <div className="text-slate-400 group-hover:text-sky-600 transition">
            <Eye className="w-5 h-5" />
          </div>
        </div>

        {/* Contract Validity Period */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col gap-3">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="flex-grow bg-white">
              <span className="text-[10px] text-slate-500 block font-medium uppercase tracking-wider mb-1">
                {isRtl ? 'صلاحية ومدة العقد' : 'Contract Validity'}
              </span>
              
              {hasIndependentBranchContracts ? (
                <span className="font-mono text-xs font-bold text-slate-400 block mt-0.5">
                  N/A
                </span>
              ) : client.branches && client.branches.length > 0 && client.branches.some(br => 
                (br.contractStartDate && br.contractStartDate !== client.contractStartDate) || 
                (br.contractEndDate && br.contractEndDate !== client.contractEndDate)
              ) ? (
                <div className="space-y-1.5 mt-2 max-h-[140px] overflow-y-auto pr-1">
                  {client.branches.map((br) => {
                    const brStart = br.contractStartDate || client.contractStartDate;
                    const brEnd = br.contractEndDate || client.contractEndDate;
                    const isBrExpired = brEnd < new Date().toISOString().split('T')[0];
                    return (
                      <div 
                        key={br.id || br.name} 
                        onClick={() => {
                          setViewingFile({
                            name: br.contractFile?.name || (isRtl ? 'عقد فرع ' + br.name : 'Branch Contract: ' + br.name),
                            url: br.contractFile?.url || '#simulated',
                            clientName: `${client.name} - ${br.name}`,
                            contractNumber: br.contractNumber || client.contractNumber,
                            type: 'contract'
                          });
                        }}
                        className="flex justify-between items-center text-[10px] bg-slate-50 hover:bg-slate-100 p-2 rounded-xl border border-slate-200 gap-2 cursor-pointer transition hover:border-sky-500 group"
                      >
                        <span className="font-bold text-slate-800 truncate max-w-[150px] group-hover:text-sky-600 transition">🏢 {br.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Eye className="w-3 h-3 text-slate-400 group-hover:text-sky-600 transition" />
                          <span className={`font-mono px-2 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                            isBrExpired ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {brStart} {isRtl ? 'إلى' : 'to'} {brEnd}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span className="font-mono text-xs font-bold text-slate-850 block mt-0.5">
                  {client.contractStartDate} {isRtl ? 'إلى' : 'to'} {client.contractEndDate}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Facility Safety Rank Index */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 font-bold ${
            safetyScore >= 85 ? 'bg-emerald-600' : safetyScore >= 60 ? 'bg-amber-500' : 'bg-rose-600'
          }`}>
            <span>{safetyScore}%</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block font-medium uppercase tracking-wider">
              {isRtl ? 'مؤشر أمان ومطابقة المنشأة' : 'Facility Safety Grade'}
            </span>
            <span className="text-xs font-bold block mt-0.5">
              {safetyScore >= 85 
                ? (isRtl ? 'ممتاز ومطابق للدفاع المدني' : 'Excellent, Highly Safe') 
                : safetyScore >= 60 
                  ? (isRtl ? 'آمن مع ملاحظات طفيفة قيد المعالجة' : 'Moderately Safe')
                  : (isRtl ? 'يحتاج صيانة عاجلة!' : 'Requires Urgent Actions')
              }
            </span>
          </div>
        </div>

      </div>

      {/* Sub tabs for switching */}
      <div className="flex border-b border-slate-200 gap-4 overflow-x-auto no-scrollbar whitespace-nowrap -mx-4 px-4 sm:mx-0 sm:px-0">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`pb-2.5 text-[11px] sm:text-xs font-bold border-b-2 transition-all shrink-0 ${
            activeSubTab === 'overview' 
              ? 'border-safety-emerald text-safety-emerald font-black' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          {isRtl ? 'لوحة المتابعة وجدول الزيارات والصيانة' : 'Dashboard & Inspection Schedule'}
        </button>
        {hasIndependentBranchContracts && (
          <button
            onClick={() => setActiveSubTab('branches')}
            className={`pb-2.5 text-[11px] sm:text-xs font-bold border-b-2 transition-all shrink-0 ${
              activeSubTab === 'branches' 
                ? 'border-safety-emerald text-safety-emerald font-black' 
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {isRtl ? 'فروع الشركة' : 'Company Branches'}
          </button>
        )}
        <button
          onClick={() => setActiveSubTab('emergency')}
          className={`pb-2.5 text-[11px] sm:text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 relative shrink-0 ${
            activeSubTab === 'emergency' 
              ? 'border-safety-emerald text-safety-emerald font-black' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>{t.emergencyVisitsTab || (isRtl ? 'الزيارات الطارئة 🚨' : 'Emergency Visits 🚨')}</span>
          {(() => {
            const clientPendingCount = emergencyVisits.filter(v => v.clientId === client.id && v.status === 'pending').length;
            return clientPendingCount > 0 ? (
              <span className="px-1.5 py-0.5 text-[9px] bg-rose-100 text-rose-800 rounded-full font-bold">
                {clientPendingCount}
              </span>
            ) : null;
          })()}
        </button>
        <button
          onClick={() => setActiveSubTab('extinguishers')}
          className={`pb-2.5 text-[11px] sm:text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 relative shrink-0 ${
            activeSubTab === 'extinguishers' 
              ? 'border-safety-emerald text-safety-emerald font-black' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>{isRtl ? 'صيانة طفايات الحريق 🧯' : 'Extinguisher Maintenance 🧯'}</span>
          {(() => {
            const rcCount = extinguisherReceipts.filter(r => r.clientId === client.id).length;
            return rcCount > 0 ? (
              <span className="px-1.5 py-0.5 text-[9px] bg-amber-100 text-amber-800 rounded-full font-bold">
                {rcCount}
              </span>
            ) : null;
          })()}
        </button>
        <button
          onClick={() => setActiveSubTab('quotations')}
          className={`pb-2.5 text-[11px] sm:text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 relative shrink-0 ${
            activeSubTab === 'quotations' 
              ? 'border-safety-emerald text-safety-emerald font-black' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>{isRtl ? 'عروض الأسعار 📄' : 'Quotations 📄'}</span>
          {(() => {
            const clientQuotes = quotations.filter(q => q.clientId === client.id);
            return clientQuotes.length > 0 ? (
              <span className="px-1.5 py-0.5 text-[9px] bg-indigo-100 text-indigo-800 rounded-full font-bold">
                {clientQuotes.length}
              </span>
            ) : null;
          })()}
        </button>
        <button
          onClick={() => setActiveSubTab('workOrders')}
          className={`pb-2.5 text-[11px] sm:text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 relative shrink-0 ${
            activeSubTab === 'workOrders' 
              ? 'border-safety-emerald text-safety-emerald font-black' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>{isRtl ? 'أوامر العمل 🛠️' : 'Work Orders 🛠️'}</span>
          {(() => {
            const clientWorkOrders = quotations.filter(q => q.clientId === client.id && q.status === 'approved');
            return clientWorkOrders.length > 0 ? (
              <span className="px-1.5 py-0.5 text-[9px] bg-emerald-100 text-emerald-800 rounded-full font-bold">
                {clientWorkOrders.length}
              </span>
            ) : null;
          })()}
        </button>
        <button
          onClick={() => setActiveSubTab('proformaInvoices')}
          className={`pb-2.5 text-[11px] sm:text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 relative shrink-0 ${
            activeSubTab === 'proformaInvoices' 
              ? 'border-safety-emerald text-safety-emerald font-black' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>{isRtl ? 'الفواتير المبدئية 📑' : 'Proforma Invoices 📑'}</span>
          {(() => {
            const clientApprovedQuotes = quotations.filter(q => q.clientId === client.id && (q.status === 'approved' || q.isIndependentInvoice));
            return clientApprovedQuotes.length > 0 ? (
              <span className="px-1.5 py-0.5 text-[9px] bg-teal-100 text-teal-800 rounded-full font-bold">
                {clientApprovedQuotes.length}
              </span>
            ) : null;
          })()}
        </button>
        <button
          onClick={() => setActiveSubTab('archive')}
          className={`pb-2.5 text-[11px] sm:text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 relative shrink-0 ${
            activeSubTab === 'archive' 
              ? 'border-safety-emerald text-safety-emerald font-black' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>{isRtl ? 'أرشيف التقارير والبحث 🔍' : 'Reports Archive & Search 🔍'}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('licenses')}
          className={`pb-2.5 text-[11px] sm:text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 relative shrink-0 cursor-pointer ${
            activeSubTab === 'licenses' 
              ? 'border-safety-emerald text-safety-emerald font-black' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>{isRtl ? 'التراخيص 🏛️' : 'Facility Licenses 🏛️'}</span>
          {(() => {
            const count = (client.licenses || []).filter(l => l.fileUrl || l.documentNumber).length;
            return (
              <span className={`px-1.5 py-0.5 text-[9px] rounded-full font-bold ${
                count > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
              }`}>
                {count}/6
              </span>
            );
          })()}
        </button>
        <button
          onClick={() => setActiveSubTab('inquiries')}
          className={`pb-2.5 text-[11px] sm:text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 relative shrink-0 ${
            activeSubTab === 'inquiries' 
              ? 'border-safety-emerald text-safety-emerald font-black' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>{isRtl ? 'الملاحظات والطلبات الخاصة بي' : 'Inquiries & Feedback Log'}</span>
          {client.inquiries && client.inquiries.length > 0 && (
            <span className="px-1.5 py-0.5 text-[9px] bg-sky-100 text-sky-800 rounded-full font-bold">
              {client.inquiries.length}
            </span>
          )}
        </button>

        {/* Dynamic Custom Pages created by Super Admin for Clients */}
        {customization?.customPages?.filter(p => p.enabled && (p.targetAudience === 'all' || p.targetAudience === 'clients')).map(page => (
          <button
            key={page.id}
            onClick={() => setActiveSubTab(`page_${page.id}`)}
            className={`pb-2.5 text-[11px] sm:text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
              activeSubTab === `page_${page.id}`
                ? 'border-safety-emerald text-safety-emerald font-black' 
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>{page.icon || '📜'}</span>
            <span>{page.title}</span>
          </button>
        ))}
      </div>

      {/* Outer block according to tab */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          
          {/* 🏙️ City & Branch Selector Widget */}
          {branchesList.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-250/80 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-150/50">
                <div 
                  onClick={() => setIsBranchesSectionCollapsed(!isBranchesSectionCollapsed)}
                  className="flex items-start gap-3 cursor-pointer select-none group flex-1 text-start"
                >
                  <span className="text-xl bg-slate-50 p-2 rounded-2xl group-hover:bg-slate-100 transition-colors shrink-0">🏙️</span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-900 text-sm group-hover:text-safety-emerald transition-colors">
                        {isRtl ? 'مستعرض الفروع حسب المنطقة والمدينة' : 'Branch Explorer by City'}
                      </h3>
                      {isBranchesSectionCollapsed && (
                        <span className="text-[10px] bg-teal-50 text-teal-800 font-extrabold px-2 py-0.5 rounded-lg border border-teal-150 animate-fade-in shrink-0">
                          {selectedCity === 'all' 
                            ? (isRtl ? 'جميع المدن والمناطق' : 'All Cities') 
                            : `🏙️ ${selectedCity}`
                          }
                          {selectedBranchId !== 'all' && (() => {
                            const activeBr = branchesList.find(b => b.id === selectedBranchId);
                            return activeBr ? ` › 📍 ${activeBr.name}` : '';
                          })()}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {isRtl ? 'اختر المدينة من القائمة المنسدلة لعرض وتصفية الفروع التابعة لها (انقر هنا للطي/التوسيع)' : 'Select a city to filter and view the branches & scheduling (Click to toggle)'}
                    </p>
                  </div>
                </div>
                
                {/* Right actions */}
                <div className="flex items-center gap-2 self-end sm:self-auto justify-end flex-wrap sm:flex-nowrap">
                  {/* Search Input */}
                  <div className="min-w-[180px]" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      placeholder={isRtl ? '🔍 بحث باسم العميل / المنشأة...' : '🔍 Search Client / Venue...'}
                      value={searchBranchQuery}
                      onChange={(e) => {
                        setSearchBranchQuery(e.target.value);
                        setSelectedBranchId('all');
                      }}
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-805 focus:outline-none focus:border-safety-emerald shadow-sm"
                    />
                  </div>

                  {/* City Dropdown */}
                  <div className="min-w-[180px]" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={selectedCity}
                      onChange={(e) => {
                        setSelectedCity(e.target.value);
                        setSelectedBranchId('all');
                      }}
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-805 focus:outline-none focus:border-safety-emerald shadow-sm cursor-pointer"
                    >
                      <option value="all">{isRtl ? '📂 جميع المدن والمناطق' : '📂 All Cities & Regions'}</option>
                      {uniqueCities.map((city) => (
                        <option key={city} value={city}>
                          🏙️ {city}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Toggle arrow */}
                  <button
                    type="button"
                    onClick={() => setIsBranchesSectionCollapsed(!isBranchesSectionCollapsed)}
                    className="p-2 hover:bg-slate-50 active:bg-slate-100 rounded-xl transition-colors text-slate-500 hover:text-slate-900 cursor-pointer"
                    title={isRtl ? 'توسيع / طي' : 'Toggle Expand/Collapse'}
                  >
                    {isBranchesSectionCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Branches belonging to selected city (Collapsible container) */}
              {!isBranchesSectionCollapsed && (
                <div className="animate-fade-in pt-1">
                  {(() => {
                    let filteredBranches = selectedCity === 'all' 
                      ? branchesList 
                      : branchesList.filter(b => b.city === selectedCity);

                    if (searchBranchQuery.trim() !== '') {
                      const query = searchBranchQuery.toLowerCase().trim();
                      filteredBranches = filteredBranches.filter(b => 
                        b.name.toLowerCase().includes(query) || 
                        (b.city || '').toLowerCase().includes(query)
                      );
                    }

                    if (filteredBranches.length === 0) {
                      return (
                        <p className="text-xs text-slate-400 italic">
                          {isRtl ? 'لا توجد فروع مسجلة لهذه المدينة.' : 'No branches found for this city.'}
                        </p>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {/* Reset or 'All branches' card */}
                        <button
                          onClick={() => setSelectedBranchId('all')}
                          className={`p-4 rounded-2xl text-start border transition-all relative overflow-hidden flex flex-col justify-between h-28 cursor-pointer ${
                            selectedBranchId === 'all'
                              ? 'bg-gradient-to-br from-teal-900 to-teal-950 border-teal-980 text-white shadow-md'
                              : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          <div>
                            <span className="text-lg">🏢</span>
                            <h4 className="font-bold text-xs mt-1.5">{isRtl ? 'كل فروع المدينة' : 'All Branches'}</h4>
                            <p className={`text-[9px] mt-1 line-clamp-2 leading-relaxed ${selectedBranchId === 'all' ? 'text-teal-200' : 'text-slate-500'}`}>
                              {isRtl ? 'تصفية جميع الفروع وجدول الكشوفات المشتركة للمنطقة' : 'Display all inspections for selected city.'}
                            </p>
                          </div>
                          <span className={`text-[9px] font-bold self-end uppercase ${selectedBranchId === 'all' ? 'text-teal-300' : 'text-slate-500'}`}>
                            {isRtl ? `العدد: ${filteredBranches.length}` : `Count: ${filteredBranches.length}`}
                          </span>
                        </button>

                        {filteredBranches.map((br) => {
                          const isSelected = selectedBranchId === br.id;
                          const brVisits = clientVisits.filter(v => v.branchName === br.name);
                          const brCompleted = brVisits.filter(v => v.status === 'completed').length;
                          const brPending = brVisits.filter(v => v.status === 'pending').length;
                          const brTechId = br.assignedTechnicianId || client.assignedTechnicianId;
                          const brTech = technicians.find(t => t.id === brTechId) || assignedTech;

                          return (
                            <button
                              key={br.id}
                              onClick={() => setSelectedBranchId(br.id)}
                              className={`p-4 rounded-2xl text-start border transition-all relative overflow-hidden flex flex-col justify-between h-30 cursor-pointer ${
                                isSelected
                                  ? 'bg-gradient-to-br from-teal-900 to-teal-950 border-teal-980 text-white shadow-md'
                                  : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex justify-between items-start gap-1">
                                  <span className="font-extrabold text-xs line-clamp-1">📍 {br.name}</span>
                                  <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                                    isSelected ? 'bg-teal-805 text-teal-200' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {br.city}
                                  </span>
                                </div>
                                {br.locationText && (
                                  <p className={`text-[9px] line-clamp-1 ${isSelected ? 'text-teal-150' : 'text-slate-400'}`}>
                                    {br.locationText}
                                  </p>
                                )}
                                {brTech && (
                                  <p className={`text-[9.5px] flex items-center gap-1 font-sans ${isSelected ? 'text-teal-200' : 'text-slate-500'}`}>
                                    <span>👷‍♂️</span>
                                    <span className="font-bold">
                                      {brTech.role === 'admin' ? (isRtl ? 'المسئول عن العقد:' : 'Contract Owner:') : (isRtl ? 'الفني المسؤول:' : 'Technician:') } {brTech.name}
                                    </span>
                                  </p>
                                )}
                                {br.fireExtinguisherExpiry && (
                                  <div className="pt-0.5">
                                    <span className={`inline-flex items-center gap-1 text-[9px] font-mono font-black px-2 py-0.5 rounded border ${
                                      (() => {
                                        const expiry = new Date(br.fireExtinguisherExpiry);
                                        expiry.setHours(0,0,0,0);
                                        const isExp = expiry.getTime() < todayVal.getTime();
                                        const isExpSoon = !isExp && (expiry.getTime() - todayVal.getTime()) <= 30 * 24 * 60 * 60 * 1000;
                                        if (isExp) return 'bg-rose-50 border-rose-200 text-rose-700 font-extrabold';
                                        if (isExpSoon) return 'bg-amber-50 border-amber-200 text-amber-700 font-extrabold animate-pulse';
                                        return isSelected ? 'bg-teal-950 border-teal-850 text-teal-300' : 'bg-emerald-50 border-emerald-100 text-emerald-800';
                                      })()
                                    }`}>
                                      🧯 {br.fireExtinguisherExpiry}
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="flex justify-between items-center text-[9px] font-mono mt-1 pt-1 border-t border-dotted border-slate-200/40">
                                <span className={isSelected ? 'text-emerald-300' : 'text-emerald-600'}>
                                  ✅ {brCompleted} {isRtl ? 'مكتملة' : 'done'}
                                </span>
                                <span className={isSelected ? 'text-amber-200' : 'text-amber-600'}>
                                  ⏳ {brPending} {isRtl ? 'مجدولة' : 'pending'}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          <div className="space-y-6">
            
            {/* Main List of Visits (Full width) */}
            <div className="space-y-6">



              <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm space-y-4">
                {activeStatusFilter === 'extinguisher' && clientExtinguisherAlerts.length > 0 && (
                  <div className="bg-amber-50/60 border border-amber-200/80 p-4 rounded-xl space-y-2.5 animate-fade-in text-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🧯</span>
                      <h4 className="font-bold text-amber-900 text-xs">
                        {isRtl ? 'فروع المنشأة ذات طفايات الحريق المنتهية أو القريبة من الانتهاء:' : 'Facility Branches with Expired or Expiring Fire Extinguishers:'}
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {clientExtinguisherAlerts.map(alert => {
                        const status = getFireExtinguisherStatus(alert.fireExtinguisherExpiry);
                        const isExpired = status === 'expired';
                        return (
                          <div key={alert.id} className="bg-white p-3 rounded-lg border border-amber-100 flex items-center justify-between gap-3 shadow-sm">
                            <div className="space-y-0.5 text-start">
                              <span className="text-xs font-bold text-slate-800 block">📍 {dt(alert.name)}</span>
                              <span className="text-[10px] text-slate-450 block">{isRtl ? 'تاريخ الصلاحية المسجل:' : 'Registered Expiry:'} <span className="font-mono font-bold">{alert.fireExtinguisherExpiry}</span></span>
                            </div>
                            <span className={`px-2 py-0.5 text-[9px] font-black rounded shrink-0 ${
                              isExpired ? 'bg-rose-105 text-rose-800' : 'bg-amber-105 text-amber-800 animate-pulse'
                            }`}>
                              {isExpired ? (isRtl ? 'منتهية الصلاحية 🚨' : 'EXPIRED 🚨') : (isRtl ? 'قاربت على الانتهاء ⚠️' : 'EXPIRING SOON ⚠️')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div 
                  onClick={() => setIsVisitsSectionCollapsed(!isVisitsSectionCollapsed)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-150/50 font-sans cursor-pointer select-none group"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Clock className="w-5 h-5 text-safety-emerald group-hover:scale-110 transition-transform" />
                    <h3 className="font-bold text-slate-900 text-sm group-hover:text-safety-emerald transition-colors text-start">
                      {activeStatusFilter === 'all' && (isRtl ? 'جدول زيارات الفحص وأرشيف التقارير والصور المصفاة' : 'Site Visits & Archived Reports')}
                      {activeStatusFilter === 'overdue' && (isRtl ? 'الزيارات المتأخرة المستحقة ⚠️' : 'Overdue Inspection Visits ⚠️')}
                      {activeStatusFilter === 'upcoming' && (isRtl ? 'الزيارات القادمة أو القريبة المخططة 📅' : 'Upcoming/Soon Planned Visits 📅')}
                      {activeStatusFilter === 'completed' && (isRtl ? 'سجل الزيارات المنجزة والتقارير المعتمدة ✅' : 'Completed Inspections & Certified Reports ✅')}
                      {activeStatusFilter === 'extinguisher' && (isRtl ? 'زيارات الفروع ذات طفايات منتهية/منذرة 🧯' : 'Visits for Branches with Expiring/Expired Extinguishers 🧯')}
                    </h3>
                    {isVisitsSectionCollapsed && (
                      <span className="text-[10px] bg-sky-50 text-sky-850 font-black px-2 py-0.5 rounded-lg border border-sky-150 animate-fade-in shrink-0">
                        {isRtl ? `الزيارات المجدولة: ${displayedVisits.length}` : `Scheduled Visits: ${displayedVisits.length}`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto justify-end" onClick={(e) => e.stopPropagation()}>
                    {activeStatusFilter !== 'all' && (
                      <button
                        type="button"
                        onClick={() => setActiveStatusFilter('all')}
                        className="text-[10px] text-sky-605 hover:text-sky-800 font-bold bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-lg border border-sky-200 transition cursor-pointer"
                      >
                        {isRtl ? 'إلغاء الفلتر ✕' : 'Clear Filter ✕'}
                      </button>
                    )}
                    <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 font-bold px-2.5 py-1 rounded-lg shrink-0">
                      {isRtl ? `المعروض: ${displayedVisits.length}` : `Filtered: ${displayedVisits.length}`}
                    </span>
                    
                    {/* Toggle button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsVisitsSectionCollapsed(!isVisitsSectionCollapsed);
                      }}
                      className="p-1 hover:bg-slate-50 active:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-950 cursor-pointer"
                      title={isRtl ? 'توسيع / طي' : 'Toggle Expand/Collapse'}
                    >
                      {isVisitsSectionCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Visits list items (Collapsible) */}
                {!isVisitsSectionCollapsed && (
                  <div className="pt-2 animate-fade-in">
                    {canViewVisits ? (
                      <div>
                        {displayedVisits.length === 0 ? (
                          <div className="p-8 text-center text-xs text-slate-400 font-bold italic bg-slate-50 border border-dashed rounded-xl border-slate-200">
                            {isRtl ? '📭 لا توجد زيارات مسجلة لهذا التصفية المحدد.' : 'No visits recorded for this selected filter.'}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {displayedVisits.map((visit, index) => {
                              const num = index + 1;
                              return (
                                <div 
                                  key={visit.id} 
                                  className="p-5 bg-slate-50 rounded-2xl border border-slate-200/60 hover:border-safety-emerald/50 hover:shadow-md transition-all duration-300 hover:scale-[1.01] flex flex-col justify-between"
                                >
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap mb-2">
                                      <span className="w-5 h-5 bg-slate-200 text-slate-800 text-[10px] font-extrabold rounded-full flex items-center justify-center font-sans">
                                        {num}
                                      </span>
                                      <span className="text-xs font-bold text-slate-800 font-mono">
                                        {isRtl ? `زيارة رقم (${num})` : `Visit #${num}`}
                                      </span>
                                      {visit.branchName && (
                                        <span className="inline-block bg-teal-50 border border-teal-100 text-teal-850 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">
                                          📍 {dt(visit.branchName)}
                                        </span>
                                      )}
                                      {visit.status === 'completed' ? (
                                        <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1 shrink-0">
                                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                          <span>{isRtl ? 'مكتملة وموثقة' : 'Completed & Filed'}</span>
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-amber-50 text-amber-750 border border-amber-100 flex items-center gap-1 shrink-0">
                                          <Clock className="w-3 h-3 text-amber-600" />
                                          <span>{isRtl ? 'زيارة قادمة' : 'Upcoming'}</span>
                                        </span>
                                      )}
                                    </div>

                                    {/* Grid layout inside card */}
                                    <div className="grid grid-cols-2 gap-2 text-[10.5px] text-slate-600 bg-white/50 p-2.5 rounded-xl border border-slate-150/50">
                                      <div>
                                        <span className="text-slate-400 block text-[9px] font-bold">{isRtl ? 'تاريخ الموعد:' : 'Scheduled Date:'}</span>
                                        <span className="font-mono text-slate-805 font-bold">{formatDateDMY(visit.scheduledDate)}</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 block text-[9px] font-bold">{isRtl ? 'الفني الميداني المكلف:' : 'Assigned Tech:'}</span>
                                        <span className="font-bold text-teal-850 truncate block">👷‍♂️ {dt(visit.technicianName)}</span>
                                      </div>
                                      {visit.completedDate && (
                                        <div>
                                          <span className="text-slate-400 block text-[9px] font-bold">{isRtl ? 'تاريخ التوثيق:' : 'Completion Date:'}</span>
                                          <span className="font-mono text-slate-850 font-bold">{formatDateDMY(visit.completedDate)}</span>
                                        </div>
                                      )}
                                      <div>
                                        <span className="text-slate-400 block text-[9px] font-bold">{isRtl ? 'حالة التقرير:' : 'Safety Evaluation:'}</span>
                                        <span>
                                          {visit.status === 'completed' ? (
                                            visit.result === 'passed' ? (
                                              <span className="text-emerald-605 font-bold">{isRtl ? 'سليم ✔' : 'Passed ✔'}</span>
                                            ) : visit.result === 'has_defects' ? (
                                              <span className="text-amber-650 font-bold">{isRtl ? 'أعطال طفيفة ⚠️' : 'Minor defects ⚠️'}</span>
                                            ) : (
                                              <span className="text-rose-650 font-bold">{isRtl ? 'أعطال حرجة ❌' : 'CRITICAL ❌'}</span>
                                            )
                                          ) : (
                                            <span className="text-slate-400">{isRtl ? 'قيد الانتظار' : 'Pending'}</span>
                                          )}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Notes snippet */}
                                    {visit.status === 'completed' && (
                                      <div className="bg-white p-2.5 rounded-xl border border-slate-150/50 text-[10px] text-slate-700 mt-2 space-y-1 text-start">
                                        {visit.notes && (
                                          <p><b>{isRtl ? 'أعمال الفحص:' : 'Notes:'}</b> {dt(visit.notes)}</p>
                                        )}
                                        {visit.defects && (
                                          <p className="text-rose-700 font-medium">
                                            <b>⚠️ {isRtl ? 'العيوب:' : 'Defectives:'}</b> {dt(visit.defects)}
                                          </p>
                                        )}
                                      </div>
                                    )}

                                    {/* Media Gallery */}
                                    {visit.status === 'completed' && visit.attachments && visit.attachments.length > 0 && (
                                      <div className="mt-2 space-y-1 text-start">
                                        <span className="text-[9px] text-slate-400 font-bold block">{isRtl ? 'لقطات تأمين السلامة:' : 'Media Verification:'}</span>
                                        <div className="flex flex-wrap gap-1.5">
                                          {visit.attachments.map(att => (
                                            <div key={att.id} className="relative group overflow-hidden bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                                              {att.type === 'image' ? (
                                                <div className="relative cursor-pointer" onClick={() => { setLocalPreviewUrl(att.url); setLocalPreviewName(att.name); }}>
                                                  <img src={att.url} alt={att.name} className="w-12 h-9 object-cover rounded" referrerPolicy="no-referrer" />
                                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition text-[8px] font-bold">
                                                    {isRtl ? 'عرض' : 'View'}
                                                  </div>
                                                </div>
                                              ) : (
                                                <div className="relative cursor-pointer">
                                                  <div className="flex items-center gap-1 px-1.5 py-1 text-[8px] font-bold text-slate-700 bg-white rounded transition min-h-[36px] justify-center">
                                                    <span>🎥</span>
                                                    <span className="max-w-[60px] truncate" title={att.name}>{att.name}</span>
                                                  </div>
                                                  <a 
                                                    href={att.url.startsWith('#') ? 'https://www.w3schools.com/html/mov_bbb.mp4' : (att.url.startsWith('http') ? att.url : `${window.location.origin}${att.url}`)} 
                                                    target="_blank" 
                                                    rel="noreferrer" 
                                                    className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition text-[8px] font-bold rounded-lg decoration-none flex-col"
                                                  >
                                                    <span>▶️</span>
                                                  </a>
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Right side interaction controls for completed visit reports */}
                                  {visit.status === 'completed' && (
                                    <div className="mt-3 pt-2.5 border-t border-slate-150/50 flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() => onSelectVisit(visit)}
                                        className="w-full px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-850 text-[10px] font-bold rounded-xl transition flex items-center justify-center gap-1 border border-sky-150 cursor-pointer"
                                      >
                                        <Eye className="w-3 h-3 text-sky-600" />
                                        <span>{isRtl ? 'عرض التقرير والشهادة' : 'Open Certificate'}</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-xs text-slate-400 font-extrabold bg-slate-50 border border-dashed rounded-2xl border-slate-200 py-12 flex flex-col items-center justify-center gap-3 font-sans">
                        <span className="text-3xl">🔒</span>
                        <div className="space-y-1">
                          <p className="text-slate-800 text-sm font-bold">{isRtl ? 'حساب فرعي محدود الصلاحيات' : 'Limited Sub-user Permissions'}</p>
                          <p className="text-slate-400 text-[10px] font-semibold max-w-sm mx-auto leading-relaxed">
                            {isRtl 
                              ? 'ليس لديك صلاحية لمشاهدة تقارير وزيارات الصيانة الفنية لمعدات المنشأة. يرجى مراجعة المسؤول الرئيسي عن الحساب.' 
                              : 'Your sub-user account does not possess the viewVisits permission to study site visits & inspection reports.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

      {activeSubTab === 'emergency' && (
        <div className="space-y-6 animate-fade-in text-start">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-950 to-rose-950 shadow-md">
            <div className="flex items-center gap-3">
              <span className="text-3xl animate-bounce shrink-0">🚨</span>
              <div>
                <h3 className="font-black text-xs sm:text-sm md:text-base">{isRtl ? 'بيان وسجل التدخلات والزيارات الطارئة' : 'Emergency Facility Log & Call-outs'}</h3>
                <p className="text-xs text-slate-300 mt-1">{isRtl ? 'قائمة الفحص الفوري والاستجابة الطارئة لبلاغات وأعطال أجهزة السلامة ومطابقة أنظمتها بموقعك.' : 'History of immediate safety systems inspections and priority field interventions.'}</p>
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => {
                setClientEmergencyReasonInput('');
                setClientEmergencyImage(null);
                setClientEmergencyUploadProgress(false);
                if (client.branches && client.branches.length > 0) {
                  const firstB = client.branches[0];
                  setClientEmergencyBranchOption(typeof firstB === 'string' ? firstB : firstB.name);
                } else {
                  setClientEmergencyBranchOption('');
                }
                setIsNewEmergencyModalOpenClient(true);
              }}
              className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-2xl shadow-lg transition transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer shrink-0 animate-pulse"
            >
              <span>🚨</span>
              <span>{isRtl ? 'طلب زيارة طارئة للموقع' : 'Request Emergency Visit'}</span>
            </button>
          </div>

          {/* KPI Summary Cards for Emergency Visits */}
          {(() => {
            const clientEmergencyVisits = emergencyVisits.filter(v => v.clientId === client.id);
            const totalCount = clientEmergencyVisits.length;
            const completedCount = clientEmergencyVisits.filter(v => v.status === 'completed').length;
            const pendingCount = clientEmergencyVisits.filter(v => v.status !== 'completed').length;

            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Total Emergency Visits */}
                <button
                  type="button"
                  onClick={() => setEmergencyVisitFilter(emergencyVisitFilter === 'all' ? 'all' : 'all')}
                  className={`p-3 rounded-2xl border-2 text-start transition-all cursor-pointer flex items-center justify-between ${
                    emergencyVisitFilter === 'all'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-[1.01]'
                      : 'bg-white text-slate-800 border-slate-900/20 hover:border-slate-900 shadow-xs'
                  }`}
                >
                  <div>
                    <span className={`text-[10px] font-bold block ${emergencyVisitFilter === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
                      {isRtl ? 'إجمالي الزيارات' : 'Total Visits'}
                    </span>
                    <span className={`text-lg font-black mt-0.5 block font-mono ${emergencyVisitFilter === 'all' ? 'text-white' : 'text-slate-900'}`}>
                      {totalCount}
                    </span>
                  </div>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm ${emergencyVisitFilter === 'all' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>
                    🚨
                  </div>
                </button>

                {/* Completed */}
                <button
                  type="button"
                  onClick={() => setEmergencyVisitFilter(emergencyVisitFilter === 'completed' ? 'all' : 'completed')}
                  className={`p-3 rounded-2xl border-2 text-start transition-all cursor-pointer flex items-center justify-between ${
                    emergencyVisitFilter === 'completed'
                      ? 'bg-emerald-700 text-white border-emerald-800 shadow-md scale-[1.01]'
                      : 'bg-white text-slate-800 border-slate-900/20 hover:border-slate-900 shadow-xs'
                  }`}
                >
                  <div>
                    <span className={`text-[10px] font-bold block ${emergencyVisitFilter === 'completed' ? 'text-emerald-100' : 'text-slate-500'}`}>
                      {isRtl ? 'منجزة ومكتملة' : 'Completed Emergency Visits'}
                    </span>
                    <span className={`text-lg font-black mt-0.5 block font-mono ${emergencyVisitFilter === 'completed' ? 'text-white' : 'text-emerald-700'}`}>
                      {completedCount}
                    </span>
                  </div>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm ${emergencyVisitFilter === 'completed' ? 'bg-emerald-800 text-white' : 'bg-emerald-50 text-emerald-700'}`}>
                    ✅
                  </div>
                </button>

                {/* Under Field Resolution */}
                <button
                  type="button"
                  onClick={() => setEmergencyVisitFilter(emergencyVisitFilter === 'pending' ? 'all' : 'pending')}
                  className={`p-3 rounded-2xl border-2 text-start transition-all cursor-pointer flex items-center justify-between ${
                    emergencyVisitFilter === 'pending'
                      ? 'bg-amber-600 text-white border-amber-700 shadow-md scale-[1.01]'
                      : 'bg-white text-slate-800 border-slate-900/20 hover:border-slate-900 shadow-xs'
                  }`}
                >
                  <div>
                    <span className={`text-[10px] font-bold block ${emergencyVisitFilter === 'pending' ? 'text-amber-100' : 'text-slate-500'}`}>
                      {isRtl ? 'قيد المعالجة الميدانية' : 'Under Field Resolution'}
                    </span>
                    <span className={`text-lg font-black mt-0.5 block font-mono ${emergencyVisitFilter === 'pending' ? 'text-white' : 'text-amber-700'}`}>
                      {pendingCount}
                    </span>
                  </div>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm ${emergencyVisitFilter === 'pending' ? 'bg-amber-700 text-white' : 'bg-amber-50 text-amber-700'}`}>
                    🛠️
                  </div>
                </button>
              </div>
            );
          })()}

          {(() => {
            const clientEmergencyVisits = emergencyVisits.filter(v => v.clientId === client.id);
            const filteredVisits = clientEmergencyVisits.filter(v => {
              if (emergencyVisitFilter === 'completed') return v.status === 'completed';
              if (emergencyVisitFilter === 'pending') return v.status !== 'completed';
              return true;
            });

            if (filteredVisits.length === 0) {
              return (
                <div className="py-12 text-center border-2 border-dashed border-slate-300 bg-white rounded-3xl p-6">
                  <span className="text-3xl p-3 bg-slate-100 rounded-full inline-block mb-2">🚨</span>
                  <p className="text-xs font-bold text-slate-700">
                    {isRtl ? 'لا توجد زيارات طارئة مطابقة لهذا التصنيف' : 'No emergency visits match this filter'}
                  </p>
                  {emergencyVisitFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setEmergencyVisitFilter('all')}
                      className="mt-3 px-3 py-1.5 bg-slate-900 text-white text-[11px] font-bold rounded-xl hover:bg-slate-800 transition"
                    >
                      {isRtl ? 'عرض جميع الزيارات' : 'Show All Visits'}
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredVisits.map(visit => {
                  const isCompleted = visit.status === 'completed';
                  return (
                    <div 
                      key={visit.id} 
                      onClick={() => onSelectVisit(visit)}
                      className="bg-white rounded-2xl border-2 border-slate-900/30 hover:border-slate-900 p-5 space-y-4 hover:shadow-md transition cursor-pointer flex flex-col justify-between shadow-xs"
                    >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg ${
                        isCompleted 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                          : 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse'
                      }`}>
                        {isCompleted 
                          ? (isRtl ? 'تمت معالجة وإتمام الزيارة الطارئة ✅' : 'Call-out Resolved ✅') 
                          : (isRtl ? 'قيد المتابعة والمعالجة الميدانية 🛠️' : 'Under Field Resolution 🛠️')}
                      </span>
                      <span className="text-xs text-slate-400 font-mono font-bold">{formatDateDMY(visit.completedDate || visit.scheduledDate)}</span>
                    </div>

                    {visit.branchName && (
                      <div className="inline-block px-2.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-sans font-extrabold rounded-lg">
                        📍 {isRtl ? 'الموقع/الفرع المستهدف: ' : 'Target Branch: '} {dt(visit.branchName)}
                      </div>
                    )}

                    {visit.emergencySeverity && (
                      <div className={`inline-block px-2.5 py-0.5 rounded-lg border text-[10px] font-sans font-extrabold ${
                        visit.emergencySeverity === 'critical_issues'
                          ? 'bg-red-50 border-red-200 text-red-805 text-red-800'
                          : 'bg-amber-50 border-amber-200 text-amber-805 text-amber-800'
                      }`}>
                        ⚠️ {isRtl ? 'حالة البلاغ:' : 'Severity:'} {visit.emergencySeverity === 'critical_issues' 
                          ? (isRtl ? 'خطورة عالية' : 'Critical Damage') 
                          : (isRtl ? 'ملاحظات طفيفة' : 'Minor Notes')}
                      </div>
                    )}

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 block font-bold">{isRtl ? 'سبب طلب الزيارة الطارئة:' : 'Reason for emergency call:'}</span>
                      <p className="text-xs font-black text-slate-800 bg-red-50/50 p-2.5 rounded-xl border border-red-100/50 leading-relaxed">
                        {dt(visit.emergencyReason)}
                      </p>
                      
                      {/* Attached media preview inside card */}
                      {visit.attachments && visit.attachments.length > 0 && (
                        <div className="flex gap-2 flex-wrap mt-2">
                          {visit.attachments.map(file => (
                            <div 
                              key={file.id} 
                              className={`inline-flex items-center gap-2 p-1.5 bg-red-50/40 hover:bg-red-50 rounded-xl border border-red-100 max-w-full transition ${file.type === 'image' ? 'cursor-zoom-in ring-1 ring-transparent hover:ring-red-300' : ''}`}
                              onClick={(e) => {
                                if (file.type === 'image') {
                                  e.stopPropagation();
                                  setLocalPreviewUrl(file.url);
                                  setLocalPreviewName(file.name);
                                }
                              }}
                            >
                              {file.type === 'image' ? (
                                <img 
                                  src={file.url} 
                                  alt={file.name} 
                                  className="w-8 h-8 object-cover rounded-lg border border-slate-100"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-slate-500 text-[9px]">
                                  {file.type.toUpperCase()}
                                </div>
                              )}
                              <span className="text-[10px] font-bold text-red-950 truncate max-w-[150px]" title={file.name}>
                                {file.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {isCompleted && visit.notes && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 block font-bold">{isRtl ? 'فحص تشخيص الفني وتقرير الوضع:' : 'Inspection diagnosis & findings:'}</span>
                        <p className="text-xs text-slate-600 line-clamp-3 bg-slate-50 p-2.5 rounded-xl border border-slate-105 italic leading-relaxed">
                          "{dt(visit.notes)}"
                        </p>
                      </div>
                    )}

                    {visit.supervisorNotes && (
                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] text-amber-800 block font-bold flex items-center gap-1">
                          <span>👔</span> {isRtl ? 'ملاحظات المشرف العام:' : 'General Supervisor Notes:'}
                        </span>
                        <p className="text-xs text-amber-950 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/80 font-semibold leading-relaxed">
                          {dt(visit.supervisorNotes)}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-semibold">{isRtl ? 'الفني المسئول:' : 'Assigned Specialist:'} <strong className="text-slate-800 font-black">{dt(visit.technicianName)}</strong></span>
                    {isCompleted && (
                      <span className="text-teal-700 font-extrabold flex items-center gap-1 hover:underline">
                        👁️ {isRtl ? 'عرض التقرير والشهادة والطباعة' : 'Open Certificate & Print'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
        </div>
      )}

      {activeSubTab === 'extinguishers' && (
        <div className="space-y-6 text-start">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-905 via-slate-800 to-amber-950 text-white rounded-3xl p-6 shadow-md border border-slate-700/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="text-xs text-amber-400 font-extrabold uppercase tracking-wider block">🛡️ NESMA FIRST SECURITY - SAFETY COMPLIANCE</span>
              <h3 className="font-bold text-lg text-slate-100 mt-1">{isRtl ? 'سندات صيانة واستلام طفايات الحريق' : 'Fire Extinguishers Handover Archives'}</h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                {isRtl 
                  ? 'استعرض وحمل السندات الرسمية ومستندات تسليم طفايات الحريق التي تمت صيانتها وتعبئتها وتوقيعها من قبل الفني المعتمد والمستلم المفوض للمنشأة.' 
                  : 'Access and download officially signed safety forms and fire extinguisher handover receipts certifying recent cylinder maintenance.'}
              </p>
            </div>
            <span className="px-3 py-1.5 bg-amber-500/15 text-amber-400 border border-amber-500/20 text-xs font-bold rounded-xl flex items-center gap-1.5 block shrink-0">
              🧯 {extinguisherReceipts.filter(r => r.clientId === client.id).length} {isRtl ? 'سندات معتمدة' : 'certified records'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {extinguisherReceipts
              .filter(r => r.clientId === client.id)
              .map(receipt => {
                const expiryStatus = getFireExtinguisherStatus(receipt.newExpiryDate);
                let badgeBg = 'bg-slate-100 text-slate-700 border-slate-200';
                let statusText = isRtl ? 'غير محدد' : 'Unknown';
                if (expiryStatus === 'expired') {
                  badgeBg = 'bg-rose-100 text-rose-800 border-rose-200 animate-pulse';
                  statusText = isRtl ? 'صلاحية منتهية!' : 'Expired!';
                } else if (expiryStatus === 'expiring') {
                  badgeBg = 'bg-amber-100 text-amber-800 border-amber-200';
                  statusText = isRtl ? 'تنتهي قريباً!' : 'Expiring soon!';
                } else if (expiryStatus === 'valid') {
                  badgeBg = 'bg-emerald-100 text-emerald-800 border-emerald-250';
                  statusText = isRtl ? 'ساري الصلاحية ✅' : 'Valid Expiration';
                }

                return (
                  <div
                    key={receipt.id}
                    className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-md transition duration-200 flex flex-col justify-between gap-4 text-start relative group"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-mono font-bold rounded">
                          ID: #{receipt.id.slice(0, 8)}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black border uppercase tracking-wider ${badgeBg}`}>
                          {statusText}
                        </span>
                      </div>

                      <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm mt-3.5 group-hover:text-amber-800 transition-all flex items-center gap-1.5">
                        🧯 {dt(receipt.extinguisherType)}
                      </h4>
                      {receipt.branchName && (
                        <span className="text-[10px] text-slate-500 block font-bold mt-1">📍 {isRtl ? `الفرع: ${dt(receipt.branchName)}` : `Branch: ${dt(receipt.branchName)}`}</span>
                      )}

                      <div className="mt-3.5 space-y-2 text-[11px] text-slate-600 border-t border-slate-50 pt-3">
                        <p className="flex justify-between items-center bg-slate-50/50 p-2 rounded-xl">
                          <span className="text-slate-400">{isRtl ? 'الكمية المصانة:' : 'Inspected Qty:'}</span>
                          <strong className="text-slate-800 font-mono font-extrabold text-xs">{receipt.quantity} {isRtl ? 'وحدة طفاية' : 'cylinders'}</strong>
                        </p>
                        <p className="flex justify-between items-center bg-amber-50/20 p-2 rounded-xl">
                          <span className="text-amber-800 font-bold">{isRtl ? 'تاريخ الفحص الفعلي:' : 'Inspection Date:'}</span>
                          <strong className="text-amber-900 font-mono font-extrabold text-xs">{receipt.inspectionDate || receipt.date}</strong>
                        </p>
                        <p className="flex justify-between items-center bg-emerald-50/20 p-2 rounded-xl">
                          <span className="text-slate-400">{isRtl ? 'تاريخ الصلاحية الجديد:' : 'New Expiry:'}</span>
                          <strong className="text-emerald-700 font-mono font-extrabold text-xs">{receipt.newExpiryDate}</strong>
                        </p>
                        <p className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">👷‍♂️ {isRtl ? 'الفني الوقائي:' : 'Inspector:'}</span>
                          <strong className="text-slate-800 font-semibold">{dt(receipt.technicianName)}</strong>
                        </p>
                        {receipt.signatoryName && (
                          <p className="flex justify-between items-center text-xs">
                            <span className="text-slate-400">👤 {isRtl ? 'اسم المستلم:' : 'Receiver Sign:'}</span>
                            <strong className="text-slate-800 font-bold">{dt(receipt.signatoryName)}</strong>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-400 font-bold">
                        {isRtl ? `تاريخ السند: ${receipt.date}` : `Receipt Date: ${receipt.date}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedReceipt(receipt)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs select-none"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isRtl ? 'عرض السند' : 'View receipt'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}

            {extinguisherReceipts.filter(r => r.clientId === client.id).length === 0 && (
              <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 bg-white rounded-3xl flex flex-col items-center justify-center p-6">
                <span className="text-3xl p-4 bg-slate-50 rounded-full mb-3">🧯</span>
                <h4 className="font-bold text-slate-800 text-sm">{isRtl ? 'لا سجل لسندات صيانة طفايات الحريق المعتمدة' : 'Zero certified receipts recorded'}</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">{isRtl ? 'لم يثبت الفنيون أو يسجلوا أي سندات لصيانة طفايات الحريق لعقد المنشأة في النظام حتى اللحظة.' : 'No extinguisher handover records have been prepared for this contract yet.'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'quotations' && (
        <div className="space-y-6">
          {/* KPI Summary Cards for Quotations */}
          {(() => {
            const clientQuotes = quotations.filter(q => q.clientId === client.id);
            const totalQuotes = clientQuotes.length;
            const pendingApproval = clientQuotes.filter(q => q.status === 'pending').length;
            const approved = clientQuotes.filter(q => q.status === 'approved').length;

            const isQuotePaidInFull = (q: Quotation) => {
              const paid = q.paidAmount || (q.paymentHistory ? q.paymentHistory.reduce((s, p) => s + p.amount, 0) : 0);
              return q.status === 'approved' && (paid >= q.grandTotal || q.paymentStatus === 'paid');
            };

            const isQuotePartiallyPaid = (q: Quotation) => {
              const paid = q.paidAmount || (q.paymentHistory ? q.paymentHistory.reduce((s, p) => s + p.amount, 0) : 0);
              return q.status === 'approved' && !isQuotePaidInFull(q) && (paid > 0 || q.paymentStatus === 'partially_paid');
            };

            const isQuoteAwaitingPayment = (q: Quotation) =>
              q.status === 'approved' && !isQuotePaidInFull(q) && !isQuotePartiallyPaid(q);

            const paidInFull = clientQuotes.filter(isQuotePaidInFull).length;
            const partiallyPaid = clientQuotes.filter(isQuotePartiallyPaid).length;
            const awaitingPayment = clientQuotes.filter(isQuoteAwaitingPayment).length;

            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
                {/* Total Quotes */}
                <button
                  type="button"
                  onClick={() => setQuotationFilter('all')}
                  className={`p-2.5 sm:p-3 rounded-2xl border text-start transition-all cursor-pointer flex items-center justify-between ${
                    quotationFilter === 'all'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-[1.01]'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-slate-400 shadow-xs'
                  }`}
                >
                  <div>
                    <span className={`text-[9px] sm:text-[10px] font-bold block ${quotationFilter === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
                      {isRtl ? 'إجمالي العروض' : 'Total Quotations'}
                    </span>
                    <span className={`text-base sm:text-lg font-black mt-0.5 block font-mono ${quotationFilter === 'all' ? 'text-white' : 'text-slate-900'}`}>
                      {totalQuotes}
                    </span>
                  </div>
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 ${quotationFilter === 'all' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>
                    📄
                  </div>
                </button>

                {/* Pending Approval */}
                <button
                  type="button"
                  onClick={() => setQuotationFilter(quotationFilter === 'pending' ? 'all' : 'pending')}
                  className={`p-2.5 sm:p-3 rounded-2xl border text-start transition-all cursor-pointer flex items-center justify-between ${
                    quotationFilter === 'pending'
                      ? 'bg-amber-600 text-white border-amber-700 shadow-md scale-[1.01]'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-amber-400 shadow-xs'
                  }`}
                >
                  <div>
                    <span className={`text-[9px] sm:text-[10px] font-bold block ${quotationFilter === 'pending' ? 'text-amber-100' : 'text-slate-500'}`}>
                      {isRtl ? 'بانتظار الموافقة والتعميد' : 'Pending Approval'}
                    </span>
                    <span className={`text-base sm:text-lg font-black mt-0.5 block font-mono ${quotationFilter === 'pending' ? 'text-white' : 'text-amber-700'}`}>
                      {pendingApproval}
                    </span>
                  </div>
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 ${quotationFilter === 'pending' ? 'bg-amber-700 text-white' : 'bg-amber-50 text-amber-700'}`}>
                    ⏳
                  </div>
                </button>

                {/* Approved */}
                <button
                  type="button"
                  onClick={() => setQuotationFilter(quotationFilter === 'approved' ? 'all' : 'approved')}
                  className={`p-2.5 sm:p-3 rounded-2xl border text-start transition-all cursor-pointer flex items-center justify-between ${
                    quotationFilter === 'approved'
                      ? 'bg-emerald-700 text-white border-emerald-800 shadow-md scale-[1.01]'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-emerald-400 shadow-xs'
                  }`}
                >
                  <div>
                    <span className={`text-[9px] sm:text-[10px] font-bold block ${quotationFilter === 'approved' ? 'text-emerald-100' : 'text-slate-500'}`}>
                      {isRtl ? 'مقبولة ومعتمدة' : 'Approved & Accepted'}
                    </span>
                    <span className={`text-base sm:text-lg font-black mt-0.5 block font-mono ${quotationFilter === 'approved' ? 'text-white' : 'text-emerald-700'}`}>
                      {approved}
                    </span>
                  </div>
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 ${quotationFilter === 'approved' ? 'bg-emerald-800 text-white' : 'bg-emerald-50 text-emerald-700'}`}>
                    ✅
                  </div>
                </button>

                {/* Awaiting Payment */}
                <button
                  type="button"
                  onClick={() => setQuotationFilter(quotationFilter === 'unpaid' ? 'all' : 'unpaid')}
                  className={`p-2.5 sm:p-3 rounded-2xl border text-start transition-all cursor-pointer flex items-center justify-between ${
                    quotationFilter === 'unpaid'
                      ? 'bg-rose-700 text-white border-rose-800 shadow-md scale-[1.01]'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-rose-400 shadow-xs'
                  }`}
                >
                  <div>
                    <span className={`text-[9px] sm:text-[10px] font-bold block ${quotationFilter === 'unpaid' ? 'text-rose-100' : 'text-slate-500'}`}>
                      {isRtl ? 'بانتظار السداد' : 'Awaiting Payment'}
                    </span>
                    <span className={`text-base sm:text-lg font-black mt-0.5 block font-mono ${quotationFilter === 'unpaid' ? 'text-white' : 'text-rose-700'}`}>
                      {awaitingPayment}
                    </span>
                  </div>
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 ${quotationFilter === 'unpaid' ? 'bg-rose-800 text-white' : 'bg-rose-50 text-rose-700'}`}>
                    💰
                  </div>
                </button>

                {/* Paid in Full */}
                <button
                  type="button"
                  onClick={() => setQuotationFilter(quotationFilter === 'paid' ? 'all' : 'paid')}
                  className={`p-2.5 sm:p-3 rounded-2xl border text-start transition-all cursor-pointer flex items-center justify-between ${
                    quotationFilter === 'paid'
                      ? 'bg-teal-700 text-white border-teal-800 shadow-md scale-[1.01]'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-teal-400 shadow-xs'
                  }`}
                >
                  <div>
                    <span className={`text-[9px] sm:text-[10px] font-bold block ${quotationFilter === 'paid' ? 'text-teal-100' : 'text-slate-500'}`}>
                      {isRtl ? 'مسددة بالكامل' : 'Paid in Full'}
                    </span>
                    <span className={`text-base sm:text-lg font-black mt-0.5 block font-mono ${quotationFilter === 'paid' ? 'text-white' : 'text-teal-700'}`}>
                      {paidInFull}
                    </span>
                  </div>
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 ${quotationFilter === 'paid' ? 'bg-teal-800 text-white' : 'bg-teal-50 text-teal-700'}`}>
                    💳
                  </div>
                </button>

                {/* Partially Paid */}
                <button
                  type="button"
                  onClick={() => setQuotationFilter(quotationFilter === 'partially_paid' ? 'all' : 'partially_paid')}
                  className={`p-2.5 sm:p-3 rounded-2xl border text-start transition-all cursor-pointer flex items-center justify-between ${
                    quotationFilter === 'partially_paid'
                      ? 'bg-orange-600 text-white border-orange-700 shadow-md scale-[1.01]'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-orange-400 shadow-xs'
                  }`}
                >
                  <div>
                    <span className={`text-[9px] sm:text-[10px] font-bold block ${quotationFilter === 'partially_paid' ? 'text-orange-100' : 'text-slate-500'}`}>
                      {isRtl ? 'مسددة جزئياً' : 'Partially Paid'}
                    </span>
                    <span className={`text-base sm:text-lg font-black mt-0.5 block font-mono ${quotationFilter === 'partially_paid' ? 'text-white' : 'text-orange-700'}`}>
                      {partiallyPaid}
                    </span>
                  </div>
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 ${quotationFilter === 'partially_paid' ? 'bg-orange-700 text-white' : 'bg-orange-50 text-orange-700'}`}>
                    📊
                  </div>
                </button>
              </div>
            );
          })()}

          <div className="bg-white rounded-3xl border-2 border-slate-900 p-6 shadow-sm space-y-4">
            {(() => {
              const clientQuotes = quotations.filter(q => q.clientId === client.id);

              const isQuotePaidInFull = (q: Quotation) => {
                const paid = q.paidAmount || (q.paymentHistory ? q.paymentHistory.reduce((s, p) => s + p.amount, 0) : 0);
                return q.status === 'approved' && (paid >= q.grandTotal || q.paymentStatus === 'paid');
              };

              const isQuotePartiallyPaid = (q: Quotation) => {
                const paid = q.paidAmount || (q.paymentHistory ? q.paymentHistory.reduce((s, p) => s + p.amount, 0) : 0);
                return q.status === 'approved' && !isQuotePaidInFull(q) && (paid > 0 || q.paymentStatus === 'partially_paid');
              };

              const isQuoteAwaitingPayment = (q: Quotation) =>
                q.status === 'approved' && !isQuotePaidInFull(q) && !isQuotePartiallyPaid(q);

              const filteredQuotes = clientQuotes.filter(q => {
                if (quotationFilter === 'pending') return q.status === 'pending';
                if (quotationFilter === 'approved') return q.status === 'approved';
                if (quotationFilter === 'unpaid') return isQuoteAwaitingPayment(q);
                if (quotationFilter === 'paid') return isQuotePaidInFull(q);
                if (quotationFilter === 'partially_paid') return isQuotePartiallyPaid(q);
                return true;
              });

              return (
                <>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-safety-emerald" />
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">
                          {isRtl ? 'عروض أسعار واستبدال قطع الغيار التالفة' : 'Spare Parts Replacement Quotations'}
                        </h3>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-sans">
                          {isRtl ? 'مستندات تسعير الأعطال المرفوعة من الإدارة للموافقة أو الرفض الإلكتروني والطباعة ومتابعة الأعمال المنجزة' : 'Defect repair quote logs submitted by administration awaiting approval, signature, printing or checking execution reports'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-slate-950 text-white font-sans font-bold px-2.5 py-1 rounded-full">
                      {isRtl ? `${filteredQuotes.length} عرضاً` : `${filteredQuotes.length} active`}
                    </span>
                  </div>

                  {filteredQuotes.length === 0 ? (
                    <div className="py-12 text-center border-2 border-dashed border-slate-200 bg-white rounded-3xl flex flex-col items-center justify-center p-6">
                      <span className="text-3xl p-3 bg-slate-50 rounded-full mb-2">📄</span>
                      <h4 className="font-bold text-slate-800 text-sm">{isRtl ? 'لا توجد عروض أسعار مطابقة لهذا التصنيف' : 'No quotations match this filter'}</h4>
                      {quotationFilter !== 'all' && (
                        <button
                          type="button"
                          onClick={() => setQuotationFilter('all')}
                          className="mt-3 px-3 py-1.5 bg-slate-900 text-white text-[11px] font-bold rounded-xl hover:bg-slate-800 transition cursor-pointer"
                        >
                          {isRtl ? 'عرض جميع العروض' : 'Show All Quotations'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white rounded-3xl border border-slate-150 shadow-xs overflow-hidden text-start">
                      <div className="px-6 py-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
                        <h3 className="font-black text-xs sm:text-sm text-slate-800">
                          {isRtl ? 'قائمة عروض الأسعار:' : 'Quotations List:'}
                        </h3>
                        <span className="px-2.5 py-1 bg-slate-900 text-white text-[11px] font-black rounded-lg">
                          {filteredQuotes.length} {isRtl ? 'عرض سعر' : 'Quotations'}
                        </span>
                      </div>

                      <div className="divide-y divide-slate-150">
                        {filteredQuotes.map((q) => {
                          const dateObj = new Date(q.date);
                          const formattedDate = dateObj.toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                          const isPending = q.status === 'pending';

                          const totalPaid = q.paidAmount || (q.paymentHistory ? q.paymentHistory.reduce((s, p) => s + p.amount, 0) : 0);
                          const isPaid = totalPaid >= q.grandTotal || q.paymentStatus === 'paid';
                          const isPartial = !isPaid && (totalPaid > 0 || q.paymentStatus === 'partially_paid');
                          const surplus = totalPaid > q.grandTotal ? parseFloat((totalPaid - q.grandTotal).toFixed(2)) : 0;

                          return (
                            <div key={q.id} className="p-5 hover:bg-slate-50/50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="space-y-2 text-start flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-black text-slate-900 font-sans">
                                    {isRtl ? 'عرض صيانة رقم' : 'Quote Ref'}: #{q.id.split('_')[1] || q.id}
                                  </span>

                                  {q.branchName && (
                                    <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 text-[9px] font-bold rounded-md">
                                      📍 {dt(q.branchName)}
                                    </span>
                                  )}

                                  {/* Status Badge */}
                                  {q.status === 'approved' ? (
                                    <span className="px-2.5 py-0.5 text-[9px] font-bold rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      ✓ {isRtl ? 'مقبول ومعتمد' : 'Approved'}
                                    </span>
                                  ) : q.status === 'rejected' ? (
                                    <span className="px-2.5 py-0.5 text-[9px] font-bold rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                                      ✕ {isRtl ? 'مرفوض من طرفكم' : 'Rejected'}
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-0.5 text-[9px] font-bold rounded-md bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                                      ● {isRtl ? 'بانتظار موافقتكم' : 'Awaiting Reply'}
                                    </span>
                                  )}

                                  {/* Payment Status Badge if approved */}
                                  {q.status === 'approved' && (
                                    isPaid ? (
                                      <span className="px-2.5 py-0.5 text-[9px] font-bold rounded-md bg-teal-100 text-teal-800 border border-teal-200">
                                        ✓ {isRtl ? 'خالص ومسدد بالكامل' : 'Fully Paid'}
                                      </span>
                                    ) : isPartial ? (
                                      <span className="px-2.5 py-0.5 text-[9px] font-bold rounded-md bg-orange-100 text-orange-800 border border-orange-200">
                                        ● {isRtl ? 'مسدد جزئياً' : 'Partially Paid'}
                                      </span>
                                    ) : (
                                      <span className="px-2.5 py-0.5 text-[9px] font-bold rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                                        ● {isRtl ? 'معلق بانتظار السداد' : 'Unpaid'}
                                      </span>
                                    )
                                  )}
                                </div>

                                <div className="text-[11px] text-slate-500 font-sans flex items-center gap-4 flex-wrap">
                                  <span>📅 {isRtl ? 'تاريخ العرض:' : 'Date:'} <strong className="text-slate-800 font-semibold">{formattedDate}</strong></span>
                                  <span>💵 {isRtl ? 'الإجمالي شامل الضريبة:' : 'Grand Total:'} <strong className="text-slate-900 font-black">{q.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {isRtl ? 'ريال' : 'SAR'}</strong></span>
                                  <span>📦 {q.items.length} {isRtl ? 'بنود قطع غيار' : 'items'}</span>
                                  {q.status === 'approved' && totalPaid > 0 && (
                                    <>
                                      <span>💳 {isRtl ? 'المسدد:' : 'Paid:'} <strong className="text-emerald-700 font-bold">{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })} {isRtl ? 'ر.س' : 'SAR'}</strong></span>
                                      {surplus > 0 && (
                                        <span className="px-2 py-0.5 bg-emerald-100 border border-emerald-300 text-emerald-900 font-extrabold rounded-md text-[10px]">
                                          💡 {isRtl ? `رصيد زائد للعميل: +${surplus.toLocaleString(undefined, { minimumFractionDigits: 2 })} ر.س` : `Credit Surplus: +${surplus} SAR`}
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>

                                {!isPending && q.clientNote && (
                                  <p className="text-[10px] text-slate-500 italic font-sans pt-0.5">
                                    <strong>{isRtl ? 'ملاحظتكم المرفقة: ' : 'Your comment: '}</strong>"{q.clientNote}"
                                  </p>
                                )}
                              </div>

                              {/* Action Buttons in Row */}
                              <div className="flex items-center gap-2 self-start sm:self-center flex-wrap shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewingQuotation(q);
                                    setClientReplyNote(q.clientNote || '');
                                    setShowViewQuoteModal(true);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-black bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95"
                                >
                                  <Eye className="w-4 h-4" />
                                  <span>{isRtl ? 'معاينة تفصيلية وطباعة' : 'View Full & Print'}</span>
                                </button>

                                {q.executionReport && (
                                  <button
                                    type="button"
                                    onClick={() => setViewingExecutionReportQuote(q)}
                                    className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-black bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl transition cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95"
                                    title={isRtl ? 'معاينة الأعمال المنجزة والتقرير الفني' : 'View Completed Technical Works & Report'}
                                  >
                                    👁️ <span>{isRtl ? 'الأعمال المنجزة' : 'Completed Work'}</span>
                                  </button>
                                )}

                                {isPending && (
                                  canReplyQuotes ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setViewingQuotation(q);
                                        setClientReplyNote('');
                                        setShowViewQuoteModal(true);
                                      }}
                                      className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95"
                                    >
                                      <ThumbsUp className="w-3.5 h-3.5" />
                                      <span>{isRtl ? 'الاعتماد والرد' : 'Decision'}</span>
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1 leading-normal font-sans">
                                      🔒 {isRtl ? 'اعتماد العرض معلّق' : 'Approval Restricted'}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
            </>
          );
        })()}
      </div>
    </div>
  )}

      {activeSubTab === 'workOrders' && (
        <div className="space-y-6">
          {/* KPI Summary Cards for Work Orders */}
          {(() => {
            const clientWorkOrders = quotations.filter(q => q.clientId === client.id && q.status === 'approved');
            const totalWorkOrders = clientWorkOrders.length;

            const getWorkOrderStatus = (q: Quotation): 'new' | 'pending' | 'partially_completed' | 'completed' => {
              if (!q.executionReport) {
                if (q.workOrderStatus === 'partially_completed') return 'partially_completed';
                if (q.workOrderStatus === 'completed') return 'completed';
                return q.assignedTechId ? 'pending' : 'new';
              }
              const total = q.items?.length || 0;
              const done = (q.executionReport.completedItems || []).length;
              if (total > 0) {
                if (done >= total) return 'completed';
                if (done > 0) return 'partially_completed';
                return 'pending';
              }
              return 'completed';
            };

            const newWorkOrders = clientWorkOrders.filter(q => getWorkOrderStatus(q) === 'new').length;
            const pendingWorkOrders = clientWorkOrders.filter(q => getWorkOrderStatus(q) === 'pending').length;
            const partiallyCompletedWorkOrders = clientWorkOrders.filter(q => getWorkOrderStatus(q) === 'partially_completed').length;
            const completedWorkOrders = clientWorkOrders.filter(q => getWorkOrderStatus(q) === 'completed').length;

            return (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
                {/* Total Work Orders */}
                <button
                  type="button"
                  onClick={() => setWorkOrderFilter('all')}
                  className={`p-2.5 sm:p-3 rounded-2xl border text-start transition-all cursor-pointer flex items-center justify-between ${
                    workOrderFilter === 'all'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-[1.01]'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-slate-400 shadow-xs'
                  }`}
                >
                  <div>
                    <span className={`text-[9px] sm:text-[10px] font-bold block ${workOrderFilter === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
                      {isRtl ? 'إجمالي الأوامر' : 'Total Work Orders'}
                    </span>
                    <span className={`text-base sm:text-lg font-black mt-0.5 block font-mono ${workOrderFilter === 'all' ? 'text-white' : 'text-slate-900'}`}>
                      {totalWorkOrders}
                    </span>
                  </div>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 ${workOrderFilter === 'all' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>
                    🛠️
                  </div>
                </button>

                {/* New Work Order */}
                <button
                  type="button"
                  onClick={() => setWorkOrderFilter(workOrderFilter === 'new' ? 'all' : 'new')}
                  className={`p-2.5 sm:p-3 rounded-2xl border text-start transition-all cursor-pointer flex items-center justify-between ${
                    workOrderFilter === 'new'
                      ? 'bg-sky-700 text-white border-sky-800 shadow-md scale-[1.01]'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-sky-400 shadow-xs'
                  }`}
                >
                  <div>
                    <span className={`text-[9px] sm:text-[10px] font-bold block ${workOrderFilter === 'new' ? 'text-sky-100' : 'text-slate-500'}`}>
                      {isRtl ? 'أمر عمل جديد' : 'New Work Order'}
                    </span>
                    <span className={`text-base sm:text-lg font-black mt-0.5 block font-mono ${workOrderFilter === 'new' ? 'text-white' : 'text-sky-700'}`}>
                      {newWorkOrders}
                    </span>
                  </div>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 ${workOrderFilter === 'new' ? 'bg-sky-800 text-white' : 'bg-sky-50 text-sky-700'}`}>
                    📋
                  </div>
                </button>

                {/* Pending Execution */}
                <button
                  type="button"
                  onClick={() => setWorkOrderFilter(workOrderFilter === 'pending' ? 'all' : 'pending')}
                  className={`p-2.5 sm:p-3 rounded-2xl border text-start transition-all cursor-pointer flex items-center justify-between ${
                    workOrderFilter === 'pending'
                      ? 'bg-amber-600 text-white border-amber-700 shadow-md scale-[1.01]'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-amber-400 shadow-xs'
                  }`}
                >
                  <div>
                    <span className={`text-[9px] sm:text-[10px] font-bold block ${workOrderFilter === 'pending' ? 'text-amber-100' : 'text-slate-500'}`}>
                      {isRtl ? 'قيد الانتظار' : 'Pending Execution'}
                    </span>
                    <span className={`text-base sm:text-lg font-black mt-0.5 block font-mono ${workOrderFilter === 'pending' ? 'text-white' : 'text-amber-700'}`}>
                      {pendingWorkOrders}
                    </span>
                  </div>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 ${workOrderFilter === 'pending' ? 'bg-amber-700 text-white' : 'bg-amber-50 text-amber-700'}`}>
                    ⏳
                  </div>
                </button>

                {/* Partially Completed */}
                <button
                  type="button"
                  onClick={() => setWorkOrderFilter(workOrderFilter === 'partially_completed' ? 'all' : 'partially_completed')}
                  className={`p-2.5 sm:p-3 rounded-2xl border text-start transition-all cursor-pointer flex items-center justify-between ${
                    workOrderFilter === 'partially_completed'
                      ? 'bg-orange-600 text-white border-orange-700 shadow-md scale-[1.01]'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-orange-400 shadow-xs'
                  }`}
                >
                  <div>
                    <span className={`text-[9px] sm:text-[10px] font-bold block ${workOrderFilter === 'partially_completed' ? 'text-orange-100' : 'text-slate-500'}`}>
                      {isRtl ? 'منجز جزئياً 🟠' : 'Partially Completed'}
                    </span>
                    <span className={`text-base sm:text-lg font-black mt-0.5 block font-mono ${workOrderFilter === 'partially_completed' ? 'text-white' : 'text-orange-700'}`}>
                      {partiallyCompletedWorkOrders}
                    </span>
                  </div>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 ${workOrderFilter === 'partially_completed' ? 'bg-orange-700 text-white' : 'bg-orange-50 text-orange-700'}`}>
                    🟧
                  </div>
                </button>

                {/* Completed Work Orders */}
                <button
                  type="button"
                  onClick={() => setWorkOrderFilter(workOrderFilter === 'completed' ? 'all' : 'completed')}
                  className={`p-2.5 sm:p-3 rounded-2xl border text-start transition-all cursor-pointer flex items-center justify-between ${
                    workOrderFilter === 'completed'
                      ? 'bg-emerald-700 text-white border-emerald-800 shadow-md scale-[1.01]'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-emerald-400 shadow-xs'
                  }`}
                >
                  <div>
                    <span className={`text-[9px] sm:text-[10px] font-bold block ${workOrderFilter === 'completed' ? 'text-emerald-100' : 'text-slate-500'}`}>
                      {isRtl ? 'منجزة ومكتملة' : 'Completed Work Orders'}
                    </span>
                    <span className={`text-base sm:text-lg font-black mt-0.5 block font-mono ${workOrderFilter === 'completed' ? 'text-white' : 'text-emerald-700'}`}>
                      {completedWorkOrders}
                    </span>
                  </div>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 ${workOrderFilter === 'completed' ? 'bg-emerald-800 text-white' : 'bg-emerald-50 text-emerald-700'}`}>
                    ✅
                  </div>
                </button>
              </div>
            );
          })()}

          <div className="bg-white rounded-3xl border border-slate-200/85 p-6 shadow-sm space-y-4 text-start">
            {(() => {
              const clientWorkOrders = quotations.filter(q => q.clientId === client.id && q.status === 'approved');

              const getWorkOrderStatus = (q: Quotation): 'new' | 'pending' | 'partially_completed' | 'completed' => {
                if (!q.executionReport) {
                  if (q.workOrderStatus === 'partially_completed') return 'partially_completed';
                  if (q.workOrderStatus === 'completed') return 'completed';
                  return q.assignedTechId ? 'pending' : 'new';
                }
                const total = q.items?.length || 0;
                const done = (q.executionReport.completedItems || []).length;
                if (total > 0) {
                  if (done >= total) return 'completed';
                  if (done > 0) return 'partially_completed';
                  return 'pending';
                }
                return 'completed';
              };

              const filteredWorkOrders = clientWorkOrders.filter(q => {
                if (workOrderFilter === 'all') return true;
                return getWorkOrderStatus(q) === workOrderFilter;
              });

              return (
                <>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-5 h-5 text-safety-emerald" />
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">
                          {isRtl ? 'أوامر العمل والصيانة المعتمدة' : 'Approved Work & Maintenance Orders'}
                        </h3>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-sans">
                          {isRtl 
                            ? 'متابعة حالة تنفيذ أعمال الصيانة وتركيب قطع الغيار المعتمدة، والاطلاع على التقارير الفنية للأعمال المنجزة وتواقيع الفنيين.' 
                            : 'Track the progress of approved maintenance, check technician execution reports and signed handovers.'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-emerald-600 text-white font-sans font-bold px-2.5 py-1 rounded-full">
                      {isRtl ? `${filteredWorkOrders.length} أمر عمل` : `${filteredWorkOrders.length} orders`}
                    </span>
                  </div>

                  {filteredWorkOrders.length === 0 ? (
                    <div className="py-12 text-center border border-dashed border-slate-200 bg-white rounded-3xl flex flex-col items-center justify-center p-6">
                      <span className="text-3xl p-3 bg-slate-50 rounded-full mb-2">🛠️</span>
                      <h4 className="font-bold text-slate-800 text-sm">{isRtl ? 'لا توجد أوامر عمل مطابقة لهذا التصنيف' : 'No Work Orders match this filter'}</h4>
                      {workOrderFilter !== 'all' && (
                        <button
                          type="button"
                          onClick={() => setWorkOrderFilter('all')}
                          className="mt-3 px-3 py-1.5 bg-slate-900 text-white text-[11px] font-bold rounded-xl hover:bg-slate-800 transition cursor-pointer"
                        >
                          {isRtl ? 'عرض جميع الأوامر' : 'Show All Orders'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white rounded-3xl border border-slate-150 shadow-xs overflow-hidden text-start">
                      <div className="px-6 py-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
                        <h3 className="font-black text-xs sm:text-sm text-slate-800">
                          {isRtl ? 'قائمة أوامر العمل والصيانة المعتمدة:' : 'Approved Work Orders List:'}
                        </h3>
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-black rounded-lg">
                          {filteredWorkOrders.length} {isRtl ? 'أمر عمل' : 'Work Orders'}
                        </span>
                      </div>

                      <div className="divide-y divide-slate-150">
                        {filteredWorkOrders.map((q) => {
                          const dateObj = new Date(q.date);
                          const formattedDate = dateObj.toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                          
                          const st = getWorkOrderStatus(q);
                          const doneCount = (q.executionReport?.completedItems || []).length;
                          const totalCount = q.items.length;
                          const isAssigned = !!q.assignedTechId;
                          
                          return (
                            <div 
                              key={q.id} 
                              className="p-5 hover:bg-slate-50/50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                            >
                              <div className="space-y-2 text-start flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-black text-slate-900 font-sans">
                                    {isRtl ? 'أمر عمل رقم' : 'Work Order Ref'}: #WO-{q.id.split('_')[1] || q.id}
                                  </span>

                                  {q.branchName && (
                                    <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 text-[9px] font-bold rounded-md">
                                      📍 {dt(q.branchName)}
                                    </span>
                                  )}

                                  {/* Status Badge */}
                                  {st === 'completed' ? (
                                    <span className="px-2.5 py-0.5 text-[9px] font-bold rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      {isRtl ? 'منجز ومكتمل ✅' : 'Completed ✅'}
                                    </span>
                                  ) : st === 'partially_completed' ? (
                                    <span className="px-2.5 py-0.5 text-[9px] font-bold rounded-md bg-orange-100 text-orange-800 border border-orange-200">
                                      {isRtl ? `منجز جزئياً (${doneCount}/${totalCount}) 🟠` : `Partially Completed (${doneCount}/${totalCount}) 🟠`}
                                    </span>
                                  ) : st === 'pending' ? (
                                    <span className="px-2.5 py-0.5 text-[9px] font-bold rounded-md bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                                      {isRtl ? 'قيد الانتظار ⏳' : 'Pending Execution ⏳'}
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-0.5 text-[9px] font-bold rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                      {isRtl ? 'بانتظار توجيه فني 📋' : 'Waiting Assignment 📋'}
                                    </span>
                                  )}
                                </div>

                                <div className="text-[11px] text-slate-500 font-sans flex items-center gap-4 flex-wrap">
                                  <span>📅 {isRtl ? 'تاريخ الاعتماد:' : 'Date Approved:'} <strong className="text-slate-800 font-semibold">{formattedDate}</strong></span>
                                  <span>👷‍♂️ {isRtl ? 'الفني المسؤول:' : 'Tech:'} {isAssigned ? <strong className="text-indigo-900 font-bold">{dt(q.assignedTechName)}</strong> : <span className="text-slate-400 italic">{isRtl ? 'بانتظار تعيين فني' : 'Unassigned'}</span>}</span>
                                  <span>💵 {isRtl ? 'الإجمالي:' : 'Total:'} <strong className="text-slate-800 font-bold">{q.grandTotal.toLocaleString()} {isRtl ? 'ريال' : 'SAR'}</strong></span>
                                  <span>📦 {q.items.length} {isRtl ? 'بنود صيانة' : 'items'}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setSelectedWorkOrder(q)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-black bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95"
                                >
                                  <Eye className="w-4 h-4" />
                                  <span>{isRtl ? 'عرض التفاصيل والتقرير' : 'View Details & Report'}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
            </>
          );
        })()}
      </div>
    </div>
  )}

      {activeSubTab === 'proformaInvoices' && (() => {
        const clientApprovedQuotes = quotations.filter(q => q.clientId === client.id && (q.status === 'approved' || q.isIndependentInvoice));

        const isIndependentInvoice = (q: Quotation): boolean => {
          return !!(q.isIndependentInvoice || (!q.visitId && q.id.startsWith('inv_')));
        };

        const searchedQuotes = clientApprovedQuotes.filter(q => {
          if (!proformaSearch.trim()) return true;
          const searchLower = proformaSearch.toLowerCase();
          const idMatch = q.id.toLowerCase().includes(searchLower);
          const branchMatch = (q.branchName || '').toLowerCase().includes(searchLower);
          const proformaNoMatch = (q.proformaInvoiceNumber || `PI-${q.id.split('_')[1] || q.id}`).toLowerCase().includes(searchLower);
          return idMatch || branchMatch || proformaNoMatch;
        });

        const getProformaStatus = (q: Quotation): 'paid' | 'partially_paid' | 'unpaid' => {
          const paid = q.paidAmount || (q.paymentHistory ? q.paymentHistory.reduce((s, p) => s + p.amount, 0) : 0);
          if (paid >= q.grandTotal || q.paymentStatus === 'paid') return 'paid';
          if (paid > 0 || q.paymentStatus === 'partially_paid') return 'partially_paid';
          return 'unpaid';
        };

        const finalProformas = searchedQuotes.filter(q => {
          if (proformaPaymentFilter === 'all') return true;
          if (proformaPaymentFilter === 'independent') return isIndependentInvoice(q);
          return getProformaStatus(q) === proformaPaymentFilter;
        });

        const unpaidCount = clientApprovedQuotes.filter(q => getProformaStatus(q) === 'unpaid').length;
        const partialCount = clientApprovedQuotes.filter(q => getProformaStatus(q) === 'partially_paid').length;
        const paidCount = clientApprovedQuotes.filter(q => getProformaStatus(q) === 'paid').length;
        const independentCount = clientApprovedQuotes.filter(isIndependentInvoice).length;

        return (
          <div className="space-y-6 text-start animate-fade-in">
            {/* Header Banner */}
            <div className="p-6 bg-gradient-to-r from-teal-900 via-slate-900 to-emerald-950 text-white rounded-3xl shadow-md border border-teal-800/40 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black flex items-center gap-2 text-teal-300">
                    <span>📑</span>
                    <span>{customization?.proformaInvoicesTabTitle || (isRtl ? 'الفواتير المبدئية' : 'Proforma Invoices')}</span>
                  </h2>
                  <p className="text-xs text-teal-200 mt-1">
                    {isRtl ? 'يمكنك الاطلاع وتحميل وطباعة الفواتير المبدئية المعتمدة فور موافقتك على عروض الأسعار.' : 'View, download, and print official proforma invoices generated for your approved quotations.'}
                  </p>
                </div>
                <div className="px-3 py-1 bg-teal-800/80 border border-teal-600/50 rounded-full text-xs font-bold font-mono text-teal-100">
                  {clientApprovedQuotes.length} {isRtl ? 'فاتورة مبدئية متاحة' : 'Proforma Invoices'}
                </div>
              </div>
            </div>

            {/* Filter & Search Controls Bar */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={proformaSearch}
                  onChange={(e) => setProformaSearch(e.target.value)}
                  placeholder={isRtl ? 'ابحث بالفرع أو رقم الفاتورة...' : 'Search branch or invoice no...'}
                  className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-600 font-medium"
                />
              </div>

              {/* Filter Tabs / Fields */}
              <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto no-scrollbar pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setProformaPaymentFilter('all')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                    proformaPaymentFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>📑</span>
                  <span>{isRtl ? 'جميع الفواتير' : 'All Invoices'}</span>
                  <span className={`px-2 py-0.5 text-[10px] rounded-full font-mono ${proformaPaymentFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                    {clientApprovedQuotes.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setProformaPaymentFilter('unpaid')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                    proformaPaymentFilter === 'unpaid'
                      ? 'bg-rose-700 text-white shadow-2xs'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60'
                  }`}
                >
                  <span>🔴</span>
                  <span>{isRtl ? 'بانتظار السداد' : 'Awaiting Payment'}</span>
                  <span className={`px-2 py-0.5 text-[10px] rounded-full font-mono ${proformaPaymentFilter === 'unpaid' ? 'bg-white/20 text-white' : 'bg-rose-200/80 text-rose-800'}`}>
                    {unpaidCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setProformaPaymentFilter('partially_paid')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                    proformaPaymentFilter === 'partially_paid'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60'
                  }`}
                >
                  <span>⏳</span>
                  <span>{isRtl ? 'مسدد جزئياً' : 'Partially Paid'}</span>
                  <span className={`px-2 py-0.5 text-[10px] rounded-full font-mono ${proformaPaymentFilter === 'partially_paid' ? 'bg-white/20 text-white' : 'bg-amber-200/80 text-amber-800'}`}>
                    {partialCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setProformaPaymentFilter('paid')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                    proformaPaymentFilter === 'paid'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
                  }`}
                >
                  <span>✓</span>
                  <span>{isRtl ? 'مسدد بالكامل' : 'Fully Paid'}</span>
                  <span className={`px-2 py-0.5 text-[10px] rounded-full font-mono ${proformaPaymentFilter === 'paid' ? 'bg-white/20 text-white' : 'bg-emerald-200/80 text-emerald-800'}`}>
                    {paidCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setProformaPaymentFilter('independent')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                    proformaPaymentFilter === 'independent'
                      ? 'bg-indigo-700 text-white shadow-2xs'
                      : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200/60'
                  }`}
                >
                  <span>📑</span>
                  <span>{isRtl ? 'فواتير مستقلة' : 'Independent Invoices'}</span>
                  <span className={`px-2 py-0.5 text-[10px] rounded-full font-mono ${proformaPaymentFilter === 'independent' ? 'bg-white/20 text-white' : 'bg-indigo-200/80 text-indigo-800'}`}>
                    {independentCount}
                  </span>
                </button>
              </div>
            </div>

            {/* List of Proforma Invoices */}
            {clientApprovedQuotes.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 space-y-3">
                <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mx-auto text-xl font-bold">
                  📑
                </div>
                <p className="text-xs font-bold text-slate-600">
                  {isRtl ? 'لا توجد فواتير مبدئية متاحة حالياً. تظهر الفواتير المبدئية عند قبول عرض سعر.' : 'No proforma invoices available. Approved quotations will generate proforma invoices automatically.'}
                </p>
              </div>
            ) : finalProformas.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto text-xl font-bold">
                  🔍
                </div>
                <p className="text-xs font-bold text-slate-600">
                  {isRtl ? 'لا توجد فواتير مطابقة لخيارات التصفية المحددة.' : 'No proforma invoices match the selected filter or search.'}
                </p>
                <button
                  type="button"
                  onClick={() => { setProformaPaymentFilter('all'); setProformaSearch(''); }}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  {isRtl ? 'عرض جميع الفواتير' : 'Show All Invoices'}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {finalProformas.map(q => {
                  const proformaNo = q.proformaInvoiceNumber || `PI-${q.id.split('_')[1] || q.id}`;
                  const clientTax = q.clientTaxNumber || client.taxNumber || '';
                  const clientCR = q.clientCrNumber || client.commercialRegister || '';
                  const clientAddr = q.clientNationalAddress || client.nationalAddress || client.locationText || 'الرياض، المملكة العربية السعودية';
                  const clientPhone = q.clientPhone || client.phone || '05xxxxxxxx';

                  const paid = q.paidAmount || (q.paymentHistory ? q.paymentHistory.reduce((s, p) => s + p.amount, 0) : 0);
                  const pStatus = getProformaStatus(q);
                  const surplus = paid > q.grandTotal ? parseFloat((paid - q.grandTotal).toFixed(2)) : 0;
                  const remaining = pStatus === 'paid' ? 0 : parseFloat((q.grandTotal - paid).toFixed(2));

                  const borderClass = pStatus === 'paid'
                    ? 'border-emerald-500/80'
                    : pStatus === 'partially_paid'
                      ? 'border-amber-400'
                      : 'border-rose-400';

                  return (
                    <div key={q.id} className={`p-4 bg-white rounded-2xl border-2 ${borderClass} shadow-xs hover:shadow-md transition space-y-3`}>
                      <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 pb-2.5">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-black text-xs text-teal-800 font-mono">
                              📑 {proformaNo}
                            </span>
                            <span className="text-[9.5px] font-bold bg-slate-100/90 text-slate-600 px-1.5 py-0.5 rounded font-mono border border-slate-200/60">
                              #{q.id.split('_')[1] || q.id}
                            </span>
                            {isIndependentInvoice(q) && (
                              <span className="text-[9px] font-black bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                                {isRtl ? 'فاتورة مستقلة' : 'Independent'}
                              </span>
                            )}
                          </div>
                          <h4 className="font-black text-xs text-slate-900 mt-0.5">{q.clientName}</h4>
                          <p className="text-[10.5px] text-slate-500 font-medium">{q.branchName || (isRtl ? 'الفرع الرئيسي' : 'Main Branch')}</p>
                        </div>

                        <div className="text-end shrink-0">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            pStatus === 'paid' 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                              : pStatus === 'partially_paid'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}>
                            {pStatus === 'paid' 
                              ? (surplus > 0 
                                  ? (isRtl ? `✓ مسدد بالكامل (+فائض ${surplus.toLocaleString()} ر.س)` : `✓ Paid (+${surplus.toLocaleString()} SAR)`)
                                  : (isRtl ? '✓ مسدد بالكامل' : '✓ Paid')) 
                              : pStatus === 'partially_paid'
                                ? (isRtl ? '⏳ سداد جزئي' : '⏳ Partial')
                                : (isRtl ? '🔴 بانتظار السداد' : '🔴 Pending Payment')}
                          </span>
                          <span className="text-[9.5px] text-slate-400 block mt-0.5 font-mono">{q.date}</span>
                        </div>
                      </div>

                      {/* Client Info Badges */}
                      <div className="p-2.5 bg-slate-50/70 rounded-xl border border-slate-200/70 space-y-1 text-[11px]">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-slate-400 font-bold block text-[10px]">{isRtl ? 'الرقم الضريبي:' : 'Tax No:'}</span>
                            <span className="font-mono font-bold text-slate-800">{clientTax}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-bold block text-[10px]">{isRtl ? 'السجل التجاري:' : 'CR No:'}</span>
                            <span className="font-mono font-bold text-slate-800">{clientCR}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-bold block text-[10px]">{isRtl ? 'الجوال:' : 'Phone:'}</span>
                            <span className="font-mono font-bold text-slate-800">{clientPhone}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-bold block text-[10px]">{isRtl ? 'العنوان الوطني:' : 'Address:'}</span>
                            <span className="font-bold text-slate-800 truncate block">{clientAddr}</span>
                          </div>
                        </div>
                      </div>

                      {/* Financial Totals */}
                      <div className="space-y-1 text-[11px] bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/70">
                        <div className="flex justify-between items-center text-slate-500">
                          <span>{isRtl ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
                          <span className="font-mono font-bold text-slate-800">{q.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} SAR</span>
                        </div>
                        {(q.discountAmount || 0) > 0 && (
                          <div className="flex justify-between items-center text-rose-600 font-bold">
                            <span>{isRtl ? 'خصم خاص:' : 'Discount:'}</span>
                            <span className="font-mono">-${(q.discountAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} SAR</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-slate-500">
                          <span>{isRtl ? 'ضريبة القيمة المضافة (15%):' : 'VAT (15%):'}</span>
                          <span className="font-mono font-bold text-slate-800">{q.vat.toLocaleString(undefined, { minimumFractionDigits: 2 })} SAR</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-black text-slate-900 border-t border-slate-200/80 pt-1.5">
                          <span>{isRtl ? 'الإجمالي المطلوب:' : 'Grand Total:'}</span>
                          <span className="font-mono text-teal-800 text-sm font-black">{q.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} SAR</span>
                        </div>

                        <div className="border-t border-slate-200/80 pt-1.5 space-y-1">
                          <div className="flex justify-between items-center text-emerald-800 font-bold text-[10.5px]">
                            <span>{isRtl ? 'المبلغ المسدد:' : 'Paid Amount:'}</span>
                            <span className="font-mono font-black">{paid.toLocaleString(undefined, { minimumFractionDigits: 2 })} SAR</span>
                          </div>

                          {surplus > 0 ? (
                            <div className="flex justify-between items-center p-2 bg-emerald-100/90 rounded-lg border border-emerald-300 text-emerald-900 text-[10.5px] font-black shadow-2xs">
                              <span className="flex items-center gap-1">
                                <span>💡</span>
                                <span>{isRtl ? 'رصيد زائد للعميل (فائض):' : 'Client Surplus:'}</span>
                              </span>
                              <span className="font-mono text-emerald-800 text-xs">+{surplus.toLocaleString(undefined, { minimumFractionDigits: 2 })} SAR</span>
                            </div>
                          ) : (
                            <div className={`flex justify-between items-center text-[10.5px] font-bold ${remaining > 0 ? 'text-rose-700 font-extrabold' : 'text-slate-500'}`}>
                              <span>{isRtl ? 'المتبقي للسداد:' : 'Remaining Balance:'}</span>
                              <span className="font-mono">{remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })} SAR</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Payment Receipt Badge if present */}
                      {q.paymentReceipt && (
                        <div className="flex items-center justify-between p-1.5 px-2.5 bg-emerald-50/80 rounded-lg border border-emerald-200/80 text-[10.5px]">
                          <div className="flex items-center gap-1.5 text-teal-850 font-bold truncate">
                            <span>📎</span>
                            <span>{isRtl ? 'إشعار السداد:' : 'Receipt:'}</span>
                            <span className="truncate text-teal-700 font-medium">{q.paymentReceipt.name}</span>
                          </div>
                          <span className="text-[9.5px] text-slate-500 shrink-0 font-mono">{q.paymentReceipt.uploadedAt}</span>
                        </div>
                      )}

                      {/* Actions - Single Compact Line */}
                      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200/80">
                        <button
                          type="button"
                          onClick={() => {
                            setViewingQuotation(q);
                            setShowViewQuoteModal(true);
                          }}
                          className="flex-1 min-w-0 py-1.5 px-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs truncate"
                          title={isRtl ? 'معاينة تفاصيل عرض السعر' : 'View Quotation Details'}
                        >
                          <span>👁️</span>
                          <span className="truncate">{isRtl ? 'معاينة العرض' : 'View Quote'}</span>
                        </button>

                        {/* Attachment / Upload Payment Receipt Button */}
                        {q.paymentReceipt ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setViewingPaymentReceiptModal(q.paymentReceipt!)}
                              className="py-1.5 px-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs whitespace-nowrap"
                              title={isRtl ? `معاينة إشعار السداد (${q.paymentReceipt.name})` : `View Payment Receipt (${q.paymentReceipt.name})`}
                            >
                              <span>📄</span>
                              <span>{isRtl ? 'إشعار السداد' : 'Receipt'}</span>
                              <span className="bg-emerald-500/40 px-1 rounded text-[9px]">✓</span>
                            </button>

                            <label
                              className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition flex items-center justify-center cursor-pointer shrink-0"
                              title={isRtl ? 'تغيير/إعادة إرفاق إشعار السداد' : 'Change Payment Receipt'}
                            >
                              <span>🔄</span>
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                className="hidden"
                                onChange={(e) => handleUploadPaymentReceipt(e, q)}
                              />
                            </label>
                          </div>
                        ) : (
                          <label
                            className="py-1.5 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-teal-850 border border-teal-200/80 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
                            title={isRtl ? 'إرفاق صورة أو ملف PDF لإشعار السداد' : 'Attach payment receipt image or PDF'}
                          >
                            <span>📎</span>
                            <span>{isRtl ? 'إشعار السداد' : 'Attach Receipt'}</span>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="hidden"
                              onChange={(e) => handleUploadPaymentReceipt(e, q)}
                            />
                          </label>
                        )}

                        <button
                          type="button"
                          onClick={() => handlePrintProformaInvoice(q)}
                          className="py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                          title={isRtl ? 'طباعة / تصدير PDF' : 'Print / Export PDF'}
                        >
                          <span>🖨️</span>
                          <span>{isRtl ? 'طباعة' : 'Print'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {activeSubTab === 'archive' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/85 p-6 shadow-sm space-y-6 text-start">
            {/* Header Title & Subtitle */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-safety-emerald animate-pulse" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {isRtl ? 'محرك البحث والفلترة المتقدم للأرشيف والتقارير' : 'Archive - Advanced Search & Filters'}
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-sans">
                    {isRtl 
                      ? 'محرك البحث الذكي لفلترة وتصفية زيارات وتقارير الصيانة وعرض تفاصيل الفحص وتنزيلها.' 
                      : 'Smart search engine to filter and view site inspection visits and download reports.'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-600 font-sans font-bold px-2.5 py-1 rounded-lg border border-slate-200">
                {isRtl ? `التقارير المتوفرة: ${clientVisits.length}` : `Total Reports: ${clientVisits.length}`}
              </span>
            </div>

            {/* Calendar Search Row (بحث بالتقويم) */}
            <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-sans">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-emerald-100 text-teal-800 rounded-xl text-base">📅</span>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>{isRtl ? 'بحث بالتقويم (عرض الزيارات المقررة والمجدولة)' : 'Calendar Search (Scheduled Visits)'}</span>
                    {(archiveFilterYear !== 'all' || archiveFilterMonth !== 'all') && (
                      <span className="bg-teal-600 text-white text-[9px] px-2 py-0.5 rounded-full font-mono">
                        {archiveFilterYear !== 'all' ? archiveFilterYear : ''} {archiveFilterMonth !== 'all' ? `/${archiveFilterMonth}` : ''}
                      </span>
                    )}
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    {isRtl ? 'حدد السنة والشهر لتصفية وإظهار الزيارات الدورية المقررة لمنشأتك' : 'Select year & month to filter scheduled maintenance visits'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                {/* Year Select */}
                <div className="flex-1 md:w-36">
                  <select
                    value={archiveFilterYear}
                    onChange={(e) => setArchiveFilterYear(e.target.value)}
                    className="w-full bg-white border border-emerald-200 hover:border-emerald-400 focus:border-safety-emerald rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none shadow-2xs cursor-pointer"
                  >
                    <option value="all">{isRtl ? '📅 كافة السنوات' : 'All Years'}</option>
                    {YEARS_LIST.map(yr => (
                      <option key={yr} value={yr}>{isRtl ? `سنة ${yr}` : yr}</option>
                    ))}
                  </select>
                </div>

                {/* Month Select */}
                <div className="flex-1 md:w-44">
                  <select
                    value={archiveFilterMonth}
                    onChange={(e) => setArchiveFilterMonth(e.target.value)}
                    className="w-full bg-white border border-emerald-200 hover:border-emerald-400 focus:border-safety-emerald rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none shadow-2xs cursor-pointer"
                  >
                    <option value="all">{isRtl ? '🗓️ كافة الشهور' : 'All Months'}</option>
                    {MONTHS_LIST.map(m => (
                      <option key={m.value} value={m.value}>{isRtl ? m.labelAr : m.labelEn}</option>
                    ))}
                  </select>
                </div>

                {(archiveFilterYear !== 'all' || archiveFilterMonth !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setArchiveFilterYear('all');
                      setArchiveFilterMonth('all');
                    }}
                    className="text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 px-2 py-1.5 rounded-xl transition cursor-pointer"
                    title={isRtl ? 'إلغاء فلترة التقويم' : 'Clear calendar filter'}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Search & Filters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-150/60 font-sans">
              
              {/* 1. Search Box - branch name */}
              <div className="space-y-1 md:col-span-1">
                <label className="text-[10px] font-bold text-slate-500 block">
                  {isRtl ? 'البحث باسم الفرع' : 'Search by branch name'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={archiveSearchQuery}
                    onChange={(e) => setArchiveSearchQuery(e.target.value)}
                    placeholder={isRtl ? 'اكتب اسم الفرع...' : 'Enter branch name...'}
                    className="w-full bg-white border border-slate-200 hover:border-slate-350 focus:border-safety-emerald rounded-xl px-3 py-2 pr-8 text-xs font-semibold text-slate-805 focus:outline-none shadow-xs"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* 2. Statuses Dropdown */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 block">
                  {isRtl ? 'حالة التقارير والزيارة' : 'Visit/Report Status'}
                </label>
                <select
                  value={archiveFilterStatus}
                  onChange={(e) => setArchiveFilterStatus(e.target.value)}
                  className="w-full bg-white border border-slate-200 hover:border-slate-350 focus:border-safety-emerald rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-805 focus:outline-none shadow-xs cursor-pointer"
                >
                  <option value="all">{t.allStatuses}</option>
                  <option value="completed">{t.completedStatus}</option>
                  <option value="pending">{t.pendingStatus}</option>
                </select>
              </div>

              {/* 3. Safety Ratings Dropdown */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 block">
                  {isRtl ? 'تصنيف فحص السلامة' : 'Safety Check Grade'}
                </label>
                <select
                  value={archiveFilterResult}
                  onChange={(e) => setArchiveFilterResult(e.target.value)}
                  className="w-full bg-white border border-slate-200 hover:border-slate-350 focus:border-safety-emerald rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-805 focus:outline-none shadow-xs cursor-pointer"
                >
                  <option value="all">{t.allVisitResults}</option>
                  <option value="passed">{t.passedResult}</option>
                  <option value="has_defects">{t.hasDefectsResult}</option>
                  <option value="critical_issues">{t.criticalResult}</option>
                </select>
              </div>

              {/* 4. Media/Attachment Types Dropdown */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 block">
                  {isRtl ? 'نوع المرفق بالمستند' : 'Attachment Type'}
                </label>
                <select
                  value={archiveFilterMedia}
                  onChange={(e) => setArchiveFilterMedia(e.target.value)}
                  className="w-full bg-white border border-slate-200 hover:border-slate-350 focus:border-safety-emerald rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-805 focus:outline-none shadow-xs cursor-pointer"
                >
                  <option value="all">{t.allMediaTypes}</option>
                  <option value="image">{t.mediaImage}</option>
                  <option value="video">{t.mediaVideo}</option>
                  <option value="pdf">{t.mediaPdf}</option>
                </select>
              </div>

            </div>

            {/* Reset Filters Option */}
            {(archiveSearchQuery || archiveFilterStatus !== 'all' || archiveFilterResult !== 'all' || archiveFilterMedia !== 'all' || archiveFilterYear !== 'all' || archiveFilterMonth !== 'all') && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setArchiveSearchQuery('');
                    setArchiveFilterStatus('all');
                    setArchiveFilterResult('all');
                    setArchiveFilterMedia('all');
                    setArchiveFilterYear('all');
                    setArchiveFilterMonth('all');
                  }}
                  className="text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                >
                  ✕ {t.resetFilters}
                </button>
              </div>
            )}

            {/* Results Banner */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-700">
                {isRtl 
                  ? `تم العثور على (${(() => {
                      const list = clientVisits.filter(v => {
                        const matchesSearch = !archiveSearchQuery.trim() || 
                          (v.branchName && v.branchName.toLowerCase().includes(archiveSearchQuery.toLowerCase())) ||
                          (v.notes && v.notes.toLowerCase().includes(archiveSearchQuery.toLowerCase())) ||
                          (v.defects && v.defects.toLowerCase().includes(archiveSearchQuery.toLowerCase()));
                        const matchesStatus = archiveFilterStatus === 'all' || v.status === archiveFilterStatus;
                        const matchesResult = archiveFilterResult === 'all' || v.result === archiveFilterResult;
                        let matchesMedia = true;
                        if (archiveFilterMedia !== 'all') {
                          if (!v.attachments || v.attachments.length === 0) {
                            matchesMedia = false;
                          } else {
                            matchesMedia = v.attachments.some(att => att.type === archiveFilterMedia);
                          }
                        }
                        const visitDate = v.scheduledDate || v.completedDate || '';
                        let matchesYear = true;
                        if (archiveFilterYear !== 'all') {
                          matchesYear = visitDate.startsWith(archiveFilterYear);
                        }
                        let matchesMonth = true;
                        if (archiveFilterMonth !== 'all') {
                          const parts = visitDate.split('-');
                          matchesMonth = parts.length >= 2 && parts[1] === archiveFilterMonth;
                        }
                        return matchesSearch && matchesStatus && matchesResult && matchesMedia && matchesYear && matchesMonth;
                      });
                      return list.length;
                    })()}) نتيجة زيارة تطابق الفلترة` 
                  : `Found (${(() => {
                      const list = clientVisits.filter(v => {
                        const matchesSearch = !archiveSearchQuery.trim() || 
                          (v.branchName && v.branchName.toLowerCase().includes(archiveSearchQuery.toLowerCase())) ||
                          (v.notes && v.notes.toLowerCase().includes(archiveSearchQuery.toLowerCase())) ||
                          (v.defects && v.defects.toLowerCase().includes(archiveSearchQuery.toLowerCase()));
                        const matchesStatus = archiveFilterStatus === 'all' || v.status === archiveFilterStatus;
                        const matchesResult = archiveFilterResult === 'all' || v.result === archiveFilterResult;
                        let matchesMedia = true;
                        if (archiveFilterMedia !== 'all') {
                          if (!v.attachments || v.attachments.length === 0) {
                            matchesMedia = false;
                          } else {
                            matchesMedia = v.attachments.some(att => att.type === archiveFilterMedia);
                          }
                        }
                        const visitDate = v.scheduledDate || v.completedDate || '';
                        let matchesYear = true;
                        if (archiveFilterYear !== 'all') {
                          matchesYear = visitDate.startsWith(archiveFilterYear);
                        }
                        let matchesMonth = true;
                        if (archiveFilterMonth !== 'all') {
                          const parts = visitDate.split('-');
                          matchesMonth = parts.length >= 2 && parts[1] === archiveFilterMonth;
                        }
                        return matchesSearch && matchesStatus && matchesResult && matchesMedia && matchesYear && matchesMonth;
                      });
                      return list.length;
                    })()}) matching visit reports`}
              </span>
            </div>

            {/* Results List */}
            {(() => {
              const list = clientVisits.filter(v => {
                const matchesSearch = !archiveSearchQuery.trim() || 
                  (v.branchName && v.branchName.toLowerCase().includes(archiveSearchQuery.toLowerCase())) ||
                  (v.notes && v.notes.toLowerCase().includes(archiveSearchQuery.toLowerCase())) ||
                  (v.defects && v.defects.toLowerCase().includes(archiveSearchQuery.toLowerCase()));
                const matchesStatus = archiveFilterStatus === 'all' || v.status === archiveFilterStatus;
                const matchesResult = archiveFilterResult === 'all' || v.result === archiveFilterResult;
                let matchesMedia = true;
                if (archiveFilterMedia !== 'all') {
                  if (!v.attachments || v.attachments.length === 0) {
                    matchesMedia = false;
                  } else {
                    matchesMedia = v.attachments.some(att => att.type === archiveFilterMedia);
                  }
                }
                const visitDate = v.scheduledDate || v.completedDate || '';
                let matchesYear = true;
                if (archiveFilterYear !== 'all') {
                  matchesYear = visitDate.startsWith(archiveFilterYear);
                }
                let matchesMonth = true;
                if (archiveFilterMonth !== 'all') {
                  const parts = visitDate.split('-');
                  matchesMonth = parts.length >= 2 && parts[1] === archiveFilterMonth;
                }
                return matchesSearch && matchesStatus && matchesResult && matchesMedia && matchesYear && matchesMonth;
              });

              if (list.length === 0) {
                return (
                  <div className="py-12 text-center border border-dashed border-slate-200 bg-slate-50 rounded-2xl flex flex-col items-center justify-center p-6">
                    <span className="text-3xl p-4 bg-white rounded-full shadow-xs mb-3">📭</span>
                    <h4 className="font-bold text-slate-700 text-xs">{isRtl ? 'لا توجد نتائج مطابقة' : 'No Matching Reports'}</h4>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-sm mx-auto">
                      {isRtl 
                        ? 'لم نعثر على أي تقارير صيانة أو فحص تطابق فلاتر البحث الحالية. يرجى تعديل خيارات البحث.' 
                        : 'No reports match your current search terms. Try modifying your filters.'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {list.map((visit, index) => {
                    const num = index + 1;
                    const hasAttachments = visit.attachments && visit.attachments.length > 0;
                    const hasPdf = visit.attachments && visit.attachments.some(att => att.type === 'pdf');
                    const hasImage = visit.attachments && visit.attachments.some(att => att.type === 'image');
                    const hasVideo = visit.attachments && visit.attachments.some(att => att.type === 'video');

                    return (
                      <div 
                        key={visit.id}
                        className="p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-slate-350 transition flex flex-col md:flex-row md:items-center justify-between gap-4 text-start font-sans"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="w-5 h-5 bg-slate-200 text-slate-800 text-[10px] font-extrabold rounded-full flex items-center justify-center font-sans shrink-0">
                              {num}
                            </span>
                            {visit.branchName && (
                              <span className="inline-block bg-teal-50 border border-teal-100 text-teal-850 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                                📍 {dt(visit.branchName)}
                              </span>
                            )}
                            
                            {/* Status Badge */}
                            {visit.status === 'completed' ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded-md">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                {isRtl ? 'مكتملة وموقعة' : 'Completed'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-100 text-amber-800 text-[9px] font-black px-2 py-0.5 rounded-md">
                                <Clock className="w-2.5 h-2.5 text-amber-600" />
                                {isRtl ? 'مجدولة وبانتظار الفحص' : 'Scheduled'}
                              </span>
                            )}

                            {/* Safety Assessment Badge */}
                            {visit.status === 'completed' && (
                              <>
                                {visit.result === 'passed' && (
                                  <span className="bg-emerald-100/70 text-emerald-900 border border-emerald-200 text-[9px] font-bold px-2 py-0.5 rounded-md">
                                    {isRtl ? 'أنظمة سليمة ومطابقة ✅' : 'Passed ✅'}
                                  </span>
                                )}
                                {visit.result === 'has_defects' && (
                                  <span className="bg-amber-100/70 text-amber-900 border border-amber-200 text-[9px] font-bold px-2 py-0.5 rounded-md">
                                    {isRtl ? 'أعطال أو نواقص طفيفة ⚠️' : 'Minor Defects ⚠️'}
                                  </span>
                                )}
                                {visit.result === 'critical_issues' && (
                                  <span className="bg-rose-100/70 text-rose-900 border border-rose-200 text-[9px] font-bold px-2 py-0.5 rounded-md">
                                    {isRtl ? 'خطورة عالية وتحتاج صيانة 🚨' : 'Critical Issues 🚨'}
                                  </span>
                                )}
                              </>
                            )}
                          </div>

                          {/* Metadata line */}
                          <div className="flex items-center gap-4 text-[10px] text-slate-450 flex-wrap">
                            <span className="flex items-center gap-1 font-mono">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {formatDateDMY(visit.scheduledDate)}
                            </span>
                            {visit.contractNumber && (
                              <span className="font-mono">
                                #{visit.contractNumber}
                              </span>
                            )}
                            
                            {/* Media pills */}
                            {hasAttachments && (
                              <div className="flex items-center gap-1">
                                {hasPdf && <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded text-[8px] font-bold font-sans">📄 PDF</span>}
                                {hasImage && <span className="bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded text-[8px] font-bold font-sans">📷 {isRtl ? 'صورة' : 'Photo'}</span>}
                                {hasVideo && <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-[8px] font-bold font-sans">🎥 {isRtl ? 'فيديو' : 'Video'}</span>}
                              </div>
                            )}
                          </div>

                          {/* Notes Preview */}
                          {visit.notes && (
                            <p className="text-[10px] text-slate-500 italic line-clamp-1 max-w-xl">
                              💬 {dt(visit.notes)}
                            </p>
                          )}
                        </div>

                        {/* Right hand side action button */}
                        <div className="flex items-center shrink-0 self-end md:self-center">
                          <button
                            type="button"
                            onClick={() => onSelectVisit && onSelectVisit(visit)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl transition cursor-pointer shadow-xs select-none"
                          >
                            <Eye className="w-3.5 h-3.5 text-safety-emerald" />
                            <span>{isRtl ? 'عرض التقرير وتفاصيل الفحص' : 'View Report & Details'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {activeSubTab === 'licenses' && (
        <div className="space-y-6 text-start font-sans">
          {/* Success Toast */}
          {licenseSaveSuccessMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center justify-between text-xs font-bold animate-fade-in shadow-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{licenseSaveSuccessMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setLicenseSaveSuccessMsg('')}
                className="text-emerald-700 hover:text-emerald-950 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Header Banner */}
          <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-slate-950 text-white rounded-3xl p-6 shadow-md border border-teal-800/40 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-300 flex items-center justify-center text-2xl shrink-0 border border-teal-500/30 shadow-inner">
                  🏛️
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-base sm:text-lg text-white">
                      {isRtl ? 'التراخيص النظامية والشهادات المعتمدة للمنشأة' : 'Facility Statutory Licenses & Certified Safety Reports'}
                    </h3>
                    <span className="bg-teal-500/20 text-teal-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-teal-500/30">
                      {isRtl ? 'الامتثال لكود البناء والدفاع المدني' : 'SBC & Civil Defense Compliance'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-2xl">
                    {isRtl 
                      ? 'يمكنك من هنا إرفاق وتوثيق التراخيص الـ 6 الخاصة بمنشأتك (رخصة البلدية، رخصة الدفاع المدني، رخصة إنجاز، تقرير فني، تقرير هندسي، شهادة إنهاء ومطابقة أعمال). تظهر هذه التراخيص للمشرف العام عند الدخول لبيانات منشأتكم من سجل العملاء.' 
                      : 'Upload and manage your 6 facility licenses (Municipality, Civil Defense, Enjaz, Technical Report, Engineering Report, and Work Completion Certificate). These are directly visible to the General Supervisor in the client registry.'}
                  </p>
                </div>
              </div>

              {/* Quick Global Action */}
              <div className="flex items-center gap-2 self-start md:self-center">
                <button
                  type="button"
                  onClick={() => handleOpenEditLicense('municipal')}
                  className="px-4 py-2.5 bg-safety-emerald hover:bg-emerald-600 active:scale-95 text-slate-950 font-black rounded-xl text-xs transition cursor-pointer flex items-center gap-2 shadow-lg"
                >
                  <Upload className="w-4 h-4 text-slate-950" />
                  <span>{isRtl ? 'إرفاق ترخيص جديد' : 'Upload License'}</span>
                </button>
              </div>
            </div>

            {/* 4 Metric KPI Cards */}
            {(() => {
              const uploadedCount = (client.licenses || []).filter(l => l.fileUrl || l.documentNumber).length;
              let validCount = 0;
              let expiringCount = 0;
              let expiredCount = 0;
              (client.licenses || []).forEach(l => {
                if (l.expiryDate) {
                  const status = getLicenseStatus(l.expiryDate);
                  if (status === 'valid') validCount++;
                  else if (status === 'expiring') expiringCount++;
                  else if (status === 'expired') expiredCount++;
                } else if (l.fileUrl || l.documentNumber) {
                  validCount++;
                }
              });
              const missingCount = Math.max(0, 6 - uploadedCount);

              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="bg-white/10 backdrop-blur-xs border border-white/15 p-3 rounded-2xl">
                    <span className="text-[10px] text-teal-200 block font-bold">{isRtl ? 'إجمالي المرفق' : 'Uploaded'}</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-mono font-black text-white">{uploadedCount}</span>
                      <span className="text-[10px] text-slate-300">/ 6</span>
                    </div>
                  </div>

                  <div className="bg-white/10 backdrop-blur-xs border border-white/15 p-3 rounded-2xl">
                    <span className="text-[10px] text-emerald-300 block font-bold">{isRtl ? 'سارية الصلاحية' : 'Valid'}</span>
                    <span className="text-xl font-mono font-black text-emerald-400 block mt-1">{validCount}</span>
                  </div>

                  <div className="bg-white/10 backdrop-blur-xs border border-white/15 p-3 rounded-2xl">
                    <span className="text-[10px] text-amber-300 block font-bold">{isRtl ? 'قيد أو منتهية الصلاحية' : 'Expiring / Expired'}</span>
                    <span className="text-xl font-mono font-black text-amber-400 block mt-1">{expiringCount + expiredCount}</span>
                  </div>

                  <div className="bg-white/10 backdrop-blur-xs border border-white/15 p-3 rounded-2xl">
                    <span className="text-[10px] text-slate-300 block font-bold">{isRtl ? 'بانتظار الإرفاق' : 'Missing'}</span>
                    <span className="text-xl font-mono font-black text-slate-300 block mt-1">{missingCount}</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <input
                type="text"
                value={licenseSearchQuery}
                onChange={(e) => setLicenseSearchQuery(e.target.value)}
                placeholder={isRtl ? 'ابحث باسم الترخيص أو رقم المستند...' : 'Search by license name or document number...'}
                className="w-full bg-slate-50 border border-slate-200 focus:border-safety-emerald rounded-xl px-3 py-2 pr-8 text-xs font-bold text-slate-800 focus:outline-none"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={licenseStatusFilter}
                onChange={(e) => setLicenseStatusFilter(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 focus:border-safety-emerald rounded-xl px-3 py-2 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none"
              >
                <option value="all">{isRtl ? '📋 كافة الحالات' : 'All Statuses'}</option>
                <option value="valid">{isRtl ? '✅ سارية الصلاحية' : 'Valid'}</option>
                <option value="expiring">{isRtl ? '⚠️ تنتهي قريباً (خلال 30 يوم)' : 'Expiring Soon'}</option>
                <option value="expired">{isRtl ? '🚨 منتهية الصلاحية' : 'Expired'}</option>
                <option value="missing">{isRtl ? '⚪ غير مرفقة بعد' : 'Missing'}</option>
              </select>

              {(licenseSearchQuery || licenseStatusFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setLicenseSearchQuery('');
                    setLicenseStatusFilter('all');
                  }}
                  className="px-2.5 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition cursor-pointer"
                  title={isRtl ? 'إعادة ضبط' : 'Reset'}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* The 6 License Bento Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {LICENSE_CATEGORIES.filter(catMeta => {
              const lic = (client.licenses || []).find(l => l.category === catMeta.category);
              const matchesSearch = !licenseSearchQuery.trim() ||
                catMeta.titleAr.toLowerCase().includes(licenseSearchQuery.toLowerCase()) ||
                catMeta.titleEn.toLowerCase().includes(licenseSearchQuery.toLowerCase()) ||
                (lic?.documentNumber && lic.documentNumber.toLowerCase().includes(licenseSearchQuery.toLowerCase())) ||
                (lic?.notes && lic.notes.toLowerCase().includes(licenseSearchQuery.toLowerCase()));

              if (!matchesSearch) return false;

              if (licenseStatusFilter === 'all') return true;
              if (licenseStatusFilter === 'missing') return !lic || (!lic.fileUrl && !lic.documentNumber);
              if (!lic || (!lic.fileUrl && !lic.documentNumber)) return false;
              if (!lic.expiryDate) return licenseStatusFilter === 'valid';
              const status = getLicenseStatus(lic.expiryDate);
              return status === licenseStatusFilter;
            }).map((catMeta) => {
              const lic = (client.licenses || []).find(l => l.category === catMeta.category);
              const hasFile = !!lic?.fileUrl;
              const hasData = !!lic && (!!lic.fileUrl || !!lic.documentNumber);
              const status = lic?.expiryDate ? getLicenseStatus(lic.expiryDate) : hasData ? 'valid' : 'none';
              const remainingDays = getLicenseRemainingDays(lic?.expiryDate);

              return (
                <div
                  key={catMeta.category}
                  className={`bg-white rounded-3xl border transition-all duration-200 p-5 flex flex-col justify-between shadow-xs hover:shadow-md ${
                    status === 'expired'
                      ? 'border-rose-250 ring-1 ring-rose-100'
                      : status === 'expiring'
                        ? 'border-amber-250 ring-1 ring-amber-100'
                        : hasData
                          ? 'border-emerald-250 hover:border-emerald-400'
                          : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-4 text-start">
                    {/* Top Row: Icon + Title + Status Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl p-2.5 bg-slate-50 border border-slate-150 rounded-2xl shrink-0">
                          {catMeta.icon}
                        </span>
                        <div>
                          <h4 className="font-black text-slate-900 text-sm sm:text-base leading-tight">
                            {catMeta.titleAr}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
                            {catMeta.titleEn}
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      {status === 'expired' && (
                        <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-[10px] font-black rounded-xl border border-rose-200 whitespace-nowrap animate-pulse">
                          🚨 {isRtl ? 'منتهية الصلاحية' : 'Expired'}
                        </span>
                      )}
                      {status === 'expiring' && (
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-black rounded-xl border border-amber-200 whitespace-nowrap">
                          ⚠️ {isRtl ? 'تنتهي قريباً' : 'Expiring Soon'}
                        </span>
                      )}
                      {status === 'valid' && (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-xl border border-emerald-200 whitespace-nowrap">
                          ✅ {isRtl ? 'سارية الصلاحية' : 'Valid'}
                        </span>
                      )}
                      {status === 'none' && (
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-xl border border-slate-200 whitespace-nowrap">
                          ⚪ {isRtl ? 'غير مرفقة بعد' : 'Not Uploaded'}
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50/70 p-2.5 rounded-xl border border-slate-150/70">
                      {isRtl ? catMeta.descriptionAr : catMeta.descriptionEn}
                    </p>

                    {/* Metadata Details Table */}
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center py-1 border-b border-slate-100">
                        <span className="text-slate-400 text-[11px] font-bold">{isRtl ? 'رقم المستند / الرخصة:' : 'Document No:'}</span>
                        <strong className="text-slate-800 font-mono text-[11px]">
                          {lic?.documentNumber || <span className="text-slate-400 font-normal">{isRtl ? 'غير محدد' : 'N/A'}</span>}
                        </strong>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-slate-100">
                        <span className="text-slate-400 text-[11px] font-bold">{isRtl ? 'تاريخ الإصدار:' : 'Issue Date:'}</span>
                        <span className="text-slate-700 font-mono text-[11px] font-bold">
                          {lic?.issueDate ? formatDateDMY(lic.issueDate) : <span className="text-slate-400 font-normal">---</span>}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-slate-100">
                        <span className="text-slate-400 text-[11px] font-bold">{isRtl ? 'تاريخ الانتهاء:' : 'Expiry Date:'}</span>
                        <div className="text-end">
                          <span className={`font-mono text-[11px] font-bold ${
                            status === 'expired' ? 'text-rose-600' : status === 'expiring' ? 'text-amber-600' : 'text-slate-700'
                          }`}>
                            {lic?.expiryDate ? formatDateDMY(lic.expiryDate) : <span className="text-slate-400 font-normal">---</span>}
                          </span>
                          {remainingDays !== null && (
                            <span className="text-[9px] block font-sans text-slate-500">
                              {remainingDays < 0 
                                ? (isRtl ? `(منتهية منذ ${Math.abs(remainingDays)} يوم)` : `(${Math.abs(remainingDays)} days ago)`)
                                : (isRtl ? `(متبقي ${remainingDays} يوم)` : `(${remainingDays} days left)`)}
                            </span>
                          )}
                        </div>
                      </div>

                      {lic?.notes && (
                        <div className="py-1">
                          <span className="text-slate-400 text-[10px] font-bold block">{isRtl ? 'ملاحظات:' : 'Notes:'}</span>
                          <p className="text-[11px] text-slate-600 italic line-clamp-2 mt-0.5">
                            {lic.notes}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Attached File Card */}
                    {hasFile ? (
                      <div className="p-3 bg-teal-50/60 border border-teal-200/80 rounded-2xl flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-teal-700 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-black text-teal-950 truncate" title={lic.fileName || 'document.pdf'}>
                              {lic.fileName || `${catMeta.titleAr}.pdf`}
                            </p>
                            <span className="text-[10px] text-teal-700 font-mono block">
                              {lic.fileSize || 'PDF/Image'} {lic.uploadedAt ? `• ${formatDateDMY(lic.uploadedAt)}` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setViewingFile({
                              name: lic.fileName || catMeta.titleAr,
                              url: lic.fileUrl!,
                              clientName: client.name,
                              type: 'license'
                            })}
                            className="p-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                            title={isRtl ? 'معاينة المستند' : 'Preview Document'}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={lic.fileUrl}
                            download={lic.fileName || `${catMeta.titleAr}.pdf`}
                            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition"
                            title={isRtl ? 'تحميل الملف' : 'Download File'}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-[11px] text-slate-400">
                        📁 {isRtl ? 'لا يوجد ملف مرفق حتى الآن' : 'No document file uploaded yet'}
                      </div>
                    )}
                  </div>

                  {/* Card Action Buttons */}
                  <div className="pt-4 border-t border-slate-150 mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEditLicense(catMeta.category)}
                      className="flex-1 py-2 px-3 bg-slate-900 hover:bg-teal-900 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Edit className="w-3.5 h-3.5 text-safety-emerald" />
                      <span>{hasData ? (isRtl ? 'تحديث وتعديل الرخصة' : 'Update License') : (isRtl ? 'إرفاق وتوثيق الرخصة' : 'Attach License')}</span>
                    </button>

                    {hasData && (
                      <button
                        type="button"
                        onClick={() => handleDeleteLicense(catMeta.category)}
                        className="p-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition cursor-pointer"
                        title={isRtl ? 'حذف هذا الترخيص' : 'Delete License'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Upload / Edit License Modal */}
          {editingLicenseCategory && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in text-start">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
                
                {/* Modal Header */}
                {(() => {
                  const catMeta = LICENSE_CATEGORIES.find(c => c.category === editingLicenseCategory);
                  return (
                    <div className="px-6 py-4 bg-gradient-to-r from-teal-900 to-slate-900 text-white flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{catMeta?.icon || '🏛️'}</span>
                        <div>
                          <h3 className="text-sm font-bold text-white">
                            {isRtl ? `إرفاق وتوثيق: ${catMeta?.titleAr}` : `Attach: ${catMeta?.titleEn}`}
                          </h3>
                          <span className="text-[10px] text-teal-300 block">{catMeta?.titleEn}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingLicenseCategory(null)}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })()}

                {/* Modal Form */}
                <div className="p-6 overflow-y-auto space-y-4 flex-1">
                  
                  {/* Category description reminder */}
                  {(() => {
                    const catMeta = LICENSE_CATEGORIES.find(c => c.category === editingLicenseCategory);
                    return catMeta ? (
                      <div className="p-3 bg-teal-50 border border-teal-150 rounded-2xl text-[11px] text-teal-900 leading-relaxed font-semibold">
                        💡 {isRtl ? catMeta.descriptionAr : catMeta.descriptionEn}
                      </div>
                    ) : null;
                  })()}

                  {/* Document Number */}
                  <div className="space-y-1">
                    <label className="text-xs font-extrabold text-slate-700 block">
                      {isRtl ? 'رقم الترخيص / رقم المستند الرسمي:' : 'Official Document / License Number:'}
                    </label>
                    <input
                      type="text"
                      value={licenseDocNumber}
                      onChange={(e) => setLicenseDocNumber(e.target.value)}
                      placeholder={isRtl ? 'مثال: 441002345 أو BLD-99823' : 'e.g. 441002345 or BLD-99823'}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-safety-emerald rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none font-mono"
                    />
                  </div>

                  {/* Issue Date & Expiry Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-extrabold text-slate-700 block">
                        {isRtl ? 'تاريخ الإصدار:' : 'Issue Date:'}
                      </label>
                      <input
                        type="date"
                        value={licenseIssueDate}
                        onChange={(e) => setLicenseIssueDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-safety-emerald rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none font-mono cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-extrabold text-slate-700 block">
                        {isRtl ? 'تاريخ انتهاء الصلاحية:' : 'Expiry Date:'}
                      </label>
                      <input
                        type="date"
                        value={licenseExpiryDate}
                        onChange={(e) => setLicenseExpiryDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-safety-emerald rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none font-mono cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1">
                    <label className="text-xs font-extrabold text-slate-700 block">
                      {isRtl ? 'ملاحظات وتفاصيل إضافية:' : 'Additional Notes / Scope:'}
                    </label>
                    <textarea
                      rows={2}
                      value={licenseNotes}
                      onChange={(e) => setLicenseNotes(e.target.value)}
                      placeholder={isRtl ? 'اكتب أي تفاصيل هامة عن الترخيص أو المكتب الهندسي...' : 'Enter any key notes or issuing entity...'}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-safety-emerald rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none"
                    />
                  </div>

                  {/* File Upload Zone */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="text-xs font-extrabold text-slate-700 block">
                      {isRtl ? 'إرفاق ملف الترخيص (PDF أو صورة):' : 'Attach License File (PDF or Image):'}
                    </label>

                    {licenseFile ? (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="w-5 h-5 text-emerald-700 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-emerald-950 block truncate" title={licenseFile.name}>
                              {licenseFile.name}
                            </span>
                            {licenseFile.size && (
                              <span className="text-[10px] text-emerald-700 font-mono block">
                                {licenseFile.size}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setViewingFile({ name: licenseFile.name, url: licenseFile.url, clientName: client.name, type: 'license' })}
                            className="p-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                            title={isRtl ? 'معاينة' : 'Preview'}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setLicenseFile(null)}
                            className="p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg text-xs font-bold transition cursor-pointer"
                            title={isRtl ? 'إلغاء الملف' : 'Remove File'}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-slate-300 hover:border-teal-500 bg-slate-50 hover:bg-teal-50/20 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition text-center group">
                        <Upload className="w-6 h-6 text-slate-400 group-hover:text-teal-600 transition" />
                        <div>
                          <span className="text-xs font-bold text-slate-700 group-hover:text-teal-800 block">
                            {isUploadingLicense ? (isRtl ? 'جاري تجهيز وقراءة الملف...' : 'Processing file...') : (isRtl ? 'انقر لاختيار ملف أو صورة الترخيص' : 'Click to select license file or photo')}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {isRtl ? 'يدعم ملفات PDF، PNG، JPG حتى 20 ميجابايت' : 'Supports PDF, PNG, JPG up to 20MB'}
                          </span>
                        </div>
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          disabled={isUploadingLicense}
                          onChange={handleLicenseFileUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingLicenseCategory(null)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveLicense(editingLicenseCategory)}
                    className="px-5 py-2 bg-slate-900 hover:bg-teal-900 active:scale-95 text-white font-extrabold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <Check className="w-4 h-4 text-safety-emerald" />
                    <span>{isRtl ? 'حفظ وتوثيق الرخصة' : 'Save & Commit License'}</span>
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      )}

      {activeSubTab === 'inquiries' && (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm space-y-6">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-sky-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                {isRtl ? 'سجل الملاحظات والطلبات ومتابعة الردود الإدارية والتقنية' : 'Communications Log & Administrative Feed'}
              </h3>
            </div>
          </div>

          {/* New Inline Inquiry/Request Submission form for Enhanced UX */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100/60 border border-slate-200/80 rounded-2xl p-5 space-y-3 shadow-xs">
            <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
              📝 {isRtl ? 'تسجيل طلب جديد أو ملاحظة فنية للإدارة' : 'Register a New Note or Safety Request'}
            </h4>
            <p className="text-[10.5px] text-slate-600 leading-relaxed">
              {isRtl 
                ? 'اكتب طلبك أو ملاحظتك الفنية هنا لإشعار المدير العام فوراً ومتابعة فريق الصيانة لتلبية احتياجات منشأتك. سيتم تنبيه المدير وإرسال إشعار الكتروني عاجل بالبريد الإلكتروني المعتمد فور الإرسال.' 
                : 'Write your request or technical observations here. The general manager will be alerted via the registered email directly upon submission for immediate follow-up.'}
            </p>
            {canSubmitInquiries ? (
              <form onSubmit={handleInquirySubmit} className="space-y-3">
                <textarea
                  value={inquiryText}
                  onChange={(e) => setInquiryText(e.target.value)}
                  placeholder={isRtl ? 'اكتب بالتفصيل مثلاً: طلب طفايات حريق إضافية، شكوى بشأن تأخر الفني، بلاغ عطل فني في أجهزة الإنذار، طلب تحديث صور الفحص الدورية...' : 'Detail your request or note here...'}
                  rows={3}
                  required
                  className="w-full text-xs p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-800 leading-relaxed resize-none shadow-sm"
                />
                <div className="flex justify-end items-center gap-3">
                  <span className="text-[10px] text-teal-600 font-bold flex items-center gap-1">
                    📧 {isRtl ? 'تنبيه المدير بالبريد نشط' : 'Manager Email Alert Active'}
                  </span>
                  <button
                    type="submit"
                    className="bg-safety-emerald hover:bg-teal-900 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm border border-teal-500"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isRtl ? 'إرسال الطلب وتنبيه المدير' : 'Submit & Alert Manager'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-[10px] text-slate-500 font-semibold text-center leading-relaxed">
                🔒 {isRtl 
                  ? 'تم تعطيل صلاحية إرسال الشكاوى والملاحظات الفورية لحسابك الفرعي من قبل مسؤول المنشأة.' 
                  : 'Complaint sending is disabled for your sub-user account.'}
              </div>
            )}
          </div>

          <div className="space-y-4 pt-2">
            <h4 className="font-bold text-slate-700 text-xs flex items-center gap-1.5 border-b border-slate-100 pb-2">
              📋 {isRtl ? 'قائمة الملاحظات والطلبات المسجلة سابقاً وحالة المعالجة لدينا' : 'History of Registered Notes & Logged Inquiries'}
            </h4>
            {client.inquiries && client.inquiries.length > 0 ? (
              [...client.inquiries].reverse().map(inq => (
                <div key={inq.id} className="p-4 rounded-2xl border border-slate-150 space-y-3 bg-slate-50/50">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-2 flex-grow">
                      <span className="text-sm mt-0.5">💬</span>
                      <div className="flex-grow">
                        {editingInquiryId === inq.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingInquiryText}
                              onChange={(e) => setEditingInquiryText(e.target.value)}
                              className="w-full p-2 text-xs bg-white border border-slate-300 rounded-xl focus:border-safety-emerald focus:outline-none font-semibold text-slate-800"
                              rows={2}
                            />
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleSaveEdit(inq.id)}
                                className="px-2.5 py-1 text-[10px] bg-safety-emerald text-white rounded-lg font-bold hover:bg-teal-900 transition cursor-pointer"
                              >
                                {isRtl ? 'حفظ' : 'Save'}
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="px-2.5 py-1 text-[10px] bg-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-300 transition cursor-pointer"
                              >
                                {isRtl ? 'إلغاء' : 'Cancel'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs font-bold text-slate-800 leading-relaxed">{dt(inq.text)}</p>
                            <span className="text-[9px] text-slate-400 font-mono mt-0.5 block">{inq.createdAt}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {editingInquiryId !== inq.id && (
                        <div className="flex items-center gap-1">
                          {confirmDeleteId === inq.id ? (
                            <div className="flex items-center gap-1 bg-rose-50 border border-rose-100 p-1.5 rounded-xl">
                              <span className="text-[9px] text-rose-700 font-bold px-1">{isRtl ? 'تأكيد الحذف؟' : 'Confirm?'}</span>
                              <button
                                onClick={() => handleDeleteClick(inq.id)}
                                className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[9px] font-bold hover:bg-rose-700 transition cursor-pointer"
                              >
                                {isRtl ? 'نعم' : 'Yes'}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[9px] font-bold hover:bg-slate-300 transition cursor-pointer"
                              >
                                {isRtl ? 'لا' : 'No'}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              {!inq.replyText && (
                                <button
                                  onClick={() => handleStartEdit(inq.id, inq.text)}
                                  className="p-1 hover:bg-slate-200 text-slate-550 hover:text-slate-800 rounded-lg transition shrink-0 cursor-pointer"
                                  title={isRtl ? 'تعديل' : 'Edit'}
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => setConfirmDeleteId(inq.id)}
                                className="p-1 hover:bg-rose-50 text-slate-550 hover:text-rose-650 rounded-lg transition shrink-0 cursor-pointer"
                                title={isRtl ? 'حذف' : 'Delete'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {inq.replyText ? (
                        <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1 shrink-0">
                          <span>{isRtl ? 'تم الرد ومعالجة الطلب' : 'Replied'}</span>
                        </span>
                      ) : (
                        !confirmDeleteId && (
                          <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-100 flex items-center gap-1 shrink-0">
                            <span>{isRtl ? 'قيد المراجعة الفنية' : 'Under Review'}</span>
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  {inq.replyText && (
                    <div className="p-3 bg-sky-50 border border-sky-105 border-slate-200 rounded-xl space-y-2 flex flex-col">
                      <div className="flex gap-2">
                        <span className="text-xs shrink-0 mt-0.5">🛡️</span>
                        <div className="flex-grow">
                          <span className="text-[10px] font-bold text-sky-900 block">{isRtl ? 'إفادة المشرف العام Nesma:' : 'Nesma First Administrator Response:'}</span>
                          <p className="text-[11px] text-sky-950 leading-relaxed font-semibold">{dt(inq.replyText)}</p>
                          <span className="text-[9px] text-sky-750 font-mono mt-0.5 block">{inq.repliedAt}</span>
                        </div>
                      </div>
                      
                      {/* Interactive Client Deletion Action */}
                      <div className="flex justify-end pt-1.5 border-t border-sky-100/60">
                        {confirmDeleteReplyId === inq.id ? (
                          <div className="flex items-center gap-1.5 bg-white border border-rose-200 p-1 px-2 rounded-lg text-[9px]">
                            <span className="text-rose-700 font-bold">{isRtl ? 'حذف وتصفير الرد؟' : 'Delete Response?'}</span>
                            <button
                              onClick={() => {
                                handleDeleteClick(inq.id);
                                setConfirmDeleteReplyId(null);
                              }}
                              className="px-2 py-0.5 bg-rose-600 text-white rounded font-bold hover:bg-rose-700 transition cursor-pointer"
                            >
                              {isRtl ? 'نعم، احذف الرد والطلب' : 'Yes, Delete'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteReplyId(null)}
                              className="px-2 py-0.5 bg-slate-200 text-slate-705 rounded font-bold hover:bg-slate-300 transition cursor-pointer"
                            >
                              {isRtl ? 'تراجع' : 'Cancel'}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteReplyId(inq.id)}
                            className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-600 hover:text-rose-800 transition py-0.5 px-2 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-100 cursor-pointer"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                            <span>{isRtl ? 'حذف هذا الرد من القائمة' : 'Delete reply from history'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl space-y-2">
                <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold">{isRtl ? 'لم تقم بتسجيل أي ملاحظات أو طلبات صيانة بعد.' : 'No inquiries logged yet.'}</p>
                <p className="text-[10px] text-slate-500">{isRtl ? 'اكتب أول طلب أو ملاحظة لك في المربع بالأعلى لتنبيه المدير والتفاعل الفوري.' : 'Submit your first comment using the module above to reach administrators.'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dynamic Custom Pages Tab Content */}
      {customization?.customPages?.map(page => activeSubTab === `page_${page.id}` && (
        <div key={page.id} className="p-6 bg-white border border-slate-200 rounded-3xl shadow-sm space-y-4 animate-fade-in text-start font-sans">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 flex items-center justify-center text-2xl shrink-0 border border-teal-500/20">
              {page.icon || '📜'}
            </span>
            <div>
              <h3 className="font-extrabold text-lg text-slate-900">{page.title}</h3>
              <p className="text-xs text-slate-500">
                {isRtl ? 'تعليمات وإرشادات هامة معتمدة من قبل إدارة المنشأة' : 'Official instructions & guidelines approved by Management'}
              </p>
            </div>
          </div>
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
            {page.content}
          </div>
        </div>
      ))}

      {activeSubTab === 'branches' && hasIndependentBranchContracts && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏢</span>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {isRtl ? 'فروع الشركة والعقود المستقلة' : 'Company Branches & Independent Contracts'}
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {isRtl ? 'قائمة بجميع فروع الشركة التي تمتلك عقود صيانة مستقلة وتواريخ سريان مخصصة.' : 'List of all corporate branches holding independent maintenance contracts and specific terms.'}
                  </p>
                </div>
              </div>
              <span className="text-xs bg-teal-50 text-teal-850 font-extrabold px-3 py-1 rounded-full border border-teal-100 shrink-0">
                {isRtl ? `${branchesList.length} فرع معتمد` : `${branchesList.length} Certified Branches`}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-sans">
                    <th className="py-2.5 text-start font-bold pb-3">{isRtl ? 'الفرع' : 'Branch'}</th>
                    <th className="py-2.5 text-start font-bold pb-3">{isRtl ? 'المدينة' : 'City'}</th>
                    <th className="py-2.5 text-start font-bold pb-3">{isRtl ? 'رقم العحد' : 'Contract Ref'}</th>
                    <th className="py-2.5 text-start font-bold pb-3">{isRtl ? 'تاريخ بداية العقد' : 'Start Date'}</th>
                    <th className="py-2.5 text-start font-bold pb-3">{isRtl ? 'تاريخ نهاية العقد' : 'End Date'}</th>
                    <th className="py-2.5 text-end font-bold pb-3">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {branchesList.map(br => {
                    const brStart = br.contractStartDate || client.contractStartDate || '---';
                    const brEnd = br.contractEndDate || client.contractEndDate || '---';
                    const isBrExpired = brEnd !== '---' && brEnd < new Date().toISOString().split('T')[0];
                    return (
                      <tr key={br.id || br.name} className="hover:bg-slate-50/40 transition">
                        <td className="py-4 font-bold text-slate-800 flex items-center gap-2">
                          <span className="text-sm shrink-0">🏢</span>
                          <div>
                            <span className="block">{dt(br.name)}</span>
                            {br.managerPhone && (
                              <span className="text-[9px] text-slate-400 block font-mono font-normal mt-0.5">📞 {br.managerPhone}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 text-slate-600 font-medium">
                          {dt(br.city)}
                        </td>
                        <td className="py-4 font-mono font-bold text-slate-700">
                          {br.contractNumber || client.contractNumber || '---'}
                        </td>
                        <td className="py-4 font-mono text-slate-600">
                          {formatDateDMY(brStart)}
                        </td>
                        <td className="py-4 font-mono">
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            isBrExpired ? 'bg-rose-100 text-rose-855' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {formatDateDMY(brEnd)}
                          </span>
                        </td>
                        <td className="py-4 text-end">
                          <button
                            onClick={() => setSelectedBranchForModal(br)}
                            className="px-3 py-1.5 bg-safety-emerald hover:bg-emerald-500 text-slate-950 rounded-xl text-[11px] font-black transition flex items-center gap-1.5 cursor-pointer inline-flex shadow-xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{isRtl ? 'عرض التفاصيل والزيارات' : 'View Details & Visits'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 🏢 Branch Details & Contract Modal */}
      {selectedBranchForModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in text-start">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-200" dir={isRtl ? 'rtl' : 'ltr'}>
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏢</span>
                <div>
                  <h3 className="font-bold text-base">
                    {dt(selectedBranchForModal.name)}
                  </h3>
                  <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
                    <span>📍 {dt(selectedBranchForModal.city)}</span>
                    {selectedBranchForModal.locationText && (
                      <>
                        <span className="text-slate-500">•</span>
                        <span className="truncate max-w-[250px]">{dt(selectedBranchForModal.locationText)}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedBranchForModal(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto bg-slate-50 flex-1 space-y-6">
              
              {/* Grid: Contract details & Contact details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* 📄 Contract Information Card */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 text-slate-800">
                    <span className="text-base">📄</span>
                    <h4 className="font-bold text-xs">{isRtl ? 'بيانات عقد صيانة الفرع المستقل' : 'Branch Contract Terms'}</h4>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">{isRtl ? 'رقم العقد' : 'Contract Ref'}</span>
                      <span className="font-mono font-bold text-slate-800">{selectedBranchForModal.contractNumber || client.contractNumber || '---'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">{isRtl ? 'صلاحية ومدة العقد' : 'Contract Duration'}</span>
                      <span className="font-bold text-slate-800">{formatContractDuration(selectedBranchForModal.contractDurationYears || '1', isRtl)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">{isRtl ? 'تاريخ بداية العقد' : 'Contract Start'}</span>
                      <span className="font-mono font-bold text-slate-800">{formatDateDMY(selectedBranchForModal.contractStartDate || client.contractStartDate)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">{isRtl ? 'تاريخ نهاية العقد' : 'Contract End'}</span>
                      <span className="font-mono font-bold text-slate-800">{formatDateDMY(selectedBranchForModal.contractEndDate || client.contractEndDate)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">{isRtl ? 'تكرار الزيارات السنوية' : 'Annual Visit Frequency'}</span>
                      <span className="font-bold text-slate-800">
                        {selectedBranchForModal.visitFrequency || client.visitFrequency} {isRtl ? 'زيارات/سنة' : 'visits/yr'}
                      </span>
                    </div>
                  </div>

                  {/* Attached Contract File */}
                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">{isRtl ? 'ملف مستند العقد:' : 'Contract Document File:'}</span>
                    {selectedBranchForModal.contractFile ? (
                      <button
                        onClick={() => {
                          setSelectedBranchForModal(null);
                          setViewingFile({
                            name: selectedBranchForModal.contractFile?.name || (isRtl ? 'وثيقة عقد فرع ' + selectedBranchForModal.name : 'Branch Contract: ' + selectedBranchForModal.name),
                            url: selectedBranchForModal.contractFile?.url || '#simulated',
                            clientName: `${client.name} - ${selectedBranchForModal.name}`,
                            contractNumber: selectedBranchForModal.contractNumber || client.contractNumber,
                            type: 'contract'
                          });
                        }}
                        className="text-[10px] bg-sky-50 text-sky-700 border border-sky-150 px-2.5 py-1.5 rounded-lg font-black flex items-center gap-1 hover:bg-sky-100 transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isRtl ? 'عرض مستند العقد المرفق' : 'View Attachment'}</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">
                        {isRtl ? 'لا يوجد ملف منفصل (يتبع العقد الرئيسي)' : 'No separate file (follows master)'}
                      </span>
                    )}
                  </div>
                </div>

                {/* 📞 Contact & Safety Details Card */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 text-slate-800">
                    <span className="text-base">📞</span>
                    <h4 className="font-bold text-xs">{isRtl ? 'معلومات التواصل وتاريخ الصلاحية للفرع' : 'Contact & Safety Details'}</h4>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">{isRtl ? 'رقم جوال مدير الفرع' : 'Branch Manager Phone'}</span>
                      <span className="font-mono font-bold text-slate-800">{selectedBranchForModal.managerPhone || '---'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">{isRtl ? 'صلاحية طفايات الحريق' : 'Extinguisher Expiry'}</span>
                      {selectedBranchForModal.fireExtinguisherExpiry ? (
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] inline-block mt-0.5 ${
                          getFireExtinguisherStatus(selectedBranchForModal.fireExtinguisherExpiry) === 'expired' 
                            ? 'bg-rose-100 text-rose-800' 
                            : getFireExtinguisherStatus(selectedBranchForModal.fireExtinguisherExpiry) === 'expiring'
                              ? 'bg-amber-100 text-amber-800 animate-pulse'
                              : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {formatDateDMY(selectedBranchForModal.fireExtinguisherExpiry)}
                        </span>
                      ) : (
                        <span className="text-slate-500">---</span>
                      )}
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] text-slate-400 block">{isRtl ? 'الفني الفاحص المعين للفرع' : 'Assigned Inspecting Tech'}</span>
                      {(() => {
                        const tech = technicians.find(t => t.id === selectedBranchForModal.assignedTechnicianId);
                        return tech ? (
                          <div className="mt-1 flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-205">
                            <div>
                              <span className="font-bold text-slate-800 block text-[11px]">👤 {dt(tech.name)}</span>
                              <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">📞 {tech.phone}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic block mt-1">{isRtl ? 'غير محدد بعد (يتبع الفني الفاحص الرئيسي)' : 'Follows master technician'}</span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

              </div>

              {/* 📅 Visit Log & Reports List for this specific branch */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📅</span>
                    <h4 className="font-bold text-slate-900 text-xs">
                      {isRtl ? 'سجل زيارات الصيانة الدورية والطارئة للفرع' : 'Branch Maintenance & Emergency Visits History'}
                    </h4>
                  </div>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                    {(() => {
                      const bVisits = clientVisits.filter(v => v.branchName === selectedBranchForModal.name);
                      return isRtl ? `${bVisits.length} زيارات` : `${bVisits.length} Total Visits`;
                    })()}
                  </span>
                </div>

                {(() => {
                  const bVisits = clientVisits.filter(v => v.branchName === selectedBranchForModal.name);
                  if (bVisits.length === 0) {
                    return (
                      <div className="py-8 text-center text-slate-400 border border-dashed border-slate-100 rounded-xl space-y-1.5">
                        <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-[11px] font-semibold">{isRtl ? 'لا يوجد زيارات صيانة مسجلة لهذا الفرع بعد.' : 'No visits logged for this branch yet.'}</p>
                      </div>
                    );
                  }

                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-start">
                        <thead>
                          <tr className="border-b border-slate-50 text-slate-400 font-sans">
                            <th className="py-2 text-start font-bold">{isRtl ? 'تاريخ الزيارة' : 'Date'}</th>
                            <th className="py-2 text-start font-bold">{isRtl ? 'النوع' : 'Type'}</th>
                            <th className="py-2 text-start font-bold">{isRtl ? 'الفني' : 'Technician'}</th>
                            <th className="py-2 text-start font-bold">{isRtl ? 'الحالة' : 'Status'}</th>
                            <th className="py-2 text-start font-bold">{isRtl ? 'النتيجة' : 'Result'}</th>
                            <th className="py-2 text-end font-bold">{isRtl ? 'التقرير' : 'Report'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {bVisits.map(visit => {
                            const isEmergency = visit.isEmergency;
                            return (
                              <tr key={visit.id} className="hover:bg-slate-50/50 transition">
                                <td className="py-3 font-mono font-bold text-slate-800">
                                  {formatDateDMY(visit.scheduledDate)}
                                </td>
                                <td className="py-3">
                                  {isEmergency ? (
                                    <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded border border-rose-100 font-bold text-[9px]">
                                      🚨 {isRtl ? 'طارئة' : 'Emergency'}
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded border border-sky-100 font-bold text-[9px]">
                                      📅 {isRtl ? 'دورية' : 'Routine'}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 text-slate-600 font-medium">
                                  {visit.technicianName}
                                </td>
                                <td className="py-3">
                                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                    visit.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {visit.status === 'completed' ? (isRtl ? 'مكتملة' : 'Completed') : (isRtl ? 'مجدولة' : 'Pending')}
                                  </span>
                                </td>
                                <td className="py-3">
                                  {visit.status === 'completed' ? (
                                    <span className={`px-1.5 py-0.5 rounded font-semibold text-[10px] ${
                                      visit.result === 'passed' 
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                        : visit.result === 'has_defects'
                                          ? 'bg-amber-50 text-amber-700 border border-amber-150'
                                          : 'bg-rose-50 text-rose-700 border border-rose-150'
                                    }`}>
                                      {visit.result === 'passed' 
                                        ? (isRtl ? 'مطابق وسليم' : 'Passed') 
                                        : visit.result === 'has_defects'
                                          ? (isRtl ? 'ملاحظات طفيفة' : 'Minor defects')
                                          : (isRtl ? 'أعطال حرجة' : 'Critical issues')
                                      }
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">---</span>
                                  )}
                                </td>
                                <td className="py-3 text-end">
                                  <button
                                    onClick={() => {
                                      setSelectedBranchForModal(null);
                                      onSelectVisit(visit);
                                    }}
                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer inline-flex border border-slate-200"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>{isRtl ? 'عرض التقرير' : 'عرض'}</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setSelectedBranchForModal(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {isRtl ? 'إغلاق' : 'Close'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Bottom section for support inquiry and civil defense certificate (Only visible on the main Dashboard tab) */}
      {activeSubTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
          
          {/* Quick action: Submit support Inquiry */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <MessageSquare className="w-4 h-4 text-safety-emerald" />
                <h4 className="font-bold text-slate-900 text-[11px]">
                  {isRtl ? 'مراسلة عاجلة لإدارة الصيانة فقط' : 'Direct Service Desk Inquiry'}
                </h4>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed mt-2 font-medium">
                {isRtl 
                  ? 'هل لديك أي استفسار ؟ اكتب ملاحظتك هنا فوراً وسيرد فريق إدارة الصيانة عليك' 
                  : 'Do you have any inquiries? Write your notes here immediately and the maintenance management team will respond to you.'}
              </p>
            </div>
            
            <div className="mt-2.5">
              {canSubmitInquiries ? (
                <form onSubmit={handleInquirySubmit} className="space-y-2">
                  <textarea
                    value={inquiryText}
                    onChange={(e) => setInquiryText(e.target.value)}
                    placeholder={isRtl ? 'اكتب ملاحظتك، شكواك، أو استفسارك هنا...' : 'Type your comment or inquiries here...'}
                    rows={2}
                    required
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-800 leading-relaxed resize-none"
                  />
                  <button
                    type="submit"
                    className="w-full bg-safety-emerald hover:bg-teal-905 text-white font-bold py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                    <span>{isRtl ? 'إرسال الملاحظة الآن' : 'Send inquiry'}</span>
                  </button>
                </form>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[10px] text-slate-500 font-semibold text-center leading-relaxed font-sans">
                  🔒 {isRtl 
                    ? 'تم تعطيل صلاحية إرسال الشكاوى والملاحظات الفورية لحسابك الفرعي من قبل مسؤول المنشأة.' 
                    : 'Complaint sending is disabled for your sub-user account by your primary coordinator.'}
                </div>
              )}
            </div>
          </div>

          {/* Inspection Schedule Card (Replacing Civil Defense window) */}
          {(() => {
            const targetVisits = (selectedBranchId !== 'all' && displayedVisits.length > 0) ? displayedVisits : (clientVisits.length > 0 ? clientVisits : visits);
            
            const lastCompletedDate = (() => {
              const comp = targetVisits.filter(v => v.status === 'completed');
              if (comp.length === 0) return null;
              const sorted = [...comp].sort((a, b) => {
                const dA = a.completedDate || a.scheduledDate || '';
                const dB = b.completedDate || b.scheduledDate || '';
                return dB.localeCompare(dA);
              });
              return sorted[0]?.completedDate || sorted[0]?.scheduledDate || null;
            })();

            const upcomingDate = (() => {
              const pend = targetVisits.filter(v => v.status === 'pending');
              if (pend.length === 0) return null;
              const sorted = [...pend].sort((a, b) => {
                const dA = a.scheduledDate || '';
                const dB = b.scheduledDate || '';
                return dA.localeCompare(dB);
              });
              return sorted[0]?.scheduledDate || null;
            })();

            return (
              <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-teal-700" />
                      <h4 className="font-bold text-slate-900 text-[11px]">
                        {isRtl ? 'مواعيد كشوفات الصيانة الدورية' : 'Maintenance Inspection Schedule'}
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                      {isRtl ? 'الكشوفات الفنية' : 'Inspections'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed mt-2 font-medium">
                    {isRtl 
                      ? 'متابعة وتوثيق مواعيد زيارات الفحص والصيانة الدورية لشبكات ومعدات السلامة بالمنشأة.' 
                      : 'Track and review scheduled preventive maintenance inspection visits for your facility.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {/* تاريخ الكشف الأخير */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 text-slate-600 text-[10.5px] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">{isRtl ? 'تاريخ الكشف الأخير:' : 'Last Inspection Date:'}</span>
                    </div>
                    <div className="font-mono font-black text-xs text-slate-900 bg-white px-2 py-1.5 rounded-lg border border-slate-200 text-center shadow-xs">
                      {lastCompletedDate ? formatDateDMY(lastCompletedDate) : (isRtl ? 'لا يوجد كشف سابق' : 'N/A')}
                    </div>
                  </div>

                  {/* موعد الكشف القادم */}
                  <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-200/70 flex flex-col justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 text-teal-900 text-[10.5px] font-bold">
                      <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <span className="truncate">{isRtl ? 'موعد الكشف القادم:' : 'Upcoming Schedule:'}</span>
                    </div>
                    <div className="font-mono font-black text-xs text-teal-900 bg-white px-2 py-1.5 rounded-lg border border-teal-200/70 text-center shadow-xs">
                      {upcomingDate ? formatDateDMY(upcomingDate) : (isRtl ? 'غير محدد حالياً' : 'To be scheduled')}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

        </div>
      )}
      </div>

      {/* 🚨 Client Request Emergency Visit Modal 🚨 */}
      {isNewEmergencyModalOpenClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-fade-in text-start">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" dir={isRtl ? 'rtl' : 'ltr'}>
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-red-600 to-slate-900 text-white">
              <div className="flex items-center gap-2">
                <span className="text-xl animate-pulse">🚨</span>
                <h3 className="font-extrabold text-sm sm:text-base">{isRtl ? 'طلب زيارة فحص طارئة للمعدات' : 'Request Emergency Inspection'}</h3>
              </div>
              <button 
                onClick={() => setIsNewEmergencyModalOpenClient(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              
              <div className="p-4 bg-red-50 text-red-900 border border-red-100 rounded-2xl flex items-start gap-2.5 text-xs">
                <span className="text-lg">📢</span>
                <p className="leading-relaxed">
                  {isRtl 
                    ? 'يرجى تقديم بلاغات الطوارئ في حال وجود عطل يعيق عمل تجهيزات السلامة. سيتم إخطار المشرف العام فوراً لتوجيه أقرب فني لموقعكم.' 
                    : 'Please use this request only for critical safety system failures. The general manager will immediately assign the closest available specialist to your site.'}
                </p>
              </div>

              {/* Select Branch iff client has branches */}
              {client.branches && client.branches.length > 0 ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 block">
                    {isRtl ? 'حدد الفرع أو الموقع المستهدف *' : 'Target Branch or Facility Location *'}
                  </label>
                  <select
                    value={clientEmergencyBranchOption}
                    onChange={(e) => setClientEmergencyBranchOption(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-600 text-slate-800 font-bold cursor-pointer"
                  >
                    {client.branches.map((b, idx) => {
                      const bName = typeof b === 'string' ? b : b.name;
                      return (
                        <option key={idx} value={bName}>{bName}</option>
                      )
                    })}
                  </select>
                </div>
              ) : (
                <div className="space-y-1 bg-slate-50 p-3.5 border border-slate-100 rounded-2xl">
                  <span className="text-[10px] text-slate-400 font-bold block">{isRtl ? 'موقع التدخل:' : 'Facility Base Location:'}</span>
                  <span className="text-xs font-black text-slate-800">🏢 {client.locationText || (isRtl ? 'المقر الرئيسي' : 'Main Headquarters')}</span>
                </div>
              )}

              {/* Enter Emergency Reason */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 block">
                  {isRtl ? 'تفاصيل عطل السلامة المبلغ عنه *' : 'Safety Problem Details / Failure Cause *'}
                </label>
                <textarea
                  placeholder={isRtl ? 'يرجى إدخال وصف المشكلة بدقة (مثل: عطل في لوحة إنذار الحريق، تسريب في شبكة الرشاشات...)' : 'Please type precise safety problem details (e.g., fire alarm panel buzzer, fire pump failure...)'}
                  value={clientEmergencyReasonInput}
                  onChange={(e) => setClientEmergencyReasonInput(e.target.value)}
                  className="w-full p-3.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 text-slate-800 font-semibold min-h-[100px] leading-relaxed"
                />
              </div>

              {/* حالة البلاغ / Ticket Severity */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 block">
                  {isRtl ? 'حالة البلاغ *' : 'Ticket Severity / State *'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setClientEmergencySeverity('has_defects')}
                    className={`p-2.5 rounded-xl text-xs font-bold border transition duration-150 flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      clientEmergencySeverity === 'has_defects'
                        ? 'bg-amber-50 border-amber-500 text-amber-900 ring-1 ring-amber-250'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <span>🟡</span>
                    <span>{isRtl ? 'ملاحظات طفيفة' : 'Minor defects'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setClientEmergencySeverity('critical_issues')}
                    className={`p-2.5 rounded-xl text-xs font-bold border transition duration-155 flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      clientEmergencySeverity === 'critical_issues'
                        ? 'bg-red-50 border-red-500 text-red-900 ring-1 ring-red-250'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <span>🔴</span>
                    <span>{isRtl ? 'خطورة عالية' : 'Critical Issues'}</span>
                  </button>
                </div>
              </div>

              {/* Image upload / camera capture for Emergency visits */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-black text-slate-700 block">
                  {isRtl ? 'صورة توضيحية للعطل (اختياري)' : 'Incident Photo (Optional)'}
                </label>
                
                {clientEmergencyImage ? (
                  <div className="relative rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 p-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img 
                        src={clientEmergencyImage.url} 
                        alt="Emergency incident" 
                        className="w-12 h-12 object-cover rounded-lg border border-slate-100"
                        referrerPolicy="no-referrer"
                      />
                      <div className="text-start">
                        <p className="text-xs font-bold text-slate-800 truncate max-w-[180px]" title={clientEmergencyImage.name}>
                          {clientEmergencyImage.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {isRtl ? 'صورة مرفوعة' : 'Uploaded image'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setClientEmergencyImage(null)}
                      className="p-1 px-2.5 bg-red-50 hover:bg-red-100 text-red-650 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isRtl ? 'حذف' : 'Remove'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-red-400 rounded-2xl py-4 bg-slate-50 hover:bg-slate-100/50 cursor-pointer transition text-center group">
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          if (file.size > 10 * 1024 * 1024) {
                            alert(isRtl 
                              ? `تنبيه: حجم الملف المرفوع (${(file.size / (1024 * 1024)).toFixed(2)} ميجابايت) يتجاوز الحد الأقصى المسموح به (10 ميجابايت).\nيرجى ضغط الملف أو تقليل دقة الصور/الفيديو وإعادة المحاولة لتستقر بيانات الرفع ولا تحذف.` 
                              : `Warning: The uploaded file size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed limit of 10 MB.\nPlease compress or reduce the file size and try again to ensure permanent stability of your uploads.`
                            );
                            return;
                          }

                          setClientEmergencyUploadProgress(true);
                          (async () => {
                            try {
                              const base64Content = await compressImageIfNeeded(file);
                              if (!base64Content) {
                                setClientEmergencyUploadProgress(false);
                                return;
                              }
                              const response = await fetch('/api/upload', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                  name: file.name,
                                  type: file.type,
                                  base64: base64Content
                                })
                              });
                              const uploadRes = await response.json();
                              if (uploadRes.success) {
                                setClientEmergencyImage({
                                  id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                                  name: file.name,
                                  type: 'image',
                                  url: uploadRes.url,
                                  uploadedAt: new Date().toISOString()
                                });
                              } else {
                                setClientEmergencyImage({
                                  id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                                  name: file.name,
                                  type: 'image',
                                  url: URL.createObjectURL(file), 
                                  uploadedAt: new Date().toISOString()
                                });
                              }
                            } catch (err) {
                              console.warn('[SAS Upload Fallback] Client upload error, using local Object URL preview:', err);
                              setClientEmergencyImage({
                                id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                                  name: file.name,
                                  type: 'image',
                                  url: URL.createObjectURL(file), 
                                  uploadedAt: new Date().toISOString()
                                });
                            } finally {
                              setClientEmergencyUploadProgress(false);
                            }
                          })();
                        }}
                      />
                      {clientEmergencyUploadProgress ? (
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="w-5 h-5 border-2 border-red-650 border-t-transparent animate-spin rounded-full"></div>
                          <span className="text-[10px] text-slate-500 font-bold">{isRtl ? 'جاري الرفع والتدقيق...' : 'Uploading incident media...'}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <Camera className="w-6 h-6 text-slate-400 group-hover:text-red-500 transition-colors" />
                          <span className="text-xs font-bold text-slate-700 group-hover:text-slate-950 mt-1">
                            {isRtl ? 'التقاط صورة أو اختيار ملف' : 'Capture Photo or Choose File'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {isRtl ? 'يدعم الكاميرا مباشرة ومعرض الصور' : 'Supports mobile camera & image uploads'}
                          </span>
                        </div>
                      )}
                    </label>
                  </div>
                )}
              </div>

            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsNewEmergencyModalOpenClient(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!clientEmergencyReasonInput.trim()) {
                    alert(isRtl ? 'الرجاء إدخال تفاصيل عطل السلامة المبلغ عنه لتسهيل الفحص!' : 'Please fill out safety incident details first!');
                    return;
                  }

                  const newEmergencyVisit: Visit = {
                    id: `emergency_${Date.now()}`,
                    clientId: client.id,
                    clientName: client.name,
                    contractNumber: client.contractNumber,
                    companyBranchId: client.companyBranchId || 'hq',
                    branchName: clientEmergencyBranchOption || (isRtl ? 'المقر الرئيسي' : 'Main Headquarters'),
                    technicianId: '',
                    technicianName: isRtl ? 'بانتظار تعيين المدير للفني' : 'Awaiting dispatch by manager',
                    scheduledDate: new Date().toISOString().split('T')[0],
                    status: 'pending',
                    result: 'not_visited',
                    isEmergency: true,
                    emergencyReason: clientEmergencyReasonInput,
                    emergencySeverity: clientEmergencySeverity,
                    attachments: clientEmergencyImage ? [clientEmergencyImage] : []
                  };

                  onAddEmergencyVisit?.(newEmergencyVisit);
                  setClientEmergencyImage(null);
                  setClientEmergencySeverity('has_defects');
                  setIsNewEmergencyModalOpenClient(false);

                  alert(isRtl ? 'تم رفع طلب الزيارة الطارئة للمشرف بنجاح! سيتم توجيه فني فوراً.' : 'Emergency visit requested! The administrator will assign a field specialist immediately.');
                }}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 font-extrabold text-white text-xs rounded-xl shadow-md transition flex items-center gap-1 cursor-pointer"
              >
                <span>🚀</span>
                <span>{isRtl ? 'إرسال طلب الطوارئ' : 'Send Emergency Request'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- Customer Interactive Invoice Sheet and Approval flow modal --- */}
      {showViewQuoteModal && viewingQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in text-start">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh] print:fixed print:inset-0 print:m-0 print:rounded-none print:shadow-none print:h-screen print:w-screen print:z-50" dir={isRtl ? 'rtl' : 'ltr'}>
            
            {/* Header controls (Hidden during print) */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-900 text-white print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-safety-emerald" />
                <h3 className="font-bold text-base">
                  {isRtl ? 'كشف تفاصيل عرض الأسعار المالي' : 'Quotation Financial Statement'}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setViewingQuotation(null);
                  setShowViewQuoteModal(false);
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Print Area core sheet */}
            <div className="p-8 overflow-y-auto flex-1 bg-white select-text print:p-12 text-xs" id="client-printable-quotation">
              
              {/* Official Brand Header */}
              <div className="flex flex-row justify-between items-center border-b-2 border-slate-905 pb-4 mb-6">
                <div className="flex items-center gap-3">
                  <img src="/logo_nesma.png?v=2" className="w-20 h-10 object-contain shrink-0" alt="Nesma Logo" referrerPolicy="no-referrer" />
                  <div>
                    <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                      {isRtl ? 'شركة نسما الاولى لأنظمة السلامة' : 'Nesma First Safety Systems'}
                    </h1>
                    <p className="text-[9px] text-slate-500 mt-0.5 hidden md:block">
                      {isRtl 
                        ? 'شركة معتمدة لتركيب وصيانة شبكات إنذار ومكافحة الحريق ومعدات السلامة بترخيص الدفاع المدني لمختلف المنشآت.' 
                        : 'Certified company for the installation and inspection of safety networks, fire alarm and protection hardware approved by Civil Defense.'}
                    </p>
                  </div>
                </div>
                <div className="text-end mt-4 sm:mt-0 font-mono">
                  <div className="text-xs font-black text-slate-950 uppercase border border-slate-900 px-3 py-1 bg-slate-50 inline-block rounded mb-2">
                    {isRtl ? 'عرض سعر رقم' : 'QUOTE REF'}: #{viewingQuotation.id.split('_')[1] || viewingQuotation.id}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    <span className="font-bold">{isRtl ? 'تاريخ التحرير' : 'Date'}:</span> {viewingQuotation.date}
                  </div>
                </div>
              </div>

              {/* Client metadata box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-5 rounded-2xl border border-slate-100 mb-6 text-xs">
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-sans">{isRtl ? 'مرسل إلى العميل' : 'BILL TO CLIENT'}</h4>
                  <p className="text-sm font-black text-slate-900">{viewingQuotation.clientName}</p>
                  <p className="text-slate-500 mt-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{isRtl ? 'الفرع/الموقع المخصّص' : 'Target Branch/Location'}: <strong className="text-slate-800">{viewingQuotation.branchName}</strong></span>
                  </p>
                </div>
                <div className="md:text-end text-xs flex flex-col justify-between items-start md:items-end">
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 font-sans">{isRtl ? 'حالة الاعتماد والرد الحالي' : 'QUOTATION STATUS'}</h4>
                    {viewingQuotation.status === 'approved' ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-850 rounded-full font-black text-[11px] font-sans">
                        ✓ {isRtl ? 'العرض مقبول ومعتمد من قبلك' : 'APPROVED & ACCEPTED'}
                      </span>
                    ) : viewingQuotation.status === 'rejected' ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-850 rounded-full font-black text-[11px] font-sans">
                        ✕ {isRtl ? 'تم رفض العرض من قبلك' : 'REJECTED BY CLIENT'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-805 rounded-full font-black text-[11px] font-sans animate-pulse">
                        ● {isRtl ? 'بانتظار قرار وسداد العميل' : 'PENDING YOUR REVIEW'}
                      </span>
                    )}
                  </div>
                  {viewingQuotation.repliedAt && (
                    <p className="text-[9px] text-slate-400 mt-1 font-mono">
                      {isRtl ? 'تاريخ الرد:' : 'Replied At:'} {new Date(viewingQuotation.repliedAt).toLocaleString(isRtl ? 'ar-EG' : 'en-US')}
                    </p>
                  )}
                </div>
              </div>

              {/* Table of items */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden mb-6">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="bg-slate-900 text-white font-bold text-center">
                      <th className="py-2.5 px-3 text-start">{isRtl ? 'البيان ومواصفات قطعة الغيار المطلوبة' : 'Description / Repair Item'}</th>
                      <th className="py-2.5 px-3" style={{ width: '130px' }}>{isRtl ? 'سعر الوحدة' : 'Unit Price'}</th>
                      <th className="py-2.5 px-3" style={{ width: '80px' }}>{isRtl ? 'الكمية' : 'Qty'}</th>
                      <th className="py-2.5 px-3 text-end" style={{ width: '150px' }}>{isRtl ? 'السعر الإجمالي' : 'Total Price'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {viewingQuotation.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-800 block">{item.description}</span>
                          {item.warranty && (
                            <span className="text-[9px] text-safety-emerald font-semibold block mt-0.5">{isRtl ? 'ضمان:' : 'Warranty:'} {item.warranty}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-sans font-medium text-slate-700">
                          {item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} {isRtl ? 'ر.س' : 'SAR'}
                        </td>
                        <td className="py-3 px-3 text-center font-sans font-black text-slate-800">{item.quantity}</td>
                        <td className="py-3 px-3 text-end font-sans font-bold text-slate-900">
                          {item.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} {isRtl ? 'ر.س' : 'SAR'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary Bottom block with VAT */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 text-xs mb-8">
                <div className="max-w-sm">
                  <h4 className="font-bold text-slate-900 mb-1">{isRtl ? 'الشروط والأحكام الخاصة بالعرض:' : 'Quotation Terms & Conditions:'}</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-500 text-[10px] leading-relaxed">
                    {viewingQuotation.terms ? (
                      viewingQuotation.terms.split('\n').map((line, idx) => {
                        const cleanLine = line.trim();
                        if (!cleanLine) return null;
                        return <li key={idx}>{cleanLine}</li>;
                      })
                    ) : (
                      <>
                        <li>{isRtl ? 'يسري هذا العرض لمدة خمسة عشر (15) يوماً من تاريخ التحرير.' : 'This pricing sheet is valid for 15 days from issue date.'}</li>
                        <li>{isRtl ? 'الأسعار المدرجة أعلاه خاضعة لضريبة القيمة المضافة الإلزامية بنسبة 15%.' : 'All listed prices are subject to mandatory 15% VAT.'}</li>
                        <li>{isRtl ? 'ساعات وأجور العمل مشمولة في الأسعار إلا إذا ذكر خلاف ذلك.' : 'Labor cost and installation efforts are included unless specified.'}</li>
                      </>
                    )}
                  </ul>
                </div>
                
                <div className="w-full sm:w-83 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-2 font-mono">
                  <div className="flex justify-between items-center text-slate-500 text-xs">
                    <span className="font-bold">{isRtl ? 'المجموع الفرعي' : 'Subtotal'}:</span>
                    <span className="font-bold text-slate-800">{viewingQuotation.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {isRtl ? 'ريال' : 'SAR'}</span>
                  </div>

                  {(viewingQuotation.discountAmount || 0) > 0 && (
                    <>
                      <div className="flex justify-between items-center text-rose-600 text-xs">
                        <span className="font-bold">
                          {isRtl ? 'خصم خاص للعميل' : 'Client Discount'}
                          {viewingQuotation.discountType === 'percentage' ? ` (${viewingQuotation.discountValue}%)` : ''}:
                        </span>
                        <span className="font-bold">-{(viewingQuotation.discountAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {isRtl ? 'ريال' : 'SAR'}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-700 text-xs border-t border-slate-200/60 pt-1">
                        <span className="font-bold">{isRtl ? 'الإجمالي الخاضع للضريبة' : 'Taxable Subtotal'}:</span>
                        <span className="font-bold text-slate-900">{(viewingQuotation.taxableSubtotal ?? (viewingQuotation.subtotal - (viewingQuotation.discountAmount || 0))).toLocaleString(undefined, { minimumFractionDigits: 2 })} {isRtl ? 'ريال' : 'SAR'}</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between items-center text-slate-500 text-xs">
                    <span className="font-bold">{isRtl ? 'ضريبة القيمة المضافة (15%)' : 'VAT (15%)'}:</span>
                    <span className="font-bold text-slate-800">{viewingQuotation.vat.toLocaleString(undefined, { minimumFractionDigits: 2 })} {isRtl ? 'ريال' : 'SAR'}</span>
                  </div>
                  <div className="h-px bg-slate-200"></div>
                  <div className="flex justify-between items-center text-sm font-black text-slate-900">
                    <span>{isRtl ? 'الإجمالي النهائي شامل الضريبة' : 'Grand Total (with VAT)'}:</span>
                    <span className="text-safety-emerald text-base font-bold font-sans">{viewingQuotation.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {isRtl ? 'ريال' : 'SAR'}</span>
                  </div>

                  {viewingQuotation.status === 'approved' && (() => {
                    const vPaid = viewingQuotation.paidAmount || (viewingQuotation.paymentHistory ? viewingQuotation.paymentHistory.reduce((s, p) => s + p.amount, 0) : 0);
                    const vSurplus = vPaid > viewingQuotation.grandTotal ? parseFloat((vPaid - viewingQuotation.grandTotal).toFixed(2)) : 0;
                    const vRemaining = vPaid >= viewingQuotation.grandTotal ? 0 : parseFloat((viewingQuotation.grandTotal - vPaid).toFixed(2));

                    if (vPaid <= 0) return null;

                    return (
                      <div className="border-t border-slate-200/80 pt-2.5 mt-1 space-y-1.5 font-mono">
                        <div className="flex justify-between items-center text-xs text-emerald-800 font-bold">
                          <span>{isRtl ? 'المبلغ المسدد من العميل' : 'Total Paid Amount'}:</span>
                          <span className="font-bold text-emerald-900">{vPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })} {isRtl ? 'ريال' : 'SAR'}</span>
                        </div>

                        {vSurplus > 0 ? (
                          <div className="flex justify-between items-center p-2 bg-emerald-100 rounded-xl border border-emerald-300 text-emerald-900 text-xs font-black">
                            <span className="flex items-center gap-1 font-sans">
                              <span>💡</span>
                              <span>{isRtl ? 'رصيد زائد للعميل (فارق السداد):' : 'Credit Surplus:'}</span>
                            </span>
                            <span className="font-bold text-emerald-900">+{vSurplus.toLocaleString(undefined, { minimumFractionDigits: 2 })} {isRtl ? 'ريال' : 'SAR'}</span>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center text-xs text-slate-600 font-bold">
                            <span>{isRtl ? 'المتبقي للسداد' : 'Remaining'}:</span>
                            <span>{vRemaining.toLocaleString(undefined, { minimumFractionDigits: 2 })} {isRtl ? 'ريال' : 'SAR'}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Action signature / input for Client interactive review */}
              {viewingQuotation.status === 'pending' && (
                <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-200/60 print:hidden space-y-4">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <HelpCircle className="w-4 h-4 text-safety-emerald" />
                    <span>{isRtl ? 'اتخاذ القرار وإبداء الموافقة أو الرفض الإلكتروني' : 'State Your Sign-Off Decision & Comment'}</span>
                  </h4>
                  
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">
                      {isRtl ? 'الملاحظات والتعليقات الإضافية (اختياري / مثلاً تحديد مواعيد التوريد)' : 'Add additional inquiries, directions or instructions (Optional)'}
                    </label>
                    <textarea
                      rows={2}
                      placeholder={isRtl ? "اكتب تعليقك هنا..." : "Type your optional directions..."}
                      value={clientReplyNote}
                      onChange={(e) => setClientReplyNote(e.target.value)}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:border-safety-emerald text-xs font-semibold focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        onReplyQuotation(viewingQuotation.id, 'rejected', clientReplyNote);
                        setViewingQuotation(null);
                        setShowViewQuoteModal(false);
                      }}
                      className="px-5 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <ThumbsDown className="w-4 h-4" />
                      <span>{isRtl ? 'رفض عرض السعر مع التعليق' : 'Reject With Comments'}</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        onReplyQuotation(viewingQuotation.id, 'approved', clientReplyNote);
                        setViewingQuotation(null);
                        setShowViewQuoteModal(false);
                      }}
                      className="px-5 py-2.5 bg-safety-emerald text-slate-950 font-black rounded-xl text-xs transition shadow flex items-center gap-1.5 cursor-pointer"
                    >
                      <ThumbsUp className="w-4 h-4" />
                      <span>{isRtl ? 'الموافقة واعتماد عرض السعر لجدولته' : 'Accept & Sign Electronically'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Official Seal sign space */}
              <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-6 mt-8 font-sans text-xs">
                <div>
                  <span className="text-slate-400 font-bold block mb-1">{isRtl ? 'توقيع واعتماد العميل المستفيد' : 'Customer Acceptance Signature'}</span>
                  <div className="h-16 border border-slate-100 rounded-xl bg-slate-50/50 flex items-center justify-center text-slate-400 italic text-[11px]">
                    {viewingQuotation.status === 'approved' ? (
                      <span className="text-emerald-750 font-black not-italic font-sans">✓ تم التوقيع الإلكتروني المعتمد</span>
                    ) : viewingQuotation.status === 'rejected' ? (
                      <span className="text-rose-600 font-black not-italic font-sans">✕ تم رفض العرض من العميل</span>
                    ) : (
                      <span>{isRtl ? 'بانتظار رد وتوقيع المفوض...' : 'Awaiting digital signing...'}</span>
                    )}
                  </div>
                </div>
                <div className="text-end flex flex-col items-end">
                  <span className="text-slate-400 font-bold block mb-1">{isRtl ? 'الختم والتوقيع الرسمي لشركة نسما الاولى لأنظمة السلامة' : 'Official Nesma First Safety Systems Seal & Authority'}</span>
                  <div className="h-28 flex items-center justify-end" dangerouslySetInnerHTML={{ __html: COMPANY_STAMP_SVG.replace('width="235"', 'width="180"').replace('height="90"', 'height="69"') }} />
                </div>
              </div>

            </div>

            {/* Footer buttons (Hidden during print too) */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between print:hidden">
              <button
                type="button"
                onClick={() => {
                  setViewingQuotation(null);
                  setShowViewQuoteModal(false);
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-350 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                {isRtl ? 'إغلاق' : 'Close'}
              </button>

              <div className="flex items-center gap-2">
                {viewingQuotation.paymentReceipt ? (
                  <button
                    type="button"
                    onClick={() => setViewingPaymentReceiptModal(viewingQuotation.paymentReceipt!)}
                    className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition shadow flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>📄</span>
                    <span>{isRtl ? 'معاينة إشعار السداد المرفق' : 'View Payment Receipt'}</span>
                  </button>
                ) : (
                  <label className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-teal-850 border border-teal-200/80 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs">
                    <span>📎</span>
                    <span>{isRtl ? 'إرفاق إشعار السداد' : 'Attach Payment Receipt'}</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => handleUploadPaymentReceipt(e, viewingQuotation)}
                    />
                  </label>
                )}

                <button
                  type="button"
                  onClick={() => handlePrintQuotation(viewingQuotation)}
                  className="px-5 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-black rounded-xl text-xs transition shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-safety-emerald" />
                  <span>{isRtl ? 'طباعة / تصدير PDF' : 'Print / Export to PDF'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Payment Receipt Lightbox Viewer Modal */}
      {viewingPaymentReceiptModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in text-start" onClick={() => setViewingPaymentReceiptModal(null)}>
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 relative max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center text-lg">
                  💳
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">{isRtl ? 'إشعار السداد المرفق' : 'Attached Payment Receipt'}</h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{viewingPaymentReceiptModal.name} • {viewingPaymentReceiptModal.uploadedAt}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingPaymentReceiptModal(null)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center p-3 bg-slate-50 rounded-2xl border border-slate-200/80 min-h-[320px]">
              {viewingPaymentReceiptModal.fileType === 'application/pdf' || viewingPaymentReceiptModal.name.toLowerCase().endsWith('.pdf') || viewingPaymentReceiptModal.url.startsWith('data:application/pdf') ? (
                <iframe
                  src={viewingPaymentReceiptModal.url}
                  title={viewingPaymentReceiptModal.name}
                  className="w-full h-[550px] rounded-xl border-0 shadow-xs"
                />
              ) : (
                <img
                  src={viewingPaymentReceiptModal.url}
                  alt={viewingPaymentReceiptModal.name}
                  className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-md"
                />
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <a
                href={viewingPaymentReceiptModal.url}
                download={viewingPaymentReceiptModal.name}
                className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs"
              >
                <span>⬇️</span>
                <span>{isRtl ? 'تحميل إشعار السداد' : 'Download Receipt'}</span>
              </a>
              <button
                type="button"
                onClick={() => setViewingPaymentReceiptModal(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {isRtl ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Document / Contract Viewer Modal */}
      {viewingFile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in text-start">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-200" dir={isRtl ? 'rtl' : 'ltr'}>
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <span className="text-xl font-sans">📄</span>
                <div>
                  <h3 className="font-bold text-sm">
                    {isRtl ? 'عارض المستندات والعقود الرقمي' : 'Digital Document & Contract Viewer'}
                  </h3>
                  <p className="text-[10px] text-slate-300 truncate max-w-[340px]" title={viewingFile.name}>
                    {viewingFile.name}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setViewingFile(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Viewer Content */}
            <div className="p-6 overflow-y-auto bg-slate-50 flex-1 flex flex-col items-center justify-center min-h-[350px]">
              {/* If it is a simulated contract (e.g. static/temp fallbacks or not exist on server storage) */}
              {(viewingFile.url.startsWith('#simulated') || viewingFile.url.startsWith('#') || viewingFile.url.includes('fallback') || !viewingFile.url) ? (
                <div className="w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8 flex flex-col justify-between relative overflow-hidden text-slate-800 font-sans max-w-xl mx-auto" id="contract-print-area">
                  {/* Header Row */}
                  <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3 mb-3" style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '12px', marginBottom: '12px' }}>
                    <div className="flex items-center gap-3" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
                      <img src="/logo_nesma.png?v=2" alt="Nesma First Logo" style={{ height: '50px', width: 'auto', objectFit: 'contain', display: 'block' }} referrerPolicy="no-referrer" />
                      <div style={{ display: 'flex', flexDirection: 'column', textAlign: isRtl ? 'right' : 'left', justifyContent: 'center' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: '900', color: '#0f172a', margin: '0', padding: '0', lineHeight: '1.2' }}>
                          {isRtl ? 'شركة نسما الأولى لأنظمة السلامة' : 'Nesma First Safety Systems Co.'}
                        </h4>
                        <p style={{ fontSize: '10px', color: '#64748b', margin: '4px 0 0 0', padding: '0', fontFamily: 'monospace' }}>
                          {isRtl ? 'الرقم الموحد: 7003489890' : 'Unified Registration ID: 7003489890'}
                        </p>
                      </div>
                    </div>
                    {/* Left/Opposite side is left empty on purpose as requested to remove the Certified text */}
                    <div></div>
                  </div>

                  {/* Middle Document Title (وسط الصفحة : وثيقة صيانة) */}
                  <div style={{ display: 'flex', justifyContent: 'center', width: '100%', margin: '15px 0', textAlign: 'center' }}>
                    <h2 style={{ fontSize: '14px', fontWeight: '900', color: '#0f172a', borderTop: '3px double #cbd5e1', borderBottom: '3px double #cbd5e1', padding: '4px 24px', backgroundColor: '#f8fafc', margin: '0', display: 'inline-block' }}>
                      {isRtl ? 'وثيقة صيانة' : 'Maintenance Document'}
                    </h2>
                  </div>

                  {/* Parties Details (الطرف الأول والطرف الثاني) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', margin: '15px 0' }}>
                    {/* First Party (الطرف الأول) */}
                    <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: isRtl ? 'right' : 'left' }}>
                      <h3 style={{ fontWeight: '900', color: '#0f172a', fontSize: '11px', marginBottom: '8px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }} dir={isRtl ? 'rtl' : 'ltr'}>
                        <span style={{ color: '#10b981' }}>👤</span>
                        <span>{isRtl ? 'الطرف الأول:' : 'First Party:'}</span>
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10px', color: '#334155', lineHeight: '1.4' }} dir={isRtl ? 'rtl' : 'ltr'}>
                        <div><strong>{isRtl ? 'الاسم:' : 'Name:'}</strong> {isRtl ? 'شركة نسما الأولى لأنظمة السلامة' : 'Nesma First Safety Systems Co.'}</div>
                        <div><strong>{isRtl ? 'الرقم الموحد:' : 'Unified ID:'}</strong> <span className="font-mono">7003489890</span></div>
                        <div><strong>{isRtl ? 'النشاط:' : 'Activity:'}</strong> {isRtl ? 'أنظمة مكافحة الحريق والإنذار وصيانة معدات السلامة المعتمدة' : 'Certified Fire Fighting, Alarm Systems & Safety Maintenance'}</div>
                        <div><strong>{isRtl ? 'العنوان:' : 'Address:'}</strong> {isRtl ? 'المملكة العربية السعودية' : 'Kingdom of Saudi Arabia'}</div>
                      </div>
                    </div>

                    {/* Second Party (الطرف الثاني) */}
                    <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: isRtl ? 'right' : 'left' }}>
                      <h3 style={{ fontWeight: '900', color: '#0f172a', fontSize: '11px', marginBottom: '8px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }} dir={isRtl ? 'rtl' : 'ltr'}>
                        <span style={{ color: '#0ea5e9' }}>🏢</span>
                        <span>{isRtl ? 'الطرف الثاني (العميل):' : 'Second Party (Client):'}</span>
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10px', color: '#334155', lineHeight: '1.4' }} dir={isRtl ? 'rtl' : 'ltr'}>
                        <div><strong>{isRtl ? 'اسم المنشأة:' : 'Facility Name:'}</strong> {viewingFile.clientName || client?.name || (isRtl ? 'عميل سلامة معتمد' : 'Authorized Safety Client')}</div>
                        {client ? (
                          <>
                            <div><strong>{isRtl ? 'البريد الإلكتروني:' : 'Email:'}</strong> <span className="font-mono">{client.email || '---'}</span></div>
                            <div><strong>{isRtl ? 'رقم الهاتف/الجوال:' : 'Phone:'}</strong> <span className="font-mono">{client.phone || '---'}</span></div>
                            <div><strong>{isRtl ? 'العنوان والحي:' : 'Address:'}</strong> {client.locationText || '---'}</div>
                          </>
                        ) : (
                          <>
                            <div><strong>{isRtl ? 'طبيعة الخدمة:' : 'Service Coverage:'}</strong> {isRtl ? 'صيانة دورية واكتشاف أعطال فنية بموجب العقد' : 'Periodic safety inspection and diagnostics'}</div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Body Details / Text after both parties */}
                  <div style={{ padding: '12px 16px', backgroundColor: 'rgba(204, 251, 241, 0.2)', border: '1px solid #99f6e4', borderRadius: '10px', fontSize: '13px', margin: '12px 0', lineHeight: '1.6', textAlign: 'justify' }}>
                    <p style={{ margin: '0' }}>
                      {isRtl 
                        ? 'بموجب هذه الوثيقة المعتمدة، تلتزم شركة "نسما الأولى لأنظمة السلامة " بتقديم وتأمين كافة الفحوصات الفنية لسلامة معدات وأنظمة مكافحة الحريق بصفة دورية ومنتظمة لمواقع وفروع الطرف الثاني المحددة ، وتخضع للبنود والشروط المذكورة في العقد.'
                        : 'Pursuant to this certified document, Nesma First Safety Systems Co. takes covenant to provide and secure all technical inspections for the safety and firefighting equipment periodically and regularly for the specified sites and branches of the Second Party, and is subject to the terms and conditions mentioned in the contract.'}
                    </p>
                  </div>

                  {/* Stamp & Approvals - aligned left as requested with name on top and stamp below */}
                  <div style={{ display: 'flex', justifyContent: 'flex-start', borderTop: '1px solid #e2e8f0', marginTop: '20px', paddingTop: '15px' }}>
                    <div style={{ marginRight: 'auto', marginLeft: '0', textAlign: 'center', width: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <p style={{ fontSize: '11px', fontWeight: '900', color: '#0f172a', margin: '0 0 6px 0', whiteSpace: 'nowrap' }}>
                        {isRtl ? 'شركة نسما الأولى لأنظمة السلامة' : 'Nesma First Safety Systems Co.'}
                      </p>
                      <div 
                        style={{ width: '120px', height: 'auto', opacity: '0.95', margin: '0 auto' }} 
                        dangerouslySetInnerHTML={{ __html: COMPANY_STAMP_SVG.replace('width="235"', 'width="120"').replace('height="90"', 'height="46"') }} 
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Real PDF, Image, or Video asset */
                <div className="w-full flex-1 flex flex-col items-center justify-center">
                  {isImageUrl(viewingFile.url) || viewingFile.url.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) || viewingFile.url.startsWith('data:image/') ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-md bg-white max-w-full">
                      <img 
                        src={viewingFile.url} 
                        alt={viewingFile.name} 
                        className="max-w-full max-h-[55vh] object-contain cursor-zoom-in" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : isVideoUrl(viewingFile.url) || viewingFile.type === 'video' ? (
                    <div className="w-full max-w-3xl border border-slate-800 rounded-2xl overflow-hidden shadow-2xl bg-black flex items-center justify-center p-2">
                      <video 
                        src={formatVideoUrl(viewingFile.url)} 
                        controls 
                        autoPlay 
                        className="w-full max-h-[60vh] object-contain rounded-xl"
                      />
                    </div>
                  ) : (
                    /* Embedded Frame with Fallback Box */
                    <div className="w-full h-[450px] relative bg-slate-100/50 rounded-xl border border-slate-200 flex flex-col justify-between overflow-hidden shadow-inner font-sans">
                      <iframe 
                        src={`${viewingFile.url}#toolbar=1&navpanes=1`}
                        title={viewingFile.name}
                        className="w-full h-full border-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex flex-wrap gap-2.5 justify-between items-center text-xs">
              <span className="text-[10px] text-slate-500 font-medium font-sans">
                {isRtl ? 'ملاحظة: لفتح الملف في علامة تبويب كاملة، استخدم الزر المقابل.' : 'Tip: Use buttons to access or display in native viewport.'}
              </span>
              
              <div className="flex items-center gap-2 font-sans">
                <button
                  type="button"
                  onClick={() => {
                    const printContents = document.getElementById('contract-print-area');
                    if (printContents) {
                      const printWindow = window.open('', '_blank');
                      if (printWindow) {
                        printWindow.document.write(`
                          <html>
                            <head>
                              <title> </title>
                              <style>
                                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
                                * { font-family: 'Cairo', 'القاهرة', sans-serif; box-sizing: border-box; }
                                body { font-family: 'Cairo', 'القاهرة', sans-serif; padding: 20px; background: white; color: #1e293b; direction: ${isRtl ? 'rtl' : 'ltr'}; }
                                .border-dashed { border-style: dashed !important; }
                                .bg-slate-50 { background-color: #f8fafc !important; }
                                .text-slate-400 { color: #94a3b8 !important; }
                                .bg-teal-50\\/20 { background-color: rgba(204, 251, 241, 0.2) !important; }
                                
                                /* Prevent giant images */
                                img { max-height: 50px !important; width: auto !important; object-fit: contain !important; display: block !important; }
                                
                                /* Ensure standard grids work */
                                .grid { display: grid !important; }
                                .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
                                @media (min-width: 600px) {
                                  .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
                                }
                                .gap-3 { gap: 12px !important; }
                                
                                /* Flex utility fallbacks */
                                .flex { display: flex !important; }
                                .justify-between { justify-content: space-between !important; }
                                .items-center { align-items: center !important; }
                                
                                /* Avoid printing shadows, borders, or backgrounds that break pages */
                                #contract-print-area {
                                  border: none !important;
                                  box-shadow: none !important;
                                  padding: 0 !important;
                                  margin: 0 !important;
                                  width: 100% !important;
                                  max-width: 100% !important;
                                  background: transparent !important;
                                }
                                
                                @media print {
                                  body { padding: 1.5cm !important; margin: 0 !important; }
                                  @page { size: A4 portrait; margin: 0 !important; }
                                }
                              </style>
                              <link href="https://cdn.jsdelivr.net/npm/tailwindcss@4/dist/tailwind.min.css" rel="stylesheet">
                            </head>
                            <body onload="setTimeout(function(){ window.print(); window.close(); }, 500);">
                              <div style="max-width: 780px; margin: 0 auto; width: 100%;">
                                ${printContents.innerHTML}
                              </div>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                      }
                    } else {
                      window.open(viewingFile.url, '_blank');
                    }
                  }}
                  className="px-3.5 py-2 bg-slate-800 text-white hover:bg-slate-900 rounded-xl font-bold cursor-pointer transition flex items-center gap-1.5 shadow"
                >
                  <span>🖨️ {isRtl ? 'طباعة العقد المعتمد' : 'Print Certified Doc'}</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (viewingFile.url.startsWith('#')) {
                      alert(isRtl ? 'لقد قمنا بإنشاء نسخة طبق الأصل تفصيلية للعقد المعتمد، يمكنك طباعتها فوراً.' : 'We have generated a fully detailed verified contract replica on screen, click print to save.');
                      return;
                    }
                    try {
                      // Determine correct file extension to prevent corrupt/unknown file downloads
                      let ext = '';
                      const urlLower = viewingFile.url.toLowerCase();
                      if (urlLower.startsWith('data:video/mp4') || urlLower.endsWith('.mp4')) ext = '.mp4';
                      else if (urlLower.startsWith('data:video/webm') || urlLower.endsWith('.webm')) ext = '.webm';
                      else if (urlLower.startsWith('data:video/quicktime') || urlLower.endsWith('.mov')) ext = '.mov';
                      else if (urlLower.startsWith('data:video/')) ext = '.mp4';
                      else if (urlLower.startsWith('data:image/png') || urlLower.endsWith('.png')) ext = '.png';
                      else if (urlLower.startsWith('data:image/jpeg') || urlLower.startsWith('data:image/jpg') || urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg')) ext = '.jpg';
                      else if (urlLower.startsWith('data:image/')) ext = '.jpg';
                      else if (urlLower.startsWith('data:application/pdf') || urlLower.endsWith('.pdf')) ext = '.pdf';

                      let fileName = viewingFile.name || 'document';
                      if (ext && !fileName.toLowerCase().endsWith(ext)) {
                        fileName += ext;
                      }

                      const response = await fetch(viewingFile.url);
                      if (!response.ok) throw new Error('Download failed');
                      const blob = await response.blob();
                      const blobUrl = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = blobUrl;
                      link.download = fileName;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(blobUrl);
                    } catch (err) {
                      console.error("Download error", err);
                      window.open(viewingFile.url, '_blank');
                    }
                  }}
                  className="px-3.5 py-2 bg-emerald-600 text-white hover:bg-emerald-750 rounded-xl font-bold cursor-pointer transition flex items-center gap-1.5 shadow"
                >
                  <span>📥 {isRtl ? 'تحميل الملف لجهازك' : 'Download File'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (viewingFile.url.startsWith('#')) {
                      alert(isRtl ? 'لقد قمنا بإنشاء نسخة طبق الأصل تفصيلية للعقد المعتمد، يمكنك طباعتها فوراً.' : 'We have generated a fully detailed verified contract replica on screen, click print to save.');
                    } else {
                      window.open(viewingFile.url, '_blank');
                    }
                  }}
                  className="px-3.5 py-2 bg-teal-600 text-white hover:bg-teal-700 rounded-xl font-bold cursor-pointer transition flex items-center gap-1.5 shadow"
                >
                  <span>🔗 {isRtl ? 'فتح في علامة تبويب جديدة' : 'Open in New Tab'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.origin + viewingFile.url);
                    alert(isRtl ? 'تم نسخ رابط الملف إلى الحافظة لفتحه في أي متصفح بنجاح!' : 'File location URL copied to clipboard!');
                  }}
                  className="px-3 py-2 bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer transition"
                >
                  <span>📋 {isRtl ? 'نسخ الرابط' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Image Preview Overlay Modal */}
      {localPreviewUrl && (
        <div 
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fade-in"
          onClick={() => setLocalPreviewUrl(null)}
        >
          <div 
            className="relative bg-white dark:bg-slate-900 rounded-3xl p-3 shadow-2xl max-w-4xl max-h-[90vh] flex flex-col items-center overflow-hidden border border-slate-700/30 text-center animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center w-full pb-2 px-2 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-150 truncate max-w-[80%] pr-2">
                {localPreviewName}
              </h4>
              <button 
                onClick={() => setLocalPreviewUrl(null)}
                className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-2 bg-slate-50 dark:bg-slate-950 rounded-2xl mt-2 w-full max-h-[75vh]">
              <img 
                src={localPreviewUrl} 
                alt={localPreviewName} 
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="pt-2 text-[10px] text-slate-400 font-medium">
              {isRtl ? 'انقر في أي مكان خارج النافذة للإغلاق' : 'Click anywhere outside to close'}
            </div>
          </div>
        </div>
      )}

      {/* DETAILED RECEIPT / CERTIFICATE LIGHTBOX MODAL FOR CLIENT */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-fade-in text-start">
          <div className="bg-white rounded-3xl max-w-2xl w-full mx-auto shadow-2xl overflow-hidden border border-slate-200" dir={isRtl ? 'rtl' : 'ltr'}>
            
            {/* Modal Header actions */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <h3 className="font-bold text-sm">{isRtl ? 'معاينة سند الاستلام والتسليم الرسمي' : 'Handover Receipt Document review'}</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[11px] font-bold text-amber-400 transition cursor-pointer flex items-center gap-1 select-none"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {isRtl ? 'طباعة مستند' : 'Print/PDF'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReceipt(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-850 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Main printable certificate template */}
            <div id="client-receipt-print-area" className="p-8 space-y-6 text-xs text-slate-800 text-start leading-relaxed bg-white relative">
              
              {/* Official Header */}
              <div className="border-b-2 border-slate-800 pb-4 flex justify-between items-center">
                <div className="space-y-1.5 text-start">
                  <span className="text-[10px] uppercase font-black tracking-widest text-red-650 block font-mono">NESMA FIRST COMPANY</span>
                  <h2 className="text-base font-extrabold text-slate-900">{isRtl ? 'شركة نسما الأولى لأنظمة السلامة - Nesma First Company' : 'Nesma First Company for Safety Systems'}</h2>
                  <p className="text-[10px] text-slate-500 font-medium">الرقم الموحد 7003489890 | فرع الرياض والدمام وجدة</p>
                </div>
                <div>
                  <img
                    src="/logo_nesma.png?v=2"
                    className="w-20 h-10 object-contain"
                    alt="Nesma Logo"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>

              {/* Receipt Details Block */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100 text-xs text-slate-500 font-medium font-sans">
                <div>
                  <span>{isRtl ? 'الرقم التسلسلي للسند:' : 'Receipt Number:'}</span>
                  <strong className="text-slate-900 block font-mono font-bold mt-0.5 text-sm text-indigo-600">
                    #REC_{selectedReceipt.receiptNumber || selectedReceipt.id.split('_')[1] || selectedReceipt.id}
                  </strong>
                </div>
                <div>
                  <span>{isRtl ? 'تاريخ السند:' : 'Receipt Date:'}</span>
                  <strong className="text-slate-900 block font-bold text-sm mt-0.5">
                    {selectedReceipt.date}
                  </strong>
                </div>
                <div>
                  <span>{isRtl ? 'العميل المستفيد:' : 'Client Venue:'}</span>
                  <strong className="text-slate-900 block font-black text-sm mt-0.5">
                    {selectedReceipt.clientName}
                  </strong>
                </div>
                <div>
                  <span>{isRtl ? 'موقع الفرع:' : 'Branch Site:'}</span>
                  <strong className="text-slate-900 block font-bold text-sm mt-0.5">
                    {selectedReceipt.branchName || (isRtl ? 'الفرع الرئيسي' : 'HQ Main Site')}
                  </strong>
                </div>
              </div>

              {/* Extinguisher Items Table */}
              <div className="space-y-3 font-sans">
                <h4 className="font-black text-slate-800 border-r-4 border-indigo-600 pr-2 text-xs">
                  {isRtl ? 'تفاصيل طفايات الحريق المستلمة والمفحوصة:' : 'Details of Received & Inspected Fire Extinguishers:'}
                </h4>

                <div className="overflow-hidden border border-slate-150 rounded-2xl">
                  <table className="w-full text-left rtl:text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-650 font-extrabold text-[10px] uppercase border-b border-slate-150">
                        <th className="p-3">{isRtl ? 'نوع طفاية الحريق' : 'Fire Extinguisher Type'}</th>
                        <th className="p-3 text-center w-24">{isRtl ? 'الكمية' : 'Quantity'}</th>
                        <th className="p-3 text-center w-36">{isRtl ? 'تاريخ الصلاحية الجديد' : 'New Expiry Date'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedReceipt.items && selectedReceipt.items.length > 0 ? (
                        selectedReceipt.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition text-xs font-medium">
                            <td className="p-3 text-slate-800 font-bold">{item.type}</td>
                            <td className="p-3 text-center font-mono font-bold text-slate-950">{item.quantity}</td>
                            <td className="p-3 text-center text-emerald-700 font-mono font-bold">{item.newExpiryDate}</td>
                          </tr>
                        ))
                      ) : (
                        <tr className="hover:bg-slate-50/50 transition text-xs font-medium">
                          <td className="p-3 text-slate-800 font-bold">{selectedReceipt.extinguisherType}</td>
                          <td className="p-3 text-center font-mono font-bold text-slate-950">{selectedReceipt.quantity}</td>
                          <td className="p-3 text-center text-emerald-700 font-mono font-bold">{selectedReceipt.newExpiryDate}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes & Technician Feedback */}
              <div className="space-y-4 pt-4 border-t border-slate-100 text-xs leading-relaxed text-slate-705 font-sans">
                {selectedReceipt.notes && (
                  <div className="space-y-1 text-start">
                    <span className="text-[10px] text-slate-400 font-bold block">{isRtl ? 'ملاحظات وتوصيات الفني وقائي:' : 'Inspector Notes & Remarks:'}</span>
                    <p className="bg-amber-50/30 p-3 border border-amber-100 rounded-xl text-slate-705 italic text-[11px] leading-relaxed">
                      {selectedReceipt.notes}
                    </p>
                  </div>
                )}

                {/* Technician name */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">{isRtl ? 'اسم الفني المختص:' : 'Inspector Specialist:'}</span>
                    <strong className="text-slate-805 font-extrabold text-xs block mt-0.5">{selectedReceipt.technicianName}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">{isRtl ? 'تاريخ الفحص والصيانة الفعلي:' : 'Actual Inspection Date:'}</span>
                    <strong className="text-slate-855 font-bold block font-mono mt-0.5">{selectedReceipt.inspectionDate || selectedReceipt.date}</strong>
                  </div>
                </div>

                {/* Signature Display */}
                {selectedReceipt.signatureUrl && (
                  <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 items-center">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">{isRtl ? 'المستلم المفوض وصاحب التوقيع:' : 'Authorized Recipient Signatory:'}</span>
                      <span className="font-black text-slate-950 block text-xs mt-1">{selectedReceipt.signatoryName || (isRtl ? 'ممثل العميل' : 'Client Rep')}</span>
                      <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">{selectedReceipt.signedAt || selectedReceipt.date}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] text-slate-400 block font-bold">{isRtl ? 'توقيع المستلم المعتمد:' : 'Signature Image:'}</span>
                      <div className="border border-slate-200 rounded-xl p-1.5 bg-white mt-1 shadow-sm max-w-[200px] mx-auto">
                        <img
                          src={selectedReceipt.signatureUrl}
                          alt="Signature"
                          className="w-full max-h-[60px] object-contain block mx-auto"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Stamp & Supervisor Approvals */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-start">
                    <span className="text-[10px] text-slate-400 block font-bold">{isRtl ? 'توقيع واعتماد المشرف الفني المسؤول:' : 'Technical Supervisor Approval:'}</span>
                    <span className="font-bold text-slate-705 block mt-1 underline underline-offset-2 decoration-dotted">
                      {client ? (
                        client.contractSupervisorId === 'admin'
                          ? (adminName || (isRtl ? 'المشرف العام' : 'General Admin'))
                          : (technicians.find((tech) => tech.id === client.contractSupervisorId)?.name || adminName || (isRtl ? 'المشرف العام' : 'General Admin'))
                      ) : (adminName || (isRtl ? 'المشرف العام' : 'General Admin'))}
                    </span>
                  </div>
                  <div className="flex flex-col items-center justify-center shrink-0">
                    <div 
                      className="w-24 overflow-hidden opacity-90 mx-auto" 
                      dangerouslySetInnerHTML={{ __html: COMPANY_STAMP_SVG.replace('width="235"', 'width="100"').replace('height="90"', 'height="38"') }} 
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer (Hidden during printing) */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex gap-3 print:hidden">
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="flex-1 py-2.5 text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-755 rounded-xl transition cursor-pointer"
              >
                {isRtl ? 'إغلاق النافذة' : 'Close'}
              </button>
              
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 text-xs font-extrabold bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{isRtl ? 'طباعة السند أو تحميله' : 'Print / Download Receipt'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 📋 Quotation Execution Report Modal for Client */}
      <ExecutionReportModal
        isOpen={!!viewingExecutionReportQuote}
        onClose={() => setViewingExecutionReportQuote(null)}
        quotation={viewingExecutionReportQuote}
        clients={[client]}
        technicians={technicians}
        adminName={adminName || ''}
        lang={lang}
      />

      {/* 🛠️ Detailed Work Order & Progress Modal */}
      {selectedWorkOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fade-in text-start">
          <div className="bg-white rounded-3xl max-w-2xl w-full mx-auto shadow-2xl overflow-hidden border border-slate-200 flex flex-col" dir={isRtl ? 'rtl' : 'ltr'}>
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold font-sans">
                  {isRtl ? 'تفاصيل أمر العمل ومتابعة الإنجاز' : 'Work Order Progress & Details'}
                </span>
                <h3 className="font-extrabold text-sm truncate max-w-[250px] sm:max-w-md font-sans">
                  #WO-{selectedWorkOrder.id.split('_')[1] || selectedWorkOrder.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWorkOrder(null)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              
              {/* Top Summary Info */}
              <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
                <div className="space-y-1">
                  <span className="text-slate-400 block font-bold">{isRtl ? 'المنشأة المستفيدة:' : 'Client Venue:'}</span>
                  <span className="text-slate-800 font-extrabold">{selectedWorkOrder.clientName}</span>
                </div>
                {selectedWorkOrder.branchName && (
                  <div className="space-y-1">
                    <span className="text-slate-400 block font-bold">{isRtl ? 'الفرع/الموقع:' : 'Branch Site:'}</span>
                    <span className="text-slate-800 font-extrabold">{selectedWorkOrder.branchName}</span>
                  </div>
                )}
                <div className="space-y-1">
                  <span className="text-slate-400 block font-bold">{isRtl ? 'تاريخ الاعتماد والمباشرة:' : 'Approval Date:'}</span>
                  <span className="text-slate-800 font-bold">{new Date(selectedWorkOrder.date).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 block font-bold">{isRtl ? 'حالة أمر العمل:' : 'Work Order Status:'}</span>
                  {selectedWorkOrder.executionReport ? (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold border border-emerald-250">
                      {isRtl ? 'منجز ومكتمل ✅' : 'Completed ✅'}
                    </span>
                  ) : selectedWorkOrder.assignedTechId ? (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold border border-amber-250 animate-pulse">
                      {isRtl ? 'قيد الانتظار والتنفيذ ⏳' : 'In Progress / Pending Execution ⏳'}
                    </span>
                  ) : (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-bold border border-slate-250">
                      {isRtl ? 'بانتظار توجيه فني 📋' : 'Pending Tech Assignment 📋'}
                    </span>
                  )}
                </div>
              </div>

              {/* Specialist/Technician Box */}
              <div className="p-4 border border-indigo-100 bg-indigo-50/20 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-2xl">👷‍♂️</span>
                  <div>
                    <p className="text-slate-500 font-bold">{isRtl ? 'فني الصيانة المسؤول:' : 'Assigned Specialist Technician:'}</p>
                    <p className="font-extrabold text-slate-850 text-sm mt-0.5 text-start">
                      {selectedWorkOrder.assignedTechName || (isRtl ? 'بانتظار التكليف والتعيين من الإدارة' : 'Awaiting assignment from administration')}
                    </p>
                  </div>
                </div>
                {selectedWorkOrder.assignedTechId && (
                  <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-full font-sans">
                    {isRtl ? 'فني معتمد' : 'Certified Specialist'}
                  </span>
                )}
              </div>

              {/* Items Progress & Specifications Checklist */}
              <div className="space-y-3 font-sans text-xs">
                <h4 className="font-black text-slate-850 border-r-4 border-safety-emerald pr-2">
                  {isRtl ? 'بنود الأعمال المطلوبة وحالة الإنجاز بالتفصيل:' : 'Scope of maintenance items & execution checklist:'}
                </h4>

                <div className="overflow-hidden border border-slate-200 rounded-2xl">
                  <table className="w-full text-left rtl:text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-extrabold border-b border-slate-200">
                        <th className="p-3">{isRtl ? 'البيان ومواصفات قطع الغيار / الصيانة' : 'Item Description & Specs'}</th>
                        <th className="p-3 text-center w-20">{isRtl ? 'الكمية' : 'Qty'}</th>
                        <th className="p-3 text-center w-36">{isRtl ? 'حالة الإنجاز الميداني' : 'Field Status'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedWorkOrder.items.map((item) => {
                        const isCompleted = !!selectedWorkOrder.executionReport;
                        const isItemDone = isCompleted && selectedWorkOrder.executionReport?.completedItems.includes(item.id);
                        
                        return (
                          <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                            <td className="p-3 font-medium text-slate-800 text-start">{item.description}</td>
                            <td className="p-3 text-center font-bold text-slate-900 font-sans">{item.quantity}</td>
                            <td className="p-3 text-center">
                              {isCompleted ? (
                                isItemDone ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <Check className="w-2.5 h-2.5" />
                                    {isRtl ? 'منجز ومطابق' : 'Done & Checked'}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-550/10 text-rose-700 border border-rose-200">
                                    <X className="w-2.5 h-2.5" />
                                    {isRtl ? 'لم ينجز' : 'Not completed'}
                                  </span>
                                )
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                                  <Clock className="w-2.5 h-2.5" />
                                  {isRtl ? 'قيد الانتظار' : 'Pending work'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Execution report details & sign-off if completed */}
              {selectedWorkOrder.executionReport ? (
                <div className="border border-emerald-150 bg-emerald-50/5 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-emerald-100/50 pb-2 text-start">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <h4 className="font-extrabold text-slate-800 text-xs">
                      {isRtl ? 'تقرير إنجاز الأعمال وإغلاق الأمر' : 'Execution Report & Completion Sign-off'}
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans text-start">
                    <div>
                      <span className="text-slate-400 block">{isRtl ? 'تاريخ إقفال الأمر:' : 'Date Closed:'}</span>
                      <strong className="text-slate-700">
                        {new Date(selectedWorkOrder.executionReport.completedAt).toLocaleString(isRtl ? 'ar-EG' : 'en-US')}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{isRtl ? 'الفني الذي أغلق الأمر:' : 'Closing Technician:'}</span>
                      <strong className="text-slate-700">{selectedWorkOrder.executionReport.technicianName}</strong>
                    </div>
                  </div>

                  {selectedWorkOrder.executionReport.notes && (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-700 text-start">
                      <span className="font-extrabold text-slate-500 block mb-1">{isRtl ? 'ملاحظات وتوصيات الفني والإدارة:' : 'Technician & Management Notes:'}</span>
                      <p className="leading-relaxed italic">"{selectedWorkOrder.executionReport.notes}"</p>
                    </div>
                  )}

                  {/* Field Photos if uploaded / added by Admin or Technician */}
                  {selectedWorkOrder.executionReport.mediaUrls && selectedWorkOrder.executionReport.mediaUrls.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <span className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-indigo-600" />
                        <span>{isRtl ? '📸 صور وفوتوغرافيات الإنجاز الفني:' : '📸 Field Photos & Proofs:'}</span>
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">
                          {selectedWorkOrder.executionReport.mediaUrls.length}
                        </span>
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {selectedWorkOrder.executionReport.mediaUrls.map((photoUrl, idx) => (
                          <div
                            key={idx}
                            onClick={() => setViewingFile({ name: `${isRtl ? 'صورة إنجاز' : 'Photo'} #${idx + 1}`, url: photoUrl })}
                            className="group relative aspect-4/3 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer hover:shadow-md transition"
                          >
                            <img src={photoUrl} alt="Execution photo" className="w-full h-full object-cover group-hover:scale-105 transition" referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1">
                              <Eye className="w-4 h-4" />
                              <span>{isRtl ? 'تكبير' : 'Enlarge'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Field Videos if uploaded / added by Admin or Technician */}
                  {selectedWorkOrder.executionReport.videoUrls && selectedWorkOrder.executionReport.videoUrls.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <span className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                        <Film className="w-4 h-4 text-purple-600" />
                        <span>{isRtl ? '📹 مقاطع الفيديو المرفقة بالإنجاز:' : '📹 Execution Videos:'}</span>
                        <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold">
                          {selectedWorkOrder.executionReport.videoUrls.length}
                        </span>
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {selectedWorkOrder.executionReport.videoUrls.map((vidUrl, idx) => {
                          const formattedVid = formatVideoUrl(vidUrl);
                          return (
                            <div key={idx} className="border border-slate-800 bg-slate-950 rounded-2xl overflow-hidden shadow-md flex flex-col">
                              <video src={formattedVid} controls className="w-full max-h-48 object-contain bg-black" />
                              <div className="p-2 bg-slate-900 flex items-center justify-between border-t border-slate-800">
                                <span className="text-[10px] text-purple-300 font-bold flex items-center gap-1">
                                  <Film className="w-3.5 h-3.5 text-purple-400" />
                                  <span>{isRtl ? `فيديو إنجاز #${idx + 1}` : `Video #${idx + 1}`}</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setViewingFile({ name: `${isRtl ? 'فيديو إنجاز' : 'Video'} #${idx + 1}`, url: formattedVid, type: 'video' })}
                                  className="text-[10px] bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>{isRtl ? 'مشاهدة شاشة كاملة' : 'Full Screen'}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Paper Report Document if attached by Admin */}
                  {selectedWorkOrder.executionReport.paperReportUrl && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <span className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-amber-600" />
                        <span>{isRtl ? '📄 التقرير الورقي المرفق والشهادة المعتمدة:' : '📄 Attached Paper Report / PDF:'}</span>
                      </span>
                      <div className="border border-amber-200 bg-amber-50/70 p-3 rounded-2xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="w-5 h-5 text-amber-700 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-extrabold text-slate-900 text-xs truncate">
                              {selectedWorkOrder.executionReport.paperReportName || (isRtl ? 'تقرير_ورقي_معتمد.pdf' : 'Paper_Report_Certified.pdf')}
                            </p>
                            <p className="text-[10px] text-amber-800 font-medium">
                              {isRtl ? 'مستند وشهادة ورقية مرفقة من المشرف العام' : 'Official paper report attached by General Supervisor'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setViewingFile({
                              name: selectedWorkOrder.executionReport?.paperReportName || (isRtl ? 'التقرير الورقي' : 'Paper Report'),
                              url: selectedWorkOrder.executionReport!.paperReportUrl!
                            })}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{isRtl ? 'معاينة' : 'Preview'}</span>
                          </button>
                          <a
                            href={selectedWorkOrder.executionReport.paperReportUrl}
                            download={selectedWorkOrder.executionReport.paperReportName || 'Paper_Report.pdf'}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{isRtl ? 'تحميل' : 'Download'}</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Client Electronic Signature display */}
                  {selectedWorkOrder.executionReport.clientSignature && (
                    <div className="border border-slate-150 bg-slate-50/50 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-start">
                      <div className="text-xs space-y-1">
                        <span className="text-slate-400 font-bold block">{isRtl ? 'المصادقة وتوقيع الاستلام:' : 'Client Receipt Authorization:'}</span>
                        <p className="font-extrabold text-slate-800 text-[13px]">{selectedWorkOrder.executionReport.clientSignature.signatoryName || selectedWorkOrder.executionReport.clientSignature.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">SIGNED AT: {selectedWorkOrder.executionReport.clientSignature.signedAt}</p>
                      </div>
                      {selectedWorkOrder.executionReport.clientSignature.url && (
                        <div className="border border-slate-200 bg-white rounded-lg p-2 max-w-[200px] shadow-sm">
                          <img 
                            src={selectedWorkOrder.executionReport.clientSignature.url} 
                            alt="Client Signature" 
                            className="max-h-16 object-contain block" 
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50/20 border border-amber-100 rounded-2xl p-5 text-center space-y-2">
                  <span className="text-2xl block">⏳</span>
                  <h5 className="font-bold text-amber-800 text-xs">
                    {isRtl ? 'أعمال الصيانة والتثبيت قيد المتابعة حالياً' : 'Maintenance & execution is currently in progress'}
                  </h5>
                  <p className="text-[11px] text-slate-500 max-w-md mx-auto leading-relaxed">
                    {isRtl 
                      ? 'بمجرد انتهاء الفني المختص من إنجاز بنود الصيانة في منشأتكم وتوقيعكم على جهاز الفني للمصادقة، سيتم فوراً تحديث حالة البنود وإظهار التقرير والتوقيع هنا تلقائياً.' 
                      : 'Once the specialist technician finishes executing the items at your branch and you electronically sign on their device, the field status of each item, the final completion notes and receipt sign-off will automatically appear here.'}
                  </p>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex flex-wrap gap-3 justify-between items-center">
              <span className="text-[10px] text-slate-400 font-sans font-bold uppercase">
                NESMA FIRST SAFETY SYSTEMS
              </span>
              <div className="flex items-center gap-2">
                {selectedWorkOrder.executionReport && (
                  <button
                    type="button"
                    onClick={() => {
                      const wo = selectedWorkOrder;
                      setSelectedWorkOrder(null);
                      setViewingExecutionReportQuote(wo);
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5 text-safety-emerald" />
                    <span>{isRtl ? 'طباعة وتحميل التقرير الرسمي' : 'Print / Download Official Report'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedWorkOrder(null)}
                  className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  {isRtl ? 'إغلاق المعاينة' : 'Close Review'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
