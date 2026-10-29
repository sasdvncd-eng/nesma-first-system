import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  CheckCircle,
  Clock,
  Calendar,
  User,
  FileText,
  Printer,
  Shield,
  Edit3,
  Camera,
  Video,
  FileUp,
  Upload,
  Trash2,
  Plus,
  Save,
  Download,
  Eye,
  CheckSquare,
  Square,
  Image as ImageIcon,
  Paperclip,
  ExternalLink,
  Film,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Quotation, Client, Technician, QuotationExecutionReport } from '../types';
import { compressImageIfNeeded } from '../lib/imageCompressor';
import { formatVideoUrl, isVideoUrl, isImageUrl, readFileAsDataURL } from '../lib/mediaUtils';

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

interface ExecutionReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: Quotation | null;
  clients: Client[];
  technicians: Technician[];
  adminName: string;
  lang: 'ar' | 'en';
  isAdmin?: boolean;
  onUpdateQuotation?: (updatedQuote: Quotation) => void;
}

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

export default function ExecutionReportModal({
  isOpen,
  onClose,
  quotation,
  clients,
  technicians,
  adminName,
  lang,
  isAdmin = false,
  onUpdateQuotation,
}: ExecutionReportModalProps) {
  if (!isOpen || !quotation || !quotation.executionReport) return null;

  const isRtl = lang === 'ar';
  const report = quotation.executionReport;

  // Edit States for General Supervisor
  const [isEditing, setIsEditing] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editTechnicianName, setEditTechnicianName] = useState('');
  const [editCompletedAt, setEditCompletedAt] = useState('');
  const [editCompletedItems, setEditCompletedItems] = useState<string[]>([]);
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [editVideos, setEditVideos] = useState<string[]>([]);
  const [editPaperReportUrl, setEditPaperReportUrl] = useState('');
  const [editPaperReportName, setEditPaperReportName] = useState('');
  const [editVideoUrlInput, setEditVideoUrlInput] = useState('');
  const [uploadState, setUploadState] = useState<{
    isUploading: boolean;
    progress: number;
    statusText: string;
  }>({ isUploading: false, progress: 0, statusText: '' });

  // Lightbox Preview State
  const [lightboxItem, setLightboxItem] = useState<{
    url: string;
    type: 'photo' | 'video' | 'paper';
    title?: string;
  } | null>(null);

  // File Input Refs
  const photoCameraRef = useRef<HTMLInputElement>(null);
  const photoGalleryRef = useRef<HTMLInputElement>(null);
  const videoCameraRef = useRef<HTMLInputElement>(null);
  const videoGalleryRef = useRef<HTMLInputElement>(null);
  const paperReportInputRef = useRef<HTMLInputElement>(null);

  // Find the client object associated with the quotation
  const reportClient = clients.find(
    (c) => c.id === quotation.clientId || c.name === quotation.clientName
  );

  const branchObj = quotation.branchName && reportClient?.branches
    ? reportClient.branches.find(b => b.name === quotation.branchName)
    : undefined;

  const displayLocationText = branchObj?.locationText || reportClient?.locationText || (isRtl ? 'غير محدد' : 'Not Specified');
  const displayLocationUrl = branchObj?.locationUrl || reportClient?.locationUrl;

  // Reconcile supervisor name
  const supervisorName = reportClient
    ? reportClient.contractSupervisorId === 'admin'
      ? (adminName || (isRtl ? 'المشرف العام' : 'General Admin'))
      : (technicians.find((tech) => tech.id === reportClient.contractSupervisorId)?.name ||
         adminName ||
         (isRtl ? 'المشرف العام' : 'General Admin'))
    : (adminName || (isRtl ? 'المشرف العام' : 'General Admin'));

  // Sync state whenever quotation changes or opens
  useEffect(() => {
    if (quotation?.executionReport) {
      const rep = quotation.executionReport;
      setEditNotes(rep.notes || '');
      setEditTechnicianName(rep.technicianName || '');
      setEditCompletedAt(rep.completedAt ? rep.completedAt.substring(0, 16) : new Date().toISOString().substring(0, 16));
      setEditCompletedItems(rep.completedItems || quotation.items.map((i) => i.id));
      setEditPhotos(rep.mediaUrls || []);
      setEditVideos(rep.videoUrls || []);
      setEditPaperReportUrl(rep.paperReportUrl || '');
      setEditPaperReportName(rep.paperReportName || '');
      setIsEditing(false);
    }
  }, [quotation, isOpen]);

  // Photo Upload Handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadState({
      isUploading: true,
      progress: 5,
      statusText: isRtl ? 'جاري رفع وتجهيز الصور...' : 'Uploading & processing photos...',
    });
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const pct = Math.round(((i + 1) / files.length) * 100);
        setUploadState({
          isUploading: true,
          progress: pct,
          statusText: isRtl
            ? `جاري معالجة الصورة ${i + 1} من ${files.length} (${pct}%)...`
            : `Processing photo ${i + 1} of ${files.length} (${pct}%)...`,
        });
        const compressedBase64 = await compressImageIfNeeded(file, 1200, 1200, 0.85);
        const dataUrl = compressedBase64.startsWith('data:')
          ? compressedBase64
          : `data:${file.type || 'image/jpeg'};base64,${compressedBase64}`;
        setEditPhotos((prev) => [...prev, dataUrl]);
      } catch (err) {
        console.error('Error uploading photo:', err);
      }
    }
    setUploadState({ isUploading: false, progress: 100, statusText: '' });
    if (photoCameraRef.current) photoCameraRef.current.value = '';
    if (photoGalleryRef.current) photoGalleryRef.current.value = '';
  };

  // Video Upload Handler
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadState({
      isUploading: true,
      progress: 5,
      statusText: isRtl ? 'جاري رفع وتجهيز مقاطع الفيديو...' : 'Uploading & processing video files...',
    });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 50 * 1024 * 1024) {
        alert(
          isRtl
            ? 'تنبيه: حجم ملف الفيديو كبير جداً (أكثر من 50 ميجابايت). يرجى تقليل حجم الفيديو أو استخدام إضافة رابط.'
            : 'Warning: Video file size is too large (>50MB). Please select a smaller video or paste a link.'
        );
        continue;
      }
      try {
        const rawDataUrl = await readFileAsDataURL(file, (pct) => {
          const overallPct = Math.round(((i + pct / 100) / files.length) * 100);
          setUploadState({
            isUploading: true,
            progress: overallPct,
            statusText: isRtl
              ? `جاري رفع وقراءة الفيديو ${i + 1} من ${files.length} (${pct}%)...`
              : `Reading video file ${i + 1} of ${files.length} (${pct}%)...`,
          });
        });

        const formatted = formatVideoUrl(rawDataUrl);
        setEditVideos((prev) => [...prev, formatted]);
      } catch (err) {
        console.error('Error uploading video:', err);
      }
    }

    setUploadState({ isUploading: false, progress: 100, statusText: '' });
    if (videoCameraRef.current) videoCameraRef.current.value = '';
    if (videoGalleryRef.current) videoGalleryRef.current.value = '';
  };

  const handleAddVideoLink = () => {
    if (!editVideoUrlInput.trim()) return;
    setEditVideos((prev) => [...prev, formatVideoUrl(editVideoUrlInput.trim())]);
    setEditVideoUrlInput('');
  };

  // Paper Report Upload Handler
  const handlePaperReportUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadState({
      isUploading: true,
      progress: 10,
      statusText: isRtl ? 'جاري رفع وتجهيز التقرير الورقي...' : 'Uploading paper report...',
    });
    try {
      const dataUrl = await readFileAsDataURL(file, (pct) => {
        setUploadState({
          isUploading: true,
          progress: pct,
          statusText: isRtl
            ? `جاري رفع التقرير الورقي (${pct}%)...`
            : `Uploading paper report (${pct}%)...`,
        });
      });
      setEditPaperReportUrl(dataUrl);
      setEditPaperReportName(file.name);
    } catch (err) {
      console.error('Error uploading paper report:', err);
    }
    setUploadState({ isUploading: false, progress: 100, statusText: '' });
    if (paperReportInputRef.current) paperReportInputRef.current.value = '';
  };

  // Save changes handler for General Supervisor
  const handleSaveReportEdit = () => {
    if (!quotation || !quotation.executionReport) return;

    const updatedExecutionReport: QuotationExecutionReport = {
      ...quotation.executionReport,
      notes: editNotes,
      technicianName: editTechnicianName || quotation.executionReport.technicianName,
      completedAt: editCompletedAt ? new Date(editCompletedAt).toISOString() : quotation.executionReport.completedAt,
      completedItems: editCompletedItems,
      mediaUrls: editPhotos,
      videoUrls: editVideos,
      paperReportUrl: editPaperReportUrl || undefined,
      paperReportName: editPaperReportName || undefined,
    };

    const totalItemsCount = quotation.items?.length || 0;
    const doneItemsCount = editCompletedItems.length;
    let newWorkOrderStatus: 'new' | 'pending' | 'partially_completed' | 'completed' = 'completed';
    if (totalItemsCount > 0) {
      if (doneItemsCount >= totalItemsCount) {
        newWorkOrderStatus = 'completed';
      } else if (doneItemsCount > 0) {
        newWorkOrderStatus = 'partially_completed';
      } else {
        newWorkOrderStatus = 'pending';
      }
    }

    const updatedQuotation: Quotation = {
      ...quotation,
      executionReport: updatedExecutionReport,
      workOrderStatus: newWorkOrderStatus
    };

    if (onUpdateQuotation) {
      onUpdateQuotation(updatedQuotation);
    }

    setIsEditing(false);
    alert(isRtl ? 'تم تحديث التقرير وإرفاق صور/فيديو/التقرير الورقي بنجاح' : 'Execution report & attached media updated successfully!');
  };

  const handlePrint = () => {
    const isArabic = lang === 'ar';
    const clientName = quotation.clientName;
    const branchName = quotation.branchName || (isArabic ? 'الفرع الرئيسي' : 'HQ Main Site');
    const printLocationText = displayLocationText;
    const printLocationUrl = displayLocationUrl;
    const quoteId = quotation.id.split('_')[1] || quotation.id;
    const completedAtStr = new Date(report.completedAt).toLocaleString(isArabic ? 'ar-EG' : 'en-US');
    const datePrintedStr = new Date().toLocaleDateString(isArabic ? 'ar-EG' : 'en-US');

    // Generate table rows
    const tableRows = quotation.items.map((item) => {
      const isItemDone = report.completedItems.includes(item.id);
      const statusText = isItemDone 
        ? (isArabic ? 'تم الاستبدال والتركيب' : 'Replaced & Configured')
        : (isArabic ? 'لم ينجز' : 'Not Replaced');
      const badgeClass = isItemDone ? 'status-success' : 'status-pending';
      
      return `
        <tr>
          <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #e2e8f0; text-align: ${isArabic ? 'right' : 'left'};">${item.description}</td>
          <td style="padding: 10px; text-align: center; font-weight: bold; font-family: monospace; border-bottom: 1px solid #e2e8f0;">${item.quantity}</td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #e2e8f0;">
            <span class="status-badge ${badgeClass}">${statusText}</span>
          </td>
        </tr>
      `;
    }).join('');

    // Generate Photos HTML for print if available
    const photosPrintHtml = (report.mediaUrls && report.mediaUrls.length > 0) ? `
      <h4 class="section-heading">${isArabic ? 'صور الإنجاز والمعاينة الميدانية المرفقة:' : 'Attached Execution Photos:'}</h4>
      <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 18px;">
        ${report.mediaUrls.map((pUrl) => `
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; width: 140px; height: 100px; background: #f8fafc;">
            <img src="${pUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="Photo" referrerPolicy="no-referrer" />
          </div>
        `).join('')}
      </div>
    ` : '';

    // Generate Paper Report HTML for print if available
    const paperReportPrintHtml = report.paperReportUrl ? `
      <div style="border: 1px solid #f59e0b; background: #fffbeb; border-radius: 10px; padding: 10px; margin-bottom: 18px; text-align: ${isArabic ? 'right' : 'left'};">
        <strong style="color: #92400e; font-size: 11px;">
          ${isArabic ? '📄 يوجد تقرير ورقي معتمد مرفق بهذا الأمر:' : '📄 Attached Official Paper Report:'} ${report.paperReportName || (isArabic ? 'تقرير_ورقي.pdf' : 'Paper_Report.pdf')}
        </strong>
      </div>
    ` : '';

    const signatureBlockHtml = report.clientSignature ? `
      <div class="sig-section" style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; background: #f8fafc; text-align: ${isArabic ? 'right' : 'left'};">
        <span style="font-size: 10px; color: #64748b; font-weight: bold; display: block; margin-bottom: 5px;">
          ${isArabic ? 'المستلم المفوض وصاحب التوقيع:' : 'Authorized Recipient Signatory:'}
        </span>
        <strong style="color: #0f172a; font-size: 12px; display: block;">
          ${report.clientSignature.signatoryName || report.clientSignature.name || ''}
        </strong>
        <span style="font-size: 9px; color: #94a3b8; font-family: monospace; display: block; margin-top: 2px;">
          SIGNED AT: ${report.clientSignature.signedAt}
        </span>
        <div style="margin-top: 10px; text-align: center;">
          <img src="${report.clientSignature.url}" style="max-height: 60px; object-fit: contain; display: inline-block;" alt="Signature" referrerPolicy="no-referrer" />
        </div>
      </div>
    ` : '';

    const html = `
      <!DOCTYPE html>
      <html dir="${isArabic ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="utf-8">
        <title>Execution_Report_${clientName.replace(/\s+/g, '_')}_${quoteId}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            font-family: 'Cairo', 'Inter', sans-serif;
            margin: 0;
            padding: 16mm 16mm;
            color: #1e293b;
            background-color: #ffffff;
            line-height: 1.4;
            font-size: 11px;
            direction: ${isArabic ? 'rtl' : 'ltr'};
          }
          .header {
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .logo-container {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .logo {
            width: 70px;
            height: auto;
          }
          .company-title {
            font-size: 14px;
            font-weight: 900;
            color: #0f172a;
            margin: 0;
          }
          .company-desc {
            font-size: 8.5px;
            color: #64748b;
            margin: 2px 0 0 0;
            line-height: 1.3;
          }
          .header-meta {
            text-align: ${isArabic ? 'left' : 'right'};
          }
          .report-ref {
            font-size: 10px;
            font-weight: 800;
            color: #0f172a;
            border: 1.5px solid #0f172a;
            padding: 3px 8px;
            background: #f8fafc;
            display: inline-block;
            border-radius: 6px;
            font-family: monospace;
          }
          .print-date {
            font-size: 8.5px;
            color: #64748b;
            margin-top: 4px;
          }
          .info-grid-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 12px 6px;
            margin-bottom: 18px;
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 12px;
          }
          .info-item span {
            font-size: 9px;
            color: #64748b;
            display: block;
            margin-bottom: 2px;
          }
          .info-item strong {
            font-size: 11px;
            color: #0f172a;
            font-weight: 700;
          }
          .section-heading {
            font-size: 11px;
            font-weight: 850;
            color: #0f172a;
            border-${isArabic ? 'right' : 'left'}: 4px solid #4f46e5;
            padding-${isArabic ? 'right' : 'left'}: 8px;
            margin: 15px 0 10px 0;
          }
          .table-container {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            overflow: hidden;
            margin-bottom: 18px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          th {
            background: #f8fafc;
            font-size: 9px;
            font-weight: 800;
            color: #475569;
            padding: 8px 10px;
            border-bottom: 1.5px solid #e2e8f0;
            text-align: ${isArabic ? 'right' : 'left'};
          }
          .status-badge {
            display: inline-block;
            font-size: 8px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
          }
          .status-success {
            background: #f0fdf4;
            color: #166534;
            border: 1px solid #bbf7d0;
          }
          .status-pending {
            background: #f1f5f9;
            color: #475569;
            border: 1px solid #cbd5e1;
          }
          .tech-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 12px 6px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 8px;
            margin-bottom: 18px;
          }
          .tech-item span {
            font-size: 9px;
            color: #64748b;
            display: block;
            margin-bottom: 2px;
          }
          .tech-item strong {
            font-size: 11px;
            color: #0f172a;
            font-weight: 800;
          }
          .notes-container {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 12px;
            margin-bottom: 18px;
          }
          .notes-title {
            font-size: 9px;
            color: #64748b;
            font-weight: bold;
            display: block;
            margin-bottom: 4px;
          }
          .notes-content {
            font-size: 10.5px;
            color: #334155;
            font-style: italic;
            margin: 0;
            line-height: 1.45;
          }
          .sign-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 12px 0px;
            margin-top: 15px;
            page-break-inside: avoid;
          }
          .supervisor-section {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 15px;
            background: #f8fafc;
            display: flex;
            justify-content: space-between;
            align-items: center;
            height: 100%;
          }
          .supervisor-info {
            text-align: ${isArabic ? 'right' : 'left'};
          }
          .stamp-container {
            width: 100px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .footer-watermark {
            margin-top: 25px;
            text-align: center;
            font-size: 8px;
            color: #94a3b8;
            border-top: 1px dashed #e2e8f0;
            padding-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-container">
            <img class="logo" src="/logo_nesma.png?v=2" alt="Nesma Logo" referrerPolicy="no-referrer" />
            <div>
              <h1 class="company-title">${isArabic ? 'شركة نسما الاولى لأنظمة السلامة' : 'Nesma First Safety Systems'}</h1>
              <p class="company-desc">
                ${isArabic 
                  ? 'شركة معتمدة لتركيب وصيانة شبكات إنذار ومكافحة الحريق ومعدات السلامة بترخيص الدفاع المدني.' 
                  : 'Certified Safety & Fire Protection Systems Enterprise, Civil Defense License.'}
              </p>
            </div>
          </div>
          <div class="header-meta">
            <div class="report-ref">
              ${isArabic ? 'تقرير إنجاز أعمال رقم' : 'REPORT REF'}: #REP_${quoteId}
            </div>
            <div class="print-date">
              <strong>${isArabic ? 'تاريخ الطباعة:' : 'Date Printed:'}</strong> ${datePrintedStr}
            </div>
          </div>
        </div>

        <table class="info-grid-table">
          <tr>
            <td class="info-item" style="width: 50%; vertical-align: top;">
              <span>${isArabic ? 'العميل المستفيد:' : 'Client Venue:'}</span>
              <strong>${clientName}</strong>
            </td>
            <td class="info-item" style="width: 50%; vertical-align: top;">
              <span>${isArabic ? 'اسم موقع الفرع وعنوانه:' : 'Branch Site & Address:'}</span>
              <strong>${branchName} ${printLocationText ? `(${printLocationText})` : ''}</strong>
            </td>
          </tr>
          <tr>
            <td class="info-item" style="width: 50%; vertical-align: top;">
              <span>${isArabic ? 'إحداثيات موقع الفرع (خرائط Google):' : 'Branch Location Map:'}</span>
              <strong>
                ${printLocationUrl 
                  ? `<a href="${printLocationUrl}" target="_blank" style="color: #4f46e5; text-decoration: underline;">${isArabic ? 'افتح على خرائط Google 🗺️' : 'Open Google Maps 🗺️'}</a>` 
                  : '---'}
              </strong>
            </td>
            <td class="info-item" style="width: 50%; vertical-align: top;">
              <span>${isArabic ? 'رقم عرض السعر المرتبط:' : 'Associated Quote ID:'}</span>
              <strong style="color: #4f46e5;">#${quoteId}</strong>
            </td>
          </tr>
          <tr>
            <td class="info-item" style="width: 50%; vertical-align: top;">
              <span>${isArabic ? 'حالة إنجاز الأعمال الفنية:' : 'Execution Status:'}</span>
              <strong style="color: #166534;">${isArabic ? '✅ تم إنجاز الأعمال بنجاح ومطابقة المواصفات' : '✅ Completed & Authorized'}</strong>
            </td>
            <td class="info-item" style="width: 50%; vertical-align: top;">
              &nbsp;
            </td>
          </tr>
        </table>

        <h4 class="section-heading">
          ${isArabic 
            ? 'مواصفات وكميات قطع الغيار والأجهزة التي تم تركيبها وصيانتها:' 
            : 'Specifications & quantities of replaced spare parts / equipment:'}
        </h4>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th style="width: 60%;">${isArabic ? 'البيان ومواصفات قطع الغيار المطلوبة' : 'Specification of Spare Parts'}</th>
                <th style="width: 20%; text-align: center;">${isArabic ? 'الكمية' : 'Quantity'}</th>
                <th style="width: 20%; text-align: center;">${isArabic ? 'الحالة الفنية' : 'Replacement Status'}</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>

        <h4 class="section-heading">
          ${isArabic ? 'إفادة فني الصيانة المعالج والاعتماد:' : 'Technical specialist report & comments:'}
        </h4>

        <table class="tech-table">
          <tr>
            <td class="tech-item" style="width: 50%; vertical-align: top;">
              <span>${isArabic ? 'اسم فني الصيانة المعالج:' : 'Technical Specialist:'}</span>
              <strong>${report.technicianName}</strong>
            </td>
            <td class="tech-item" style="width: 50%; vertical-align: top;">
              <span>${isArabic ? 'تاريخ ووقت إتمام الأعمال:' : 'Completion Timestamp:'}</span>
              <strong style="font-family: monospace;">${completedAtStr}</strong>
            </td>
          </tr>
        </table>

        ${report.notes ? `
          <div class="notes-container">
            <span class="notes-title">${isArabic ? 'ملاحظات وإفادة الإنجاز الفنية:' : 'Technical notes & remarks:'}</span>
            <div class="notes-content">
              <ul style="margin: 4px 0 0 0; padding-right: 20px; padding-left: 20px; list-style-type: disc; text-align: ${isArabic ? 'right' : 'left'};">
                ${(report.notes || '').split('\n').map(l => l.trim()).filter(Boolean).map(line => `<li style="margin-bottom: 4px; font-weight: bold; color: #1e293b;">${line}</li>`).join('')}
              </ul>
            </div>
          </div>
        ` : ''}

        ${photosPrintHtml}
        ${paperReportPrintHtml}

        <table class="sign-table">
          <tr>
            ${report.clientSignature ? `
              <td style="width: 50%; vertical-align: top;">
                ${signatureBlockHtml}
              </td>
            ` : ''}
            <td style="width: ${report.clientSignature ? '50%' : '100%'}; vertical-align: top;">
              <div class="supervisor-section">
                <div class="supervisor-info">
                  <span style="font-size: 10px; color: #64748b; font-weight: bold; display: block; margin-bottom: 5px;">
                    ${isArabic ? 'توقيع واعتماد المشرف الفني المسؤول:' : 'Technical Supervisor Approval:'}
                  </span>
                  <strong style="color: #0f172a; font-size: 12px; display: block;">
                    ${supervisorName}
                  </strong>
                  <span style="font-size: 9.5px; color: #166534; font-weight: bold; display: block; margin-top: 4px;">
                    ${isArabic ? '✓ معتمد ومختوم إلكترونياً' : '✓ Electronically Signed & Stamped'}
                  </span>
                </div>
                <div class="stamp-container">
                  ${COMPANY_STAMP_SVG.replace('width="235"', 'width="100"').replace('height="83"', 'height="35"')}
                </div>
              </div>
            </td>
          </tr>
        </table>

        <div class="footer-watermark">
          ${isArabic 
            ? 'تم استخراج وتصدير هذه النسخة المعتمدة والمطابقة عبر النظام الموحد لشركة نسما الاولى لأنظمة السلامة.' 
            : 'Issued and exported via the Unified Portal of Nesma First Safety & Security.'}
        </div>
      </body>
      </html>
    `;

    printHtmlContent(html);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fade-in text-start">
      <div
        className="bg-white rounded-3xl max-w-3xl w-full mx-auto shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[95vh]"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div>
              <span className="text-[10px] text-slate-400 block font-bold font-sans uppercase tracking-wider">
                {isRtl ? 'تقرير إنجاز الأعمال الفنية والمصادقة' : 'Quotation Execution & Authorization Report'}
              </span>
              <h3 className="font-extrabold text-sm truncate max-w-[250px] sm:max-w-md font-sans">
                {quotation.clientName}
              </h3>
            </div>
            {isAdmin && !isEditing && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[10px] font-bold rounded-lg">
                <Shield className="w-3 h-3 text-amber-400" />
                {isRtl ? 'حساب المشرف العام' : 'General Supervisor'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && !isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isRtl ? 'تعديل التقرير والوسائط' : 'Edit Report & Media'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Container */}
        <div className="overflow-y-auto flex-1 bg-slate-50 print:bg-white print:overflow-visible">
          {isEditing ? (
            /* ================= EDIT MODE FOR GENERAL SUPERVISOR ================= */
            <div className="p-6 space-y-6 bg-white m-4 rounded-2xl border border-indigo-100 shadow-sm text-xs font-sans">
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-indigo-600 shrink-0" />
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm">
                      {isRtl ? 'وضع التعديل الخارجي لتقرير إنجاز أمر العمل (صلاحية المشرف العام)' : 'Work Order Report Edit Mode (General Supervisor Authority)'}
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {isRtl ? 'يمكنك هنا تعديل بنود التقرير، إفادة الصيانة، وإضافة صور وفيديوهات أو التقرير الورقي المرفق.' : 'You can modify report items, technician remarks, upload photos, videos, or attach the signed paper report.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 1. Checklist of Executed Items */}
              <div className="space-y-3">
                <label className="font-extrabold text-slate-900 text-xs block border-r-4 border-indigo-600 pr-2">
                  {isRtl ? '1. حالة إنجاز بنود أمر العمل وقطع الغيار:' : '1. Work Order Executed Items Checklist:'}
                </label>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                  {quotation.items.map((item) => {
                    const isChecked = editCompletedItems.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (isChecked) {
                            setEditCompletedItems((prev) => prev.filter((id) => id !== item.id));
                          } else {
                            setEditCompletedItems((prev) => [...prev, item.id]);
                          }
                        }}
                        className={`p-3 flex items-center justify-between cursor-pointer transition hover:bg-slate-100 ${
                          isChecked ? 'bg-emerald-50/50' : 'bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <span className="font-bold text-slate-800 text-xs">{item.description}</span>
                        </div>
                        <div className="flex items-center gap-3 font-mono">
                          <span className="text-slate-500 text-[11px]">{isRtl ? 'الكمية:' : 'Qty:'} {item.quantity}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isChecked ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                            {isChecked ? (isRtl ? 'منجز' : 'Done') : (isRtl ? 'غير منجز' : 'Not Done')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Technician Name & Completion Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isRtl ? 'اسم الفني المعالج:' : 'Technician Name:'}
                  </label>
                  <input
                    type="text"
                    value={editTechnicianName}
                    onChange={(e) => setEditTechnicianName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isRtl ? 'تاريخ ووقت الإنجاز:' : 'Completion Datetime:'}
                  </label>
                  <input
                    type="datetime-local"
                    value={editCompletedAt}
                    onChange={(e) => setEditCompletedAt(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* 3. Technical Notes */}
              <div>
                <label className="font-extrabold text-slate-900 text-xs block mb-1.5 border-r-4 border-indigo-600 pr-2">
                  {isRtl ? '2. ملاحظات وإفادة الإنجاز الفنية:' : '2. Technical Notes & Remarks:'}
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder={isRtl ? 'اكتب ملاحظات الصيانة وتفاصيل الأعمال المنجزة...' : 'Write technical notes...'}
                  className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 leading-relaxed focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Media & Attachments Section: 3-Card Design matching Visit Reports */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 block">
                    {isRtl ? 'توثيق بالوسائط والتقاط صور وفيديو + رفع التقارير' : 'Bilingual Field Media Logs & Document uploads'}
                  </label>
                  {uploadState.isUploading && (
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold animate-pulse flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>{uploadState.statusText || (isRtl ? 'جاري التحميل...' : 'Uploading...')}</span>
                    </span>
                  )}
                </div>

                {/* Upload Progress Bar Banner */}
                {uploadState.isUploading && (
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-1.5 animate-pulse">
                    <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
                        <span>{uploadState.statusText}</span>
                      </span>
                      <span>{uploadState.progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-indigo-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 transition-all duration-300"
                        style={{ width: `${uploadState.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* 1. Equipment / Execution Photo Card */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => photoCameraRef.current?.click()}
                      className="w-full p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex flex-col items-center justify-center text-center gap-1.5 transition text-slate-700 font-semibold cursor-pointer group hover:border-emerald-500 min-h-[95px]"
                    >
                      <Camera className="w-6 h-6 text-emerald-600 group-hover:scale-110 transition" />
                      <span className="text-[11px] font-bold text-slate-800 block">{isRtl ? 'التقاط صورة الصمام/اللوحة' : 'Capture Equipment Photo'}</span>
                      <span className="text-[9px] text-slate-500 font-medium block">{isRtl ? 'كاميرا الجوال المباشرة' : 'Direct rear camera'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => photoGalleryRef.current?.click()}
                      className="w-full text-[10px] text-teal-600 font-bold block text-center mt-1.5 hover:underline bg-transparent border-none p-0 cursor-pointer"
                    >
                      {isRtl ? '📂 أو اختر صورة من الألبوم' : '📂 Or choose from gallery'}
                    </button>
                    <input
                      ref={photoCameraRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                    <input
                      ref={photoGalleryRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </div>

                  {/* 2. Video Capture Card */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => videoCameraRef.current?.click()}
                      className="w-full p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex flex-col items-center justify-center text-center gap-1.5 transition text-slate-700 font-semibold cursor-pointer group hover:border-amber-500 min-h-[95px]"
                    >
                      <Video className="w-6 h-6 text-amber-600 group-hover:scale-110 transition" />
                      <span className="text-[11px] font-bold text-slate-800 block">{isRtl ? 'تسجيل مقطع صيانة فيديو' : 'Record Safety Video'}</span>
                      <span className="text-[9px] text-slate-500 font-medium block">{isRtl ? 'فيديو الجوال المباشر' : 'Direct rear video'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => videoGalleryRef.current?.click()}
                      className="w-full text-[10px] text-teal-600 font-bold block text-center mt-1.5 hover:underline bg-transparent border-none p-0 cursor-pointer"
                    >
                      {isRtl ? '📂 أو اختر فيديو من الألبوم' : '📂 Or choose from gallery'}
                    </button>
                    <input
                      ref={videoCameraRef}
                      type="file"
                      accept="video/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleVideoUpload}
                    />
                    <input
                      ref={videoGalleryRef}
                      type="file"
                      accept="video/*"
                      multiple
                      className="hidden"
                      onChange={handleVideoUpload}
                    />
                  </div>

                  {/* 3. Paper Report Card */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => paperReportInputRef.current?.click()}
                      className="w-full p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex flex-col items-center justify-center text-center gap-1.5 transition text-slate-700 font-semibold cursor-pointer group hover:border-indigo-500 min-h-[95px]"
                    >
                      <Upload className="w-6 h-6 text-red-600 group-hover:scale-110 transition" />
                      <span className="text-[11px] font-bold text-slate-800 block">{isRtl ? 'إرسال تقرير الزيارة كـ PDF' : 'Upload Safety Report PDF'}</span>
                      <span className="text-[9px] text-slate-500 font-medium block">{isRtl ? 'رفع شهادة فحص سلامة ورقية' : 'Upload paper safety certificate'}</span>
                    </button>
                    <input
                      ref={paperReportInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={handlePaperReportUpload}
                    />
                  </div>
                </div>

                {/* Optional Video Link Input */}
                <div className="flex gap-2 pt-1">
                  <input
                    type="url"
                    value={editVideoUrlInput}
                    onChange={(e) => setEditVideoUrlInput(e.target.value)}
                    placeholder={isRtl ? 'أو ألصق رابط فيديو هنا (YouTube, MP4, Direct Link)...' : 'Or paste a video link URL...'}
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddVideoLink}
                    className="px-3.5 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition cursor-pointer shrink-0"
                  >
                    {isRtl ? 'إضافة رابط' : 'Add Link'}
                  </button>
                </div>

                {/* Previews of Uploaded Items */}
                {/* Photos Preview */}
                {editPhotos.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] font-bold text-slate-700 block">
                      📷 {isRtl ? `الصور المرفوعة (${editPhotos.length}):` : `Uploaded Photos (${editPhotos.length}):`}
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {editPhotos.map((photoUrl, idx) => (
                        <div key={idx} className="relative group aspect-4/3 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-xs">
                          <img src={photoUrl} alt="Upload preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <button
                            type="button"
                            onClick={() => setEditPhotos((prev) => prev.filter((_, i) => i !== idx))}
                            className="absolute top-1.5 right-1.5 p-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition shadow-md cursor-pointer"
                            title={isRtl ? 'حذف الصورة' : 'Remove Photo'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Videos Preview */}
                {editVideos.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] font-bold text-slate-700 block">
                      📹 {isRtl ? `مقاطع الفيديو المرفوعة (${editVideos.length}):` : `Uploaded Videos (${editVideos.length}):`}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {editVideos.map((vidUrl, idx) => {
                        const formatted = formatVideoUrl(vidUrl);
                        return (
                          <div key={idx} className="relative border border-slate-800 bg-slate-950 rounded-2xl overflow-hidden p-2 flex flex-col shadow-md">
                            <video
                              src={formatted}
                              controls
                              preload="metadata"
                              playsInline
                              className="w-full max-h-48 object-contain bg-black rounded-xl"
                            />
                            <div className="mt-2 flex items-center justify-between text-white text-xs font-bold px-1">
                              <span className="flex items-center gap-1.5 text-purple-300">
                                <Film className="w-4 h-4 text-purple-400 shrink-0" />
                                <span>🎬 {isRtl ? `فيديو إنجاز #${idx + 1}` : `Video #${idx + 1}`}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setEditVideos((prev) => prev.filter((_, i) => i !== idx))}
                                className="p-1 bg-red-600 hover:bg-red-700 text-white rounded-lg transition cursor-pointer shrink-0"
                                title={isRtl ? 'حذف الفيديو' : 'Remove Video'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Paper Report Preview */}
                {editPaperReportUrl && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] font-bold text-slate-700 block">
                      📄 {isRtl ? 'التقرير الورقي المرفق:' : 'Attached Paper Report:'}
                    </span>
                    <div className="border border-amber-200 bg-amber-50 p-3 rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-5 h-5 text-amber-700 shrink-0" />
                        <span className="font-extrabold text-slate-900 text-xs truncate">
                          {editPaperReportName || (isRtl ? 'تقرير_ورقي_مرفق.pdf' : 'Paper_Report_Attached.pdf')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditPaperReportUrl('');
                          setEditPaperReportName('');
                        }}
                        className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition cursor-pointer shrink-0"
                        title={isRtl ? 'حذف التقرير الورقي' : 'Remove Paper Report'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={uploadState.isUploading}
                  className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isRtl ? 'إلغاء التعديل' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveReportEdit}
                  disabled={uploadState.isUploading}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadState.isUploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{isRtl ? 'جاري رفع الوسائط...' : 'Uploading Media...'}</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{isRtl ? 'حفظ وتحديث التقرير بالكامل' : 'Save & Publish Updated Report'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* ================= VIEW MODE ================= */
            <div
              id="execution-report-print-area"
              className="p-6 sm:p-8 space-y-6 text-xs text-slate-800 text-start leading-relaxed bg-white relative select-text shadow-sm rounded-2xl m-4 print:m-0 print:p-0 print:shadow-none print:border-none font-sans"
            >
              {/* Report Title for Print */}
              <div className="hidden print:block border-b-2 border-slate-900 pb-6 mb-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4 text-start">
                    <img
                      src="/logo_nesma.png?v=2"
                      className="w-20 h-10 object-contain shrink-0"
                      alt="Nesma Logo"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h1 className="text-base font-black text-slate-900 tracking-tight">
                        {isRtl ? 'شركة نسما الاولى لأنظمة السلامة' : 'Nesma First Safety Systems'}
                      </h1>
                      <p className="text-[9px] text-slate-500 mt-0.5 leading-relaxed">
                        {isRtl
                          ? 'شركة معتمدة لتركيب وصيانة شبكات إنذار ومكافحة الحريق ومعدات السلامة بترخيص الدفاع المدني.'
                          : 'Certified Safety & Fire Protection Systems Enterprise, Civil Defense License.'}
                      </p>
                    </div>
                  </div>
                  <div className="text-end font-mono">
                    <div className="text-[10px] font-black text-slate-950 uppercase border border-slate-900 px-2 py-0.5 bg-slate-50 inline-block rounded">
                      {isRtl ? 'تقرير إنجاز أعمال رقم' : 'REPORT REF'}: #REP_
                      {quotation.id.split('_')[1] || quotation.id}
                    </div>
                    <div className="text-[9px] text-slate-500 mt-1">
                      <span className="font-bold">{isRtl ? 'تاريخ الطباعة' : 'Date Printed'}:</span>{' '}
                      {new Date().toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}
                    </div>
                  </div>
                </div>
                <div className="text-center pt-4 mt-2 border-t border-dashed border-slate-200">
                  <h2 className="text-sm font-black text-slate-900">
                    {isRtl
                      ? 'تقرير إنجاز الأعمال الفنية وصيانة الأجهزة والمصادقة'
                      : 'Technical Work Execution & Device Maintenance Report'}
                  </h2>
                </div>
              </div>

              {/* Client Info Block */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100 text-xs text-slate-500 font-medium font-sans print:border-slate-300">
                <div>
                  <span>{isRtl ? 'العميل المستفيد:' : 'Client Venue:'}</span>
                  <strong className="text-slate-900 block font-black text-xs sm:text-sm mt-0.5">
                    {quotation.clientName}
                  </strong>
                </div>
                <div>
                  <span>{isRtl ? 'موقع الفرع وعنوانه:' : 'Branch Site & Address:'}</span>
                  <strong className="text-slate-900 block font-bold text-xs sm:text-sm mt-0.5">
                    {quotation.branchName || (isRtl ? 'الفرع الرئيسي' : 'HQ Main Site')} {displayLocationText && `(${displayLocationText})`}
                  </strong>
                </div>
                <div>
                  <span>{isRtl ? 'رقم عرض السعر المرتبط:' : 'Associated Quote ID:'}</span>
                  <strong className="text-slate-900 block font-mono font-bold mt-0.5 text-xs sm:text-sm text-indigo-600">
                    #{quotation.id.split('_')[1] || quotation.id}
                  </strong>
                </div>
                <div>
                  <span>{isRtl ? 'حالة إنجاز الأعمال الفنية:' : 'Execution Status:'}</span>
                  {(() => {
                    const totalCount = quotation.items?.length || 0;
                    const doneCount = (report.completedItems || []).length;
                    const isFullyDone = totalCount > 0 ? doneCount >= totalCount : true;
                    const isPartial = doneCount > 0 && doneCount < totalCount;

                    if (isFullyDone) {
                      return (
                        <strong className="block font-bold text-emerald-600 mt-0.5 text-xs sm:text-sm">
                          {isRtl ? '✅ منجز ومكتمل بالكامل' : '✅ Fully Completed & Authorized'}
                        </strong>
                      );
                    }
                    if (isPartial) {
                      return (
                        <strong className="block font-bold text-orange-600 mt-0.5 text-xs sm:text-sm">
                          {isRtl ? `🟧 منجز جزئياً (تم إنجاز ${doneCount} من أصل ${totalCount} بنود)` : `🟧 Partially Completed (${doneCount}/${totalCount} items completed)`}
                        </strong>
                      );
                    }
                    return (
                      <strong className="block font-bold text-amber-600 mt-0.5 text-xs sm:text-sm">
                        {isRtl ? '⏳ قيد الانتظار والتشغيل' : '⏳ Pending Execution'}
                      </strong>
                    );
                  })()}
                </div>
                {displayLocationUrl && (
                  <div className="col-span-2">
                    <span>{isRtl ? 'رابط الموقع على خرائط Google:' : 'Location Coordinates:'}</span>
                    <div className="mt-0.5">
                      <a 
                        href={displayLocationUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-indigo-600 font-bold hover:underline inline-flex items-center gap-1 text-[11px]"
                      >
                        <span>🗺️</span>
                        <span>{isRtl ? 'افتح الموقع على خرائط جوجل وموقع الملاحة الجغرافية للفرع' : 'Open GPS navigation map for this branch'}</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Spare Parts Checklist Table */}
              <div className="space-y-3 font-sans">
                <h4 className="font-black text-slate-800 border-r-4 border-indigo-600 pr-2 text-xs print:border-slate-900">
                  {isRtl
                    ? 'مواصفات وكميات قطع الغيار والأجهزة التي تم تركيبها وصيانتها:'
                    : 'Specifications & quantities of replaced spare parts / equipment:'}
                </h4>

                <div className="overflow-hidden border border-slate-150 rounded-2xl print:border-slate-900">
                  <table className="w-full text-left rtl:text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-extrabold text-[10px] uppercase border-b border-slate-150 print:bg-slate-100 print:border-slate-900">
                        <th className="p-3">
                          {isRtl ? 'البيان ومواصفات قطع الغيار المطلوبة' : 'Specification of Spare Parts'}
                        </th>
                        <th className="p-3 text-center w-24">
                          {isRtl ? 'الكمية' : 'Quantity'}
                        </th>
                        <th className="p-3 text-center w-28">
                          {isRtl ? 'الحالة الفنية' : 'Replacement Status'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 print:divide-slate-300">
                      {quotation.items.map((item) => {
                        const isItemDone = report.completedItems.includes(item.id);
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition text-xs font-medium">
                            <td className="p-3 text-slate-800 font-bold">{item.description}</td>
                            <td className="p-3 text-center font-mono font-bold text-slate-900">
                              {item.quantity}
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${
                                  isItemDone
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 print:bg-white print:text-slate-900'
                                    : 'bg-slate-50 text-slate-500 border border-slate-200 print:bg-white print:text-slate-400'
                                }`}
                              >
                                {isItemDone
                                  ? isRtl
                                    ? 'تم الاستبدال والتركيب'
                                    : 'Replaced & Configured'
                                  : isRtl
                                  ? 'لم ينجز'
                                  : 'Not Replaced'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Executed Report Details */}
              <div className="space-y-4 pt-4 border-t border-slate-100 text-xs leading-relaxed text-slate-700 font-sans print:border-slate-900">
                <h4 className="font-black text-slate-800 border-r-4 border-emerald-600 pr-2 text-xs print:border-slate-900">
                  {isRtl ? 'إفادة فني الصيانة المعالج والاعتماد:' : 'Technical specialist report & comments:'}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-150 print:bg-white print:border-slate-900">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">
                      {isRtl ? 'اسم فني الصيانة المعالج:' : 'Technical Specialist:'}
                    </span>
                    <strong className="text-slate-800 font-extrabold text-sm block mt-0.5">
                      {report.technicianName}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">
                      {isRtl ? 'تاريخ ووقت إتمام الأعمال:' : 'Completion Timestamp:'}
                    </span>
                    <strong className="text-slate-800 font-bold block font-mono mt-0.5">
                      {new Date(report.completedAt).toLocaleString(isRtl ? 'ar-EG' : 'en-US')}
                    </strong>
                  </div>
                </div>

                {/* Show technician's notes / feedback */}
                {report.notes && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold block">
                      {isRtl ? 'ملاحظات وإفادة الإنجاز الفنية:' : 'Technical notes & remarks:'}
                    </span>
                    <div className="bg-indigo-50/40 p-3 border border-indigo-100 rounded-xl text-slate-700 text-[11px] leading-relaxed print:bg-white print:border-slate-200">
                      <ul className="list-disc pr-4 pl-4 space-y-0.5 text-[11px] text-slate-750 text-start rtl:text-right">
                        {(report.notes || '').split('\n').map(l => l.trim()).filter(Boolean).map((line, idx) => (
                          <li key={idx} className="italic text-slate-650">"{line}"</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Photos Gallery */}
                {report.mediaUrls && report.mediaUrls.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-slate-100 print:border-slate-300">
                    <h5 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-indigo-600 print:text-slate-900" />
                      <span>{isRtl ? '📸 صور وفوتوغرافيات الإنجاز الفني:' : '📸 Execution Photos & Proofs:'}</span>
                      <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold print:hidden">
                        {report.mediaUrls.length}
                      </span>
                    </h5>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                      {report.mediaUrls.map((photoUrl, idx) => (
                        <div
                          key={idx}
                          onClick={() => setLightboxItem({ url: photoUrl, type: 'photo', title: `${isRtl ? 'صورة إنجاز' : 'Photo'} #${idx + 1}` })}
                          className="group relative aspect-4/3 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer hover:shadow-md transition print:shadow-none"
                        >
                          <img src={photoUrl} alt={`Execution Photo ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1 print:hidden">
                            <Eye className="w-4 h-4" />
                            <span>{isRtl ? 'تكبير' : 'Enlarge'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Videos Section */}
                {report.videoUrls && report.videoUrls.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-slate-100 print:hidden">
                    <h5 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                      <Film className="w-4 h-4 text-purple-600" />
                      <span>{isRtl ? '📹 مقاطع الفيديو المرفقة بالإنجاز:' : '📹 Execution Videos:'}</span>
                      <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold">
                        {report.videoUrls.length}
                      </span>
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {report.videoUrls.map((vidUrl, idx) => {
                        const formattedVid = formatVideoUrl(vidUrl);
                        return (
                          <div key={idx} className="border border-slate-800 bg-slate-950 rounded-2xl overflow-hidden shadow-md flex flex-col">
                            <video src={formattedVid} controls className="w-full max-h-52 object-contain bg-black" />
                            <div className="p-2.5 bg-slate-900 flex items-center justify-between border-t border-slate-800">
                              <span className="text-[11px] text-purple-300 font-bold flex items-center gap-1">
                                <Film className="w-3.5 h-3.5 text-purple-400" />
                                <span>{isRtl ? `فيديو إنجاز #${idx + 1}` : `Execution Video #${idx + 1}`}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setLightboxItem({ url: formattedVid, type: 'video', title: `${isRtl ? 'فيديو إنجاز' : 'Video'} #${idx + 1}` })}
                                className="text-[11px] bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>{isRtl ? 'تكبير ملء الشاشة' : 'Full Screen'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Paper Report Section */}
                {report.paperReportUrl && (
                  <div className="space-y-2 pt-3 border-t border-slate-100 print:border-slate-300">
                    <h5 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-amber-600 print:text-slate-900" />
                      <span>{isRtl ? '📄 التقرير الورقي المرفق والشهادة المعتمدة:' : '📄 Attached Paper Report / Certificate:'}</span>
                    </h5>
                    <div className="border border-amber-200 bg-amber-50/60 p-3.5 rounded-2xl flex items-center justify-between gap-3 print:bg-white print:border-slate-300">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 print:bg-slate-100 print:text-slate-800">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-extrabold text-slate-900 text-xs truncate">
                            {report.paperReportName || (isRtl ? 'تقرير_ورقي_معتمد.pdf' : 'Paper_Report_Certified.pdf')}
                          </p>
                          <p className="text-[10px] text-amber-800 font-medium mt-0.5 print:text-slate-600">
                            {isRtl ? 'مستند وشهادة ورقية موقعة ومرفقة مع أمر العمل' : 'Signed paper document attached with work order'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 print:hidden">
                        <button
                          type="button"
                          onClick={() => setLightboxItem({ url: report.paperReportUrl!, type: 'paper', title: report.paperReportName || (isRtl ? 'التقرير الورقي' : 'Paper Report') })}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isRtl ? 'معاينة' : 'Preview'}</span>
                        </button>
                        <a
                          href={report.paperReportUrl}
                          download={report.paperReportName || 'Paper_Report.pdf'}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{isRtl ? 'تحميل' : 'Download'}</span>
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Electronic Signature block */}
                {report.clientSignature && (
                  <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 items-center print:border-slate-900">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">
                        {isRtl ? 'المستلم المفوض وصاحب التوقيع:' : 'Authorized Recipient Signatory:'}
                      </span>
                      <span className="font-black text-slate-900 block text-xs mt-1">
                        {report.clientSignature.signatoryName || report.clientSignature.name}
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">
                        {report.clientSignature.signedAt}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] text-slate-400 block font-bold">
                        {isRtl ? 'توقيع المستلم المعتمد:' : 'Signature Image:'}
                      </span>
                      <div className="border border-slate-200 rounded-xl p-1.5 bg-white mt-1 shadow-sm max-w-[200px] mx-auto print:border-slate-900">
                        <img
                          src={report.clientSignature.url}
                          alt="Signature"
                          className="w-full max-h-[60px] object-contain block mx-auto"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Stamp & Supervisor Approvals */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between print:border-slate-900">
                  <div className="text-start">
                    <span className="text-[10px] text-slate-400 block font-bold">
                      {isRtl ? 'توقيع واعتماد المشرف الفني المسؤول:' : 'Technical Supervisor Approval:'}
                    </span>
                    <span className="font-bold text-slate-700 block mt-1 underline underline-offset-2 decoration-dotted text-xs sm:text-sm">
                      {supervisorName}
                    </span>
                  </div>
                  <div className="flex flex-col items-center justify-center shrink-0">
                    <div
                      className="w-24 overflow-hidden opacity-90 mx-auto"
                      dangerouslySetInnerHTML={{
                        __html: COMPANY_STAMP_SVG.replace('width="235"', 'width="100"').replace(
                          'height="90"',
                          'height="38"'
                        ),
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex gap-3 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition cursor-pointer"
          >
            {isRtl ? 'إغلاق النافذة' : 'Close'}
          </button>

          {isAdmin && !isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex-1 py-2.5 text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isRtl ? 'تعديل التقرير والوسائط' : 'Edit Report & Media'}</span>
            </button>
          )}

          {!isEditing && (
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 py-2.5 text-xs font-extrabold bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 hover:scale-[1.01]"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isRtl ? 'طباعة أو تحميل التقرير' : 'Print / Download Report'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Lightbox Preview Modal */}
      {lightboxItem && (
        <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 text-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-800 shadow-2xl">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <span className="font-extrabold text-xs text-slate-200 truncate">
                {lightboxItem.title || (isRtl ? 'معاينة المرفق' : 'Attachment Preview')}
              </span>
              <button
                type="button"
                onClick={() => setLightboxItem(null)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-black/50">
              {lightboxItem.type === 'photo' && (
                <img
                  src={lightboxItem.url}
                  alt="Full preview"
                  className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-lg"
                  referrerPolicy="no-referrer"
                />
              )}
              {(lightboxItem.type === 'video' || isVideoUrl(lightboxItem.url)) && (
                <video
                  src={formatVideoUrl(lightboxItem.url)}
                  controls
                  autoPlay
                  className="max-h-[75vh] max-w-full rounded-xl bg-black shadow-lg"
                />
              )}
              {lightboxItem.type === 'paper' && !isVideoUrl(lightboxItem.url) && (
                lightboxItem.url.startsWith('data:image') ? (
                  <img
                    src={lightboxItem.url}
                    alt="Paper Report Preview"
                    className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-lg"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <iframe
                    src={lightboxItem.url}
                    className="w-full h-[70vh] rounded-xl bg-white border-0"
                    title="Paper Report PDF"
                  />
                )
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-800 flex justify-between items-center bg-slate-900/80">
              <span className="text-[10px] text-slate-400">NESMA FIRST SAFETY SYSTEMS</span>
              <button
                type="button"
                onClick={async () => {
                  const targetUrl = isVideoUrl(lightboxItem.url) || lightboxItem.type === 'video'
                    ? formatVideoUrl(lightboxItem.url)
                    : lightboxItem.url;
                  let ext = '.png';
                  if (isVideoUrl(targetUrl) || lightboxItem.type === 'video') ext = '.mp4';
                  else if (targetUrl.startsWith('data:application/pdf') || targetUrl.endsWith('.pdf') || lightboxItem.type === 'paper') ext = '.pdf';
                  else if (targetUrl.startsWith('data:image/jpeg') || targetUrl.endsWith('.jpg')) ext = '.jpg';

                  let filename = (lightboxItem.title || 'Attachment').replace(/\s+/g, '_');
                  if (!filename.toLowerCase().endsWith(ext)) filename += ext;

                  try {
                    const res = await fetch(targetUrl);
                    const blob = await res.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                  } catch (err) {
                    const link = document.createElement('a');
                    link.href = targetUrl;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isRtl ? 'تحميل الملف الأصلي' : 'Download File'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
