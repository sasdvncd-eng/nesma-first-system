import { useState, useEffect, FormEvent, ChangeEvent } from 'react';

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
    <text x="96" y="21" font-family="'Cairo', 'Inter', system-ui, -apple-system, sans-serif" font-size="12" font-weight="950" fill="#e2231a" text-anchor="middle" letter-spacing="0.5">شركة نسما الأولى لأنظمة السلامة</text>
    
    <text x="96" y="38" font-family="'Cairo', 'Inter', system-ui, -apple-system, sans-serif" font-size="10.8" font-weight="900" fill="#e2231a" text-anchor="middle">تدقيق واعتماد قسم الصيانة</text>
    
    <text x="96" y="54" font-family="'Cairo', 'Inter', system-ui, -apple-system, sans-serif" font-size="8.6" font-weight="800" fill="#7f1d1d" text-anchor="middle">معدات وأنظمة السلامة | الرقم الموحد 7003489890</text>
    
    <text x="96" y="70" font-family="monospace" font-size="6.8" font-weight="bold" fill="#e2231a" text-anchor="middle">MAINTENANCE DEPT - OFFICIALLY APPROVED</text>
  </g>
</svg>
`;

import { Visit, Client, Technician, VisitStatus, VisitResult, Attachment } from '../types';
import { X, Calendar, User, FileText, AlertTriangle, CheckCircle2, MapPin, Phone, ShieldAlert, Image, Video, Download, Printer, Edit, Save, RefreshCw, Trash2, ExternalLink } from 'lucide-react';
import { Language, translations } from '../lib/translations';
import { dt } from '../lib/dynamicTranslate';

interface VisitDetailsModalProps {
  visit: Visit;
  client?: Client;
  onClose: () => void;
  lang: Language;
  isAdmin?: boolean;
  technicians?: Technician[];
  onUpdateVisit?: (visitId: string, updatedData: Partial<Visit>) => void;
  onDeleteOrResetVisit?: (visitId: string, action: 'reset' | 'delete') => void;
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

export default function VisitDetailsModal({ 
  visit, 
  client, 
  onClose, 
  lang, 
  isAdmin = false, 
  technicians = [], 
  onUpdateVisit,
  onDeleteOrResetVisit
}: VisitDetailsModalProps) {
  const t = translations[lang];
  const isRtl = lang === 'ar';

  const renderLinesAsBullets = (text: string, emptyMessage: string, isRose: boolean = false) => {
    const lines = (text || '')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      return <span className={isRose ? "text-rose-500 italic text-xs" : "text-slate-500 italic text-xs"}>{emptyMessage}</span>;
    }
    return (
      <ul className="list-disc pr-5 pl-5 space-y-1 text-slate-700 text-xs text-start rtl:text-right">
        {lines.map((line, idx) => (
          <li key={idx} className={isRose ? "font-semibold text-rose-900 leading-relaxed" : "font-semibold text-slate-800 leading-relaxed"}>
            {dt(line)}
          </li>
        ))}
      </ul>
    );
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editStatus, setEditStatus] = useState<VisitStatus>(visit.status);
  const [editResult, setEditResult] = useState<VisitResult>(visit.result);
  const [editScheduledDate, setEditScheduledDate] = useState(visit.scheduledDate || '');
  const [editCompletedDate, setEditCompletedDate] = useState(visit.completedDate || '');
  const [editNotes, setEditNotes] = useState(visit.notes || '');
  const [editDefects, setEditDefects] = useState(visit.defects || '');
  const [editSupervisorNotes, setEditSupervisorNotes] = useState(visit.supervisorNotes || '');
  const [editTechnicianId, setEditTechnicianId] = useState(visit.technicianId || '');
  const [editAttachments, setEditAttachments] = useState<Attachment[]>(visit.attachments || []);
  const [editFireExtinguisherExpiry, setEditFireExtinguisherExpiry] = useState(visit.fireExtinguisherExpiry || '');
  const [uploadProgress, setUploadProgress] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [localPreviewName, setLocalPreviewName] = useState<string>('');

  const branchObj = visit.branchName && client?.branches
    ? client.branches.find(b => b.name === visit.branchName)
    : undefined;

  const displayLocationText = branchObj?.locationText || client?.locationText || (isRtl ? 'غير محدد' : 'Not Specified');
  const displayLocationUrl = branchObj?.locationUrl || client?.locationUrl;

  useEffect(() => {
    setEditStatus(visit.status);
    setEditResult(visit.result);
    setEditScheduledDate(visit.scheduledDate || '');
    setEditCompletedDate(visit.completedDate || '');
    setEditNotes(visit.notes || '');
    setEditDefects(visit.defects || '');
    setEditSupervisorNotes(visit.supervisorNotes || '');
    setEditTechnicianId(visit.technicianId || '');
    setEditAttachments(visit.attachments || []);
    setEditFireExtinguisherExpiry(visit.fireExtinguisherExpiry || '');
  }, [visit]);

  const handleFormFileUpload = (e: ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'pdf') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert(isRtl 
        ? `تنبيه: حجم الملف المرفوع (${(file.size / (1024 * 1024)).toFixed(2)} ميجابايت) يتجاوز الحد الأقصى المسموح به (10 ميجابايت).\nيرجى ضغط الملف أو تقليل حجمه وإعادة المحاولة لتستقر بيانات الرفع ولا تحذف.` 
        : `Warning: The uploaded file size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed limit of 10 MB.\nPlease compress or reduce the file size and try again to ensure permanent stability of your uploads.`
      );
      return;
    }

    setUploadProgress(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      if (!result) {
        setUploadProgress(false);
        return;
      }

      try {
        const base64Content = result.split(',')[1];
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
        setUploadProgress(false);
        if (uploadRes.success) {
          const newAttachment: Attachment = {
            id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: file.name,
            type: type,
            url: uploadRes.url,
            uploadedAt: new Date().toISOString().split('T')[0]
          };
          setEditAttachments(prev => [...prev, newAttachment]);
        } else {
          throw new Error(uploadRes.error || 'Server upload failed');
        }
      } catch (err) {
        console.warn('[SAS Upload Fallback] Upload endpoint failed, using direct mock preview URL to prevent crash:', err);
        let fallbackUrl = '#';
        if (type === 'image') {
          fallbackUrl = result;
        } else if (type === 'video') {
          try {
            fallbackUrl = URL.createObjectURL(file);
          } catch (e) {
            fallbackUrl = 'https://www.w3schools.com/html/mov_bbb.mp4';
          }
        } else if (type === 'pdf') {
          try {
            fallbackUrl = URL.createObjectURL(file);
          } catch (e) {
            fallbackUrl = '#';
          }
        }
        
        const newAttachment: Attachment = {
          id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name: file.name,
          type: type,
          url: fallbackUrl,
          uploadedAt: new Date().toISOString().split('T')[0]
        };
        setEditAttachments(prev => [...prev, newAttachment]);
        setUploadProgress(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveChangesSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!onUpdateVisit) return;

    const clearedDefects = (editResult === 'passed' || editResult === 'not_visited') ? '' : editDefects;

    onUpdateVisit(visit.id, {
      status: editStatus,
      result: editResult,
      scheduledDate: editScheduledDate,
      completedDate: editStatus === 'completed' ? editCompletedDate || new Date().toISOString().split('T')[0] : undefined,
      notes: editNotes,
      defects: clearedDefects,
      supervisorNotes: editSupervisorNotes,
      technicianId: editTechnicianId,
      attachments: editAttachments,
      fireExtinguisherExpiry: editFireExtinguisherExpiry
    });

    setIsEditing(false);
    alert(isRtl ? 'تم تحديث تقرير الزيارة بنجاح!' : 'Visit report updated successfully!');
  };

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'passed':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t.passedResult}
          </span>
        );
      case 'has_defects':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            {t.hasDefectsResult}
          </span>
        );
      case 'critical_issues':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <ShieldAlert className="w-3.5 h-3.5" />
            {t.criticalResult}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
            {t.notVisitedResult}
          </span>
        );
    }
  };

  const handleDownloadReport = () => {
    const isArabic = lang === 'ar';
    const clientName = visit.clientName;
    const branchName = visit.branchName || (isArabic ? 'الفرع الرئيسي' : 'Main Branch');

    // Resolve branch location details
    const branchObj = visit.branchName && client?.branches
      ? client.branches.find(b => b.name === visit.branchName)
      : undefined;

    const printLocationText = branchObj?.locationText || client?.locationText || (isArabic ? 'غير محدد' : 'Not Specified');
    const printLocationUrl = branchObj?.locationUrl || client?.locationUrl;

    const contractNo = visit.contractNumber;
    const date = visit.completedDate || visit.scheduledDate;
    const statusLabel = visit.status === 'completed' 
      ? (isArabic ? 'مكتملة وموثقة بالكامل' : 'Completed & Filed') 
      : (isArabic ? 'مجدولة قيد المتابعة' : 'Pending');
    const resultLabel = visit.result === 'passed' 
      ? (isArabic ? 'سليم تماماً ومطابق لمعايير السلامة' : 'Passed ✔') 
      : visit.result === 'has_defects' 
        ? (isArabic ? 'وجود ملاحظات/أعطال بسيطة' : 'Minor Defects ⚠') 
        : (isArabic ? 'أعطال حرجة وبحاجة صيانة فورية!' : 'CRITICAL ERRORS ❌');
    const techName = visit.technicianName;
    
    const formatToBulletsHtml = (text: string, emptyMessage: string, colorStyle: string = '') => {
      const lines = (text || '')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
      if (lines.length === 0) return `<span style="font-style: italic; color: #94a3b8;">${emptyMessage}</span>`;
      return `<ul style="margin: 0; padding-right: 20px; padding-left: 20px; list-style-type: disc; text-align: ${isArabic ? 'right' : 'left'};">` + 
        lines.map(line => `<li style="margin-bottom: 4px; ${colorStyle}">${line}</li>`).join('') + 
        `</ul>`;
    };

    const notesText = formatToBulletsHtml(visit.notes, isArabic ? 'لا توجد ملاحظات مسجلة' : 'No general notes');
    const defectsText = formatToBulletsHtml(visit.defects, isArabic ? 'لا توجد قطع تالفة أو أعطال مسجلة' : 'No defective components recorded', visit.result === 'passed' ? '' : 'color: #991b1b; font-weight: bold;');
    
    // Premium official A4 corporate fire safety certificate CSS & HTML formulation
    const html = `
      <!DOCTYPE html>
      <html dir="${isArabic ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="utf-8">
        <title>Nesma_Safety_Report_${clientName.replace(/\s+/g, '_')}_${date}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box;
          }
          @page {
            size: A4 portrait;
            margin: 4mm 5mm;
          }
          body {
            font-family: 'Cairo', 'Inter', sans-serif;
            margin: 0;
            padding: 0 5px;
            color: #1e293b;
            background-color: #ffffff;
            line-height: 1.35;
            font-size: 11px;
          }
          .certificate-container {
            border: 4px double #0f766e;
            padding: 10px 14px;
            position: relative;
            background: #ffffff;
            border-radius: 8px;
            box-sizing: border-box;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #0f766e;
            padding-bottom: 4px;
            margin-bottom: 8px;
          }
          .header h1 {
            margin: 0;
            color: #0f766e;
            font-size: 18px;
            font-weight: 800;
            letter-spacing: -0.5px;
          }
          .header h2 {
            margin: 2px 0 0 0;
            color: #475569;
            font-size: 11.5px;
            font-weight: 600;
          }
          .badge {
            background-color: #0f766e;
            color: #ffffff;
            display: inline-block;
            font-weight: bold;
            font-size: 8.5px;
            padding: 1px 8px;
            border-radius: 3px;
            margin-bottom: 3px;
            text-transform: uppercase;
            letter-spacing: 1.2px;
          }
          .grid-info-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 12px 6px;
            margin-bottom: 8px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 6px;
          }
          .info-item {
            font-size: 11px;
          }
          .info-label {
            font-weight: bold;
            color: #0f766e;
            margin-bottom: 1px;
            display: block;
          }
          .info-value {
            color: #334155;
            font-weight: 500;
          }
          .section-title {
            font-size: 11.5px;
            font-weight: 700;
            color: #0f766e;
            border-right: 4px solid #f97316;
            padding-right: 8px;
            margin-top: 8px;
            margin-bottom: 4px;
          }
          html[dir="ltr"] .section-title {
            border-right: none;
            border-left: 4px solid #f97316;
            padding-left: 8px;
          }
          .content-box {
            background-color: #fafafa;
            border: 1px solid #f1f5f9;
            border-radius: 6px;
            padding: 5px 10px;
            font-size: 11px;
            color: #334155;
            min-height: 24px;
            white-space: pre-line;
            box-sizing: border-box;
          }
          .footer {
            margin-top: 8px;
            text-align: center;
            border-top: 1px dashed #cbd5e1;
            padding-top: 6px;
            page-break-inside: avoid;
          }
          .footer-watermark {
            font-size: 10.5px;
            color: #0f766e;
            font-weight: 700;
          }
          .footer-date {
            font-size: 9px;
            color: #94a3b8;
            margin-top: 1px;
          }
          .signature-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 12px 0px;
            margin-top: 12px;
            page-break-inside: avoid;
          }
          .sig-box {
            border-top: 1px solid #cbd5e1;
            padding-top: 4px;
            font-size: 11px;
            color: #64748b;
          }
          .stamp {
            border: 2px solid #0f766e;
            color: #0f766e;
            display: inline-block;
            padding: 3px 12px;
            font-weight: bold;
            border-radius: 4px;
            transform: rotate(-3deg);
            margin-top: 4px;
            font-size: 10px;
          }
          @media print {
            body {
              padding: 0;
              margin: 0;
            }
            .certificate-container {
              border: 4px double #0f766e;
              box-shadow: none;
              padding: 10px 14px;
            }
          }
        </style>
      </head>
      <body>
        <div class="certificate-container">
          <div style="text-align: center; margin-bottom: 6px;">
            <img src="/logo_nesma.png?v=2" style="height: 75px; object-fit: contain; display: inline-block;" referrerPolicy="no-referrer" />
          </div>
          <div style="text-align: center;">
            <div class="badge">N E S M A</div>
          </div>
          <div class="header">
            <h1>${isArabic ? 'شركة نسما الأولى لأنظمة السلامة' : 'Nesma First Safety Systems'}</h1>
            <h2>${visit.isEmergency ? (isArabic ? 'تقرير فحص وصيانة ومعالجة الأعطال (زيارة طارئة 🚨)' : 'Critical Safety Action Report (Emergency Visit 🚨)') : (isArabic ? 'تقرير الكتروني معتمد من شركة نسما الأولى لأنظمة السلامة' : 'Approved Electronic Safety Report by Nesma First Safety Systems')}</h2>
          </div>
          ${visit.isEmergency ? `
            <div style="text-align: center; margin-bottom: 12px; margin-top: 4px;">
              <span style="background-color: #dc2626; color: #ffffff; font-weight: 800; font-size: 11.5px; padding: 4px 14px; border-radius: 6px; display: inline-block; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #b91c1c;">
                🚨 ${isArabic ? 'تقرير زيارة طارئة وتدخل سريع' : 'EMERGENCY INTERVENTION REPORT'}
              </span>
            </div>
          ` : ''}
          
          <div class="section-title">${isArabic ? 'مـعـلومـات المـوقع والعمـيل' : 'Client & Location Metadata'}</div>
          
          <table class="grid-info-table">
            <tr>
              <td class="info-item" style="width: 50%; vertical-align: top;">
                <span class="info-label">${isArabic ? 'اسم المنشأة / العميل:' : 'Company / Client Name:'}</span>
                <span class="info-value">${clientName}</span>
              </td>
              <td class="info-item" style="width: 50%; vertical-align: top;">
                <span class="info-label">${isArabic ? 'اسم الفرع المعني:' : 'Concerned Branch Name:'}</span>
                <span class="info-value" style="font-weight: bold; color: #0f766e;">📍 ${branchName}</span>
              </td>
            </tr>
            <tr>
              <td class="info-item" style="width: 50%; vertical-align: top;">
                <span class="info-label">${isArabic ? 'رقم العقد المعتمد:' : 'Contract Reference Number:'}</span>
                <span class="info-value">${contractNo}</span>
              </td>
              <td class="info-item" style="width: 50%; vertical-align: top;">
                <span class="info-label">${isArabic ? 'تاريخ الكشف والتوثيق:' : 'Safety Inspection Date:'}</span>
                <span class="info-value">${date}</span>
              </td>
            </tr>
            <tr>
              <td class="info-item" style="width: 50%; vertical-align: top;">
                <span class="info-label">${isArabic ? 'موقع وعنوان الفرع:' : 'Branch Address:'}</span>
                <span class="info-value">${printLocationText}</span>
              </td>
              <td class="info-item" style="width: 50%; vertical-align: top;">
                <span class="info-label">${isArabic ? 'إحداثيات الموقع وخريطة الملاحة:' : 'GPS Location Link:'}</span>
                <span class="info-value">
                  ${printLocationUrl 
                    ? `<a href="${printLocationUrl}" target="_blank" style="color: #0f766e; font-weight: bold; text-decoration: underline;">${isArabic ? 'افتح على خرائط Google 🗺️' : 'View on Google Maps 🗺️'}</a>` 
                    : '---'}
                </span>
              </td>
            </tr>
            <tr>
              <td class="info-item" style="width: 50%; vertical-align: top;">
                <span class="info-label">${isArabic ? 'الفني والمهندس المسؤول:' : 'Safety Specialist Engineer:'}</span>
                <span class="info-value">${techName}</span>
              </td>
              <td class="info-item" style="width: 50%; vertical-align: top;">
                <span class="info-label">${isArabic ? 'حالة التقرير ومؤشر السلامة:' : 'Premises Evaluation Result:'}</span>
                <span class="info-value" style="color: ${visit.result === 'passed' ? '#10b981' : visit.result === 'has_defects' ? '#f59e0b' : '#ef4444'}; font-weight: bold;">
                  ${resultLabel}
                </span>
              </td>
            </tr>
            ${(!visit.isEmergency && visit.fireExtinguisherExpiry) ? `
              <tr>
                <td colspan="2" style="background-color: #fffbeb; padding: 6px 12px; border-radius: 4px; border: 1px solid #fef3c7; vertical-align: top;">
                  <span class="info-label" style="font-weight: bold; display: inline-block; margin-left: 6px;">🧯 ${isArabic ? 'صلاحية طفايات الحريق في المنشأة وقت الزيارة:' : 'Fire Extinguisher Expiry Date:'}</span>
                  <span class="info-value" style="font-family: monospace; font-weight: bold; color: #b45309;">${visit.fireExtinguisherExpiry}</span>
                </td>
              </tr>
            ` : ''}
          </table>
          
          ${visit.isEmergency && (visit.emergencyReason || visit.emergencySeverity) ? `
            <div class="section-title" style="border-right-color: #ef4444; border-left-color: #ef4444;">${isArabic ? 'بيانات البلاغ الطارئ' : 'Emergency Call Incident'}</div>
            <div class="content-box" style="border-right: 4px solid #ef4444; font-weight: bold; background-color: #fef2f2;">
              ${visit.emergencySeverity ? `
                <div style="margin-bottom: 6px; font-size: 13px; color: ${visit.emergencySeverity === 'critical_issues' ? '#b91c1c' : '#b45309'};">
                  <span>⚠️ ${isArabic ? 'حالة البلاغ:' : 'Severity Level:'} </span>
                  <span style="font-weight: 900;">${visit.emergencySeverity === 'critical_issues' ? (isArabic ? 'خطورة عالية' : 'Critical Issues') : (isArabic ? 'ملاحظات طفيفة' : 'Minor Notes')}</span>
                </div>
              ` : ''}
              ${visit.emergencyReason ? `<div>${visit.emergencyReason}</div>` : ''}
            </div>
          ` : ''}
          
          <div class="section-title">${isArabic ? 'حالة معدات وانظمة السلامة' : 'Safety Equipment & Network Status'}</div>
          <div class="content-box">
            ${notesText}
          </div>
          
          <div class="section-title">${isArabic ? 'قطع الغيار التالفة' : 'Damaged / Defective Spare Parts'}</div>
          <div class="content-box" style="${visit.result === 'passed' ? 'color: #94a3b8; font-style: italic;' : 'border-right: 4px solid #ef4444;'}">
            ${defectsText}
          </div>

          ${visit.supervisorNotes ? `
            <div class="section-title" style="border-right-color: #d97706; border-left-color: #d97706;">${isArabic ? 'ملاحظات المشرف العام' : 'General Supervisor Notes'}</div>
            <div class="content-box" style="border-right: 4px solid #d97706; background-color: #fffbeb; font-weight: bold; color: #78350f;">
              ${formatToBulletsHtml(visit.supervisorNotes, '')}
            </div>
          ` : ''}
          
          <table class="signature-table">
            <tr>
              <td class="sig-box" style="width: 33%; vertical-align: top; border: 1px solid #cbd5e1; background: #fafafa; border-radius: 8px; padding: 10px; text-align: center;">
                <strong>${isArabic ? 'توقيع المهندس الفني الميداني': 'Technical Engineer Signature'}</strong>
                <div style="margin-top: 15px; font-style: italic; color: #475569; font-weight: bold;">${techName}</div>
              </td>
              <td class="sig-box" style="width: 33%; vertical-align: top; border: 1px solid #cbd5e1; background: #fafafa; border-radius: 8px; padding: 10px; text-align: center;">
                <strong>${isArabic ? 'توقيع ممثل العميل (الميداني)': 'Client Representative Signature'}</strong>
                <div style="margin-top: 10px; text-align: center;">
                  ${visit.clientSignature ? `
                    <img src="${visit.clientSignature.url}" style="max-height: 48px; max-width: 140px; object-fit: contain; mix-blend-color-burn: multiply;" />
                    <div style="font-size: 8.5px; color: #334155; font-weight: bold; margin-top: 2px;">
                      ${visit.clientSignature.name} (${visit.clientSignature.signedAt})
                    </div>
                  ` : `
                    <div style="font-style: italic; color: #94a3b8; font-size: 9.5px; margin-top: 15px;">
                      ${isArabic ? 'لم يتم التوقيع ميدانياً' : 'No touch signature logged'}
                    </div>
                  `}
                </div>
              </td>
              <td class="sig-box" style="width: 33%; vertical-align: top; border: 1px solid #cbd5e1; background: #fafafa; border-radius: 8px; padding: 10px; text-align: center;">
                <strong>${isArabic ? 'تدقيق واعتماد قسم الصيانة': 'Maintenance Dept Audit & Approval'}</strong>
                <div style="margin-top: -5px; text-align: center;">
                  ${COMPANY_STAMP_SVG}
                </div>
              </td>
            </tr>
          </table>
          
          <div class="footer">
            <div class="footer-watermark">
              ${isArabic ? 'تقرير الكتروني معتمد من شركة نسما الأولى لأنظمة السلامة' : 'Approved Electronic Safety Report by Nesma First Safety Systems'}
            </div>
            <div class="footer-date">
              ${isArabic ? 'تاريخ طباعة وتصدير الوثيقة:' : 'Document Export Date:'} ${new Date().toLocaleDateString(isArabic ? 'ar-SA' : 'en-US')} | ID: ${visit.id}
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    
    printHtmlContent(html);
  };

  const handlePrint = () => {
    handleDownloadReport();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:bg-white print:p-0">
      <div 
        id="print-area"
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] print:shadow-none print:max-h-none print:rounded-none"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rose-50/10 bg-slate-900 text-white print:bg-white print:text-slate-900 print:border-b-2 print:border-slate-300">
          <div className="flex items-center gap-3">
            <img src="/logo_nesma.png?v=2" className="w-16 h-10 object-contain print:brightness-95" alt="Nesma First Logo" referrerPolicy="no-referrer" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-safety-orange text-white print:border print:border-slate-800 print:text-black">
                  {t.appName}
                </span>
                <h2 className="text-lg font-bold">{t.reportDetailsTitle}</h2>
                {visit.isEmergency && (
                  <span className="px-2 py-0.5 text-xs font-black rounded bg-red-650 bg-red-600 text-white border border-red-500 animate-pulse">
                    🚨 {isRtl ? 'زيارة طارئة' : 'Emergency Visit'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5 print:text-slate-500">{t.contractNumCol}: {visit.contractNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            {isAdmin && visit.status === 'completed' && onDeleteOrResetVisit && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const confirmReset = window.confirm(
                      isRtl 
                        ? 'هل أنت متأكد من رغبتك في تصفير التقرير الحالي للزيارة وإعادة جدولتها؟ سيؤدي ذلك إلى تحويلها لحالة معلقة ومسح كافة البيانات والملحقات المسجلة لهذا التقرير.' 
                        : 'Are you sure you want to reset this report and reschedule it? This will turn it back to pending and wipe all report details.'
                    );
                    if (confirmReset) {
                      onDeleteOrResetVisit(visit.id, 'reset');
                      if (onClose) onClose();
                    }
                  }}
                  className="p-1.5 px-3 rounded-xl transition-all font-semibold text-xs flex items-center gap-1.5 cursor-pointer bg-amber-600 hover:bg-amber-700 text-white shadow-sm border border-amber-500/30"
                  title={isRtl ? 'إعادة جدولة وتصفير التقرير الحالي' : 'Reschedule & Reset Report'}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'إعادة جدولة وتصفير التقرير' : 'Reset & Reschedule'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const confirmDelete = window.confirm(
                      isRtl 
                        ? 'هل أنت متأكد من رغبتك في حذف هذا التقرير وتاريخ الزيارة نهائياً من النظام؟ هذه العملية غير قابلة للتراجع.' 
                        : 'Are you sure you want to delete this report and visit history permanently? This is irreversible.'
                    );
                    if (confirmDelete) {
                      onDeleteOrResetVisit(visit.id, 'delete');
                      if (onClose) onClose();
                    }
                  }}
                  className="p-1.5 px-3 rounded-xl transition-all font-semibold text-xs flex items-center gap-1.5 cursor-pointer bg-red-600 hover:bg-red-700 text-white shadow-sm border border-red-500/30"
                  title={isRtl ? 'حذف التقرير والزيارة نهائياً' : 'Delete Visit Permanently'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'حذف التقارير نهائياً' : 'Delete'}</span>
                </button>
              </>
            )}
            {isAdmin && (
              <button
                id="admin-edit-visit-btn"
                onClick={() => setIsEditing(!isEditing)}
                className={`p-1.5 px-3 rounded-xl transition-all font-semibold text-xs flex items-center gap-1.5 cursor-pointer ${
                  isEditing 
                    ? 'bg-rose-600 hover:bg-rose-705 text-white' 
                    : 'bg-teal-650 hover:bg-teal-850 text-white'
                }`}
              >
                <Edit className="w-3.5 h-3.5" />
                <span>{isEditing ? (isRtl ? 'إلغاء التعديل' : 'Cancel Edit') : (isRtl ? 'تعديل التقرير' : 'Edit Report')}</span>
              </button>
            )}
            <button 
              id="close-modal-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-slate-400 hover:text-white print:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={handleSaveChangesSubmit} className="flex-1 overflow-y-auto flex flex-col min-h-0 bg-slate-50 text-start">
            <div className={`p-6 space-y-5 flex-1 ${isRtl ? 'text-right' : 'text-left'}`}>
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 text-amber-900 text-xs leading-relaxed flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">{isRtl ? 'وضع تدقيق وبث التقارير (مسئول الفنيين والنشاط)' : 'Inspection Oversight & Report Audit (Admin Mode)'}</p>
                  <p className="mt-1 opacity-90 text-[11px]">
                    {isRtl 
                      ? 'أنت تعدل كمسئول عام على بيانات فحص وسلامة منشأة العميل. التعديل يشمل تحديث حالة الأنظمة، كشف الأعطال وصيانة قطع الغيار، وإعادة توجيه الزيارة لفني آخر.' 
                      : 'You are modifying the core visit files and safety records. All changes will replicate instantly to the client dashboard and PDF certificates.'}
                  </p>
                </div>
              </div>

              {/* Status & Result Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-start">
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    {isRtl ? 'حالة الزيارة' : 'Visit Status'}
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as VisitStatus)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-safety-emerald cursor-pointer"
                  >
                    <option value="pending">{isRtl ? 'مجدولة وبانتظار الفني (معلقة)' : 'Pending / Scheduled'}</option>
                    <option value="completed">{isRtl ? 'مكتملة وموثقة بالكامل' : 'Completed & Closed'}</option>
                  </select>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-start">
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    {isRtl ? 'تصنيف نتيجة فحص السلامة' : 'Safety Evaluation Result'}
                  </label>
                  <select
                    value={editResult}
                    onChange={(e) => setEditResult(e.target.value as VisitResult)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-safety-emerald cursor-pointer"
                  >
                    <option value="passed">{isRtl ? 'أنظمة سليمة ومطابقة تماماً' : 'Passed & Verified ✔'}</option>
                    <option value="has_defects">{isRtl ? 'يوجد ملاحظات أو أعطال بسيطة' : 'Minor Defects ⚠'}</option>
                    <option value="critical_issues">{isRtl ? 'أعطال حرجة وخطورة عالية!' : 'CRITICAL ISSUES ❌'}</option>
                    <option value="not_visited">{isRtl ? 'لم يتم الفحص بعد' : 'Not Visited yet'}</option>
                  </select>
                </div>
              </div>

              {/* Dates & Assigned Tech */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-start">
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    {isRtl ? 'تاريخ الزيارة المجدول' : 'Scheduled Visit Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={editScheduledDate}
                    onChange={(e) => setEditScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono focus:outline-none focus:border-safety-emerald"
                  />
                </div>

                {editStatus === 'completed' && (
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-start animate-fade-in">
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      {isRtl ? 'تاريخ الإتمام والتوثيق' : 'Completion Date'}
                    </label>
                    <input
                      type="date"
                      required
                      value={editCompletedDate}
                      onChange={(e) => setEditCompletedDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono focus:outline-none focus:border-safety-emerald"
                    />
                  </div>
                )}
              </div>

              {/* Technician selection */}
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-start">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  {isRtl ? 'تعديل الفني المكلف والمؤهل' : 'Modify Assigned Technician Specialist'}
                </label>
                <select
                  value={editTechnicianId}
                  onChange={(e) => setEditTechnicianId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-safety-emerald cursor-pointer"
                >
                  <option value="">{isRtl ? '-- اختر فنياً من المسجلين --' : '-- Choose technician --'}</option>
                  {technicians.map(tech => (
                    <option key={tech.id} value={tech.id}>{tech.name} ({tech.phone})</option>
                  ))}
                </select>
              </div>

              {/* Fire Extinguisher Expiry Date */}
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-start animate-fade-in">
                <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center gap-1">
                  🧯 {isRtl ? 'تعديل تاريخ صلاحية طفايات الحريق للزيارة' : 'Edit Fire Extinguisher Expiry Date'}
                </label>
                <input
                  type="date"
                  value={editFireExtinguisherExpiry}
                  onChange={(e) => setEditFireExtinguisherExpiry(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono focus:outline-none focus:border-safety-emerald"
                />
              </div>

              {/* Report notes */}
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-start">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  {isRtl ? 'الملاحظات والتقرير الفني العام لمعدات السلامة' : 'General Technical Audit Notes'}
                </label>
                <textarea
                  rows={3}
                  placeholder={isRtl ? 'اكتب ملاحظات الفحص والتشغيل ومطابقة الأنظمة بالمنشأة...' : 'Record system operability notes, fire safety conformity...'}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-safety-emerald text-slate-800 leading-relaxed"
                />
              </div>

              {/* Defects description */}
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-start">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  {isRtl ? 'بيان قطع الغيار التالفة وكشف نواقص الأمن والسلامة' : 'Defected or Broken Safety Equipment List'}
                </label>
                <textarea
                  rows={3}
                  placeholder={isRtl ? 'اكتب كشفاً بالأعطال المكتشفة أو قطع الغيار المستهدفة بالتغيير مثل مؤشر الصمام، خراطيم طفايات...' : 'Detail defected items requiring immediate swap...'}
                  value={editDefects}
                  onChange={(e) => setEditDefects(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-safety-emerald text-slate-800 leading-relaxed"
                />
              </div>

              {/* Supervisor Notes Field - Only visible in Super Admin account when editing */}
              {isAdmin && (
                <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 shadow-sm text-start space-y-1.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <span className="text-sm">👔</span>
                      {isRtl ? 'ملاحظات المشرف العام' : 'General Supervisor Notes'}
                    </label>
                    <span className="text-[10px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                      {isRtl ? 'خاص بحساب المشرف العام' : 'Super Admin Only'}
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    placeholder={isRtl ? 'أدخل ملاحظاتك كمشرف عام بعد إنجاز المهمة المكلف بها الفني للزيارة الطارئة...' : 'Enter general supervisor notes and directions after technical completion...'}
                    value={editSupervisorNotes}
                    onChange={(e) => setEditSupervisorNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-lg focus:outline-none focus:border-amber-500 text-amber-950 leading-relaxed font-sans"
                  />
                </div>
              )}

              {/* Attachments (Images & Videos) Editor for Admin */}
              <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm text-start space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <span>🖼️</span>
                    {isRtl ? 'الصور ومقاطع الفيديو المرفقة بالتقرير' : 'Attached Photos & Videos'}
                  </h4>
                  <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-mono text-slate-500 font-bold">
                    {editAttachments.length} {isRtl ? 'ملفات' : 'files'}
                  </span>
                </div>

                {/* Current Attachments List with Delete button */}
                {editAttachments.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {editAttachments.map((file, idx) => (
                      <div key={file.id || idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 animate-fade-in">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-1.5 rounded-lg bg-white shadow-sm shrink-0">
                            {file.type === 'image' && <Image className="w-4 h-4 text-emerald-600" />}
                            {file.type === 'video' && <Video className="w-4 h-4 text-amber-600" />}
                            {file.type === 'pdf' && <FileText className="w-4 h-4 text-rose-650" />}
                          </div>
                          <div className="min-w-0">
                            <span className="text-[11px] font-semibold text-slate-700 truncate block" title={file.name}>
                              {file.name}
                            </span>
                            <span className="text-[9px] text-slate-400 capitalize font-mono block">
                              {file.type}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(isRtl ? 'هل تريد حذف هذا المرفق نهائياً من التقرير؟' : 'Are you sure you want to delete this attachment from the report?')) {
                              setEditAttachments(prev => prev.filter(item => item.id !== file.id));
                            }
                          }}
                          className="p-1.5 text-rose-600 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                          title={isRtl ? 'حذف هذا الملف' : 'Delete file'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <span className="text-2xl block mb-1">📁</span>
                    <span className="text-[11px] text-slate-400 block font-medium">
                      {isRtl ? 'لا توجد صور، فيديوهات أو مستندات مرفقة بهذا التقرير حالياً.' : 'No photos, videos, or documents attached yet.'}
                    </span>
                  </div>
                )}

                {/* File Upload Selector Block */}
                <div className="pt-3 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-800 block mb-2">
                    {isRtl ? 'إضافة مرفق جديد (صورة، فيديو، أو مستند PDF)' : 'Add New Attachment (Photo, Video, or PDF Document)'}
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    {/* Add Image File Button */}
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                        onChange={(e) => handleFormFileUpload(e, 'image')}
                        disabled={uploadProgress}
                      />
                      <div className="input-file-trigger p-3 border border-dashed border-emerald-300 bg-emerald-50/30 hover:bg-emerald-50 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition text-emerald-800 text-xs font-bold select-none">
                        <span>🖼️</span>
                        <span>{uploadProgress ? (isRtl ? 'جاري الرفع والتحميل...' : 'Uploading Image...') : (isRtl ? 'رفع صورة جديدة' : 'Upload New Photo')}</span>
                      </div>
                    </div>

                    {/* Add Video File Button */}
                    <div className="relative">
                      <input
                        type="file"
                        accept="video/*"
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                        onChange={(e) => handleFormFileUpload(e, 'video')}
                        disabled={uploadProgress}
                      />
                      <div className="input-file-trigger p-3 border border-dashed border-amber-300 bg-amber-50/30 hover:bg-amber-50 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition text-amber-800 text-xs font-bold select-none">
                        <span>📹</span>
                        <span>{uploadProgress ? (isRtl ? 'جاري الرفع والتحميل...' : 'Uploading Video...') : (isRtl ? 'رفع فيديو جديد' : 'Upload New Video')}</span>
                      </div>
                    </div>

                    {/* Add PDF/Document File Button */}
                    <div className="relative">
                      <input
                        type="file"
                        accept=".pdf"
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                        onChange={(e) => handleFormFileUpload(e, 'pdf')}
                        disabled={uploadProgress}
                      />
                      <div className="input-file-trigger p-3 border border-dashed border-rose-300 bg-rose-50/30 hover:bg-rose-50 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition text-rose-800 text-xs font-bold select-none">
                        <span>📄</span>
                        <span>{uploadProgress ? (isRtl ? 'جاري الرفع والتحميل...' : 'Uploading Document...') : (isRtl ? 'رفع تقرير ورقي (PDF)' : 'Upload PDF Document')}</span>
                      </div>
                    </div>
                  </div>
                  
                  {uploadProgress && (
                    <div className="mt-3 p-2.5 bg-slate-150 bg-slate-100 rounded-lg text-[10px] text-slate-650 font-bold flex items-center gap-2 animate-pulse justify-center">
                      <span className="w-2.5 h-2.5 rounded-full bg-safety-orange animate-ping"></span>
                      <span>{isRtl ? 'جاري معالجة ورفع الملف على الخادم...' : 'Processing and uploading file to server...'}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Form options */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-100 flex items-center justify-end gap-2.5 shrink-0 print:hidden text-start">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                {t.cancelBtn}
              </button>
              
              <button
                type="submit"
                className="px-5 py-2 bg-safety-emerald hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isRtl ? 'حفظ تعديلات التقرير والأنظمة' : 'Save Inspections Report Details'}</span>
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Content */}
            <div className={`p-6 overflow-y-auto space-y-6 flex-1 ${isRtl ? 'text-right' : 'text-left'}`}>
              
              {/* Emergency Banner */}
              {visit.isEmergency && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between text-start">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl animate-bounce">🚨</span>
                    <div>
                      <h4 className="font-extrabold text-red-900 text-xs sm:text-sm">{isRtl ? 'تقرير زيارة طارئة وتدخل سريع' : 'Emergency Call-out Intervention Report'}</h4>
                      <p className="text-[10px] sm:text-[11px] text-red-750 mt-1 max-w-md leading-relaxed">{isRtl ? 'هذا التقرير يوثق الاستجابة العاجلة للبلاغ الطارئ ومعالجة الأعطال الطارئة خارج نطاق خطة الزيارات الدورية.' : 'This report is recorded specifically for immediate response and emergency troubleshooting.'}</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 text-[10px] bg-red-600 text-white font-black rounded-lg uppercase shrink-0">
                    {isRtl ? 'زيارة طارئة' : 'Emergency'}
                  </span>
                </div>
              )}
              
              {/* Status Panel for printing */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="text-xs text-slate-500 block mb-1">{t.visitStatusLabel}</span>
                  {visit.status === 'completed' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-100 text-emerald-800">
                      {t.visitCompleted}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-805 animate-pulse">
                      {t.visitScheduledWaiting}
                    </span>
                  )}
                </div>
                
                {visit.status === 'completed' && (
                  <div>
                    <span className="text-xs text-slate-500 block mb-1">{t.siteSafetyRating}</span>
                    {getResultBadge(visit.result)}
                  </div>
                )}
                
                <div>
                  <span className="text-xs text-slate-500 block mb-1">{t.visitDateLabel}</span>
                  <div className="flex items-center gap-1.5 text-slate-700 font-mono text-sm">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {visit.completedDate || visit.scheduledDate}
                  </div>
                </div>

                {(!visit.isEmergency && visit.fireExtinguisherExpiry) && (
                  <div>
                    <span className="text-xs text-slate-500 block mb-1">🧯 {isRtl ? 'صلاحية طفايات الحريق' : 'Fire Extinguisher Expiry'}</span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-805 border border-amber-200">
                      {visit.fireExtinguisherExpiry}
                    </span>
                  </div>
                )}
              </div>

              {/* Client Info Grid */}
              <div>
                <h3 className={`text-sm font-bold text-slate-900 border-safety-emerald mb-3 ${isRtl ? 'border-r-4 pr-2' : 'border-l-4 pl-2'}`}>{t.clientAndLocationDetails}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-xs text-slate-500 block">{t.clientNameCol}</span>
                    <span className="font-semibold text-slate-800 block mt-1">
                      {dt(visit.clientName)}
                      {visit.branchName && (
                        <span className="inline-block bg-teal-50 border border-teal-100 text-teal-800 text-[11px] font-sans font-bold px-2 py-0.5 rounded ml-2 mr-2">
                          📍 {dt(visit.branchName)}
                        </span>
                      )}
                    </span>
                  </div>
                  
                  <div>
                    <span className="text-xs text-slate-500 block">{t.clientPhoneLabel}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span className="font-mono text-slate-800">{client?.phone || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <span className="text-xs text-slate-500 block">{t.clientLocationLabel}</span>
                    <div className="flex items-start gap-1.5 mt-1">
                      <MapPin className="w-4 h-4 text-safety-orange shrink-0 mt-0.5" />
                      <div>
                        <span className="text-slate-700">{dt(displayLocationText)}</span>
                        {displayLocationUrl && (
                          <a 
                            id="loc-link"
                            href={displayLocationUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className={`text-xs text-teal-600 hover:underline font-medium print:hidden ${isRtl ? 'mr-2' : 'ml-2'}`}
                          >
                            {t.showMapLink}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Emergency Reason & Severity if applicable */}
              {visit.isEmergency && (visit.emergencyReason || visit.emergencySeverity) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-sm font-bold text-slate-900 border-red-600 ${isRtl ? 'border-r-4 pr-2' : 'border-l-4 pl-2'}`}>
                      🚨 {isRtl ? 'بيانات البلاغ الطارئ' : 'Reported Emergency Incident'}
                    </h3>
                    {visit.emergencySeverity && (
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-lg border ${
                        visit.emergencySeverity === 'critical_issues'
                          ? 'bg-rose-100 border-rose-300 text-rose-800'
                          : 'bg-amber-100 border-amber-300 text-amber-800'
                      }`}>
                        ⚠️ {isRtl ? 'حالة البلاغ:' : 'Severity:'} {visit.emergencySeverity === 'critical_issues' 
                          ? (isRtl ? 'خطورة عالية' : 'Critical Issues') 
                          : (isRtl ? 'ملاحظات طفيفة' : 'Minor Notes')}
                      </span>
                    )}
                  </div>
                  {visit.emergencyReason && (
                    <div className="p-4 bg-red-50/50 border border-red-100 rounded-xl text-xs font-black text-slate-800 leading-relaxed text-start">
                      {dt(visit.emergencyReason)}
                    </div>
                  )}
                </div>
              )}

              {/* Technician Info */}
              <div>
                <h3 className={`text-sm font-bold text-slate-900 border-safety-emerald mb-3 ${isRtl ? 'border-r-4 pr-2' : 'border-l-4 pl-2'}`}>{t.techAssignedCol}</h3>
                <div className="flex items-center gap-3 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold border border-white shadow-sm shrink-0">
                    <User className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800 block">{dt(visit.technicianName)}</span>
                    <span className="text-xs text-slate-500 block">{t.safetySpecialist}</span>
                  </div>
                </div>
              </div>

              {/* Notes and Defects Section */}
              {visit.status === 'completed' && (
                <div className="space-y-4">
                  <div>
                    <h3 className={`text-sm font-bold text-slate-900 border-safety-emerald mb-2 ${isRtl ? 'border-r-4 pr-2' : 'border-l-4 pl-2'}`}>
                      {isRtl ? 'حالة معدات وانظمة السلامة' : t.inspectionNotesLabel}
                    </h3>
                    <div className="p-4 bg-slate-50 rounded-xl text-slate-700 min-h-[60px] leading-relaxed">
                      {renderLinesAsBullets(visit.notes, isRtl ? 'لا توجد ملاحظات مسجلة' : t.noGeneralNotes)}
                    </div>
                  </div>

                  <div>
                    <h3 className={`text-sm font-bold text-slate-900 border-rose-600 mb-2 ${isRtl ? 'border-r-4 pr-2' : 'border-l-4 pl-2'}`}>
                      {isRtl ? 'قطع الغيار التالفة' : t.defectsAndIssuesLabel}
                    </h3>
                    <div className="p-4 bg-rose-50/50 text-slate-700 rounded-xl border border-rose-100 min-h-[60px] leading-relaxed">
                      {visit.defects ? (
                        <div className="flex gap-2 text-rose-800">
                          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                          <div className="w-full">
                            {renderLinesAsBullets(visit.defects, isRtl ? 'لا توجد قطع تالفة أو أعطال مسجلة' : t.noDefectsFound, true)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic text-xs">{t.noDefectsFound}</span>
                      )}
                    </div>
                  </div>

                  {visit.supervisorNotes && (
                    <div>
                      <h3 className={`text-sm font-bold text-slate-900 border-amber-600 mb-2 ${isRtl ? 'border-r-4 pr-2' : 'border-l-4 pl-2'}`}>
                        {isRtl ? 'ملاحظات المشرف العام' : 'General Supervisor Notes'}
                      </h3>
                      <div className="p-4 bg-amber-50/50 text-amber-950 rounded-xl border border-amber-200 min-h-[60px] leading-relaxed">
                        <div className="flex gap-2">
                          <span className="text-base shrink-0 mt-0.5">👔</span>
                          <div className="w-full">
                            {renderLinesAsBullets(visit.supervisorNotes, isRtl ? 'لا توجد ملاحظات للمشرف العام' : 'No supervisor notes')}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Signatures & Approvals Section */}
                  <div className="pt-4 border-t border-slate-100">
                    <h3 className={`text-sm font-bold text-slate-900 border-safety-emerald mb-3 ${isRtl ? 'border-r-4 pr-2' : 'border-l-4 pl-2'}`}>
                      {isRtl ? 'التواقيع والاعتمادات الرسمية' : 'Official Signatures & Approvals'}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Tech Signature */}
                      <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center min-h-[140px]">
                        <span className="text-[11px] font-bold text-slate-500 block mb-2">
                          {isRtl ? 'توقيع المهندس الفني الميداني' : 'Technical Engineer Signature'}
                        </span>
                        <div className="font-serif italic text-lg text-slate-700 tracking-wider font-semibold">
                          {dt(visit.technicianName)}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                          {isRtl ? 'معتمد عبر النظام' : 'Verified Digitally'}
                        </span>
                      </div>

                      {/* Client Signature */}
                      <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center min-h-[140px]">
                        <span className="text-[11px] font-bold text-slate-700 block mb-2">
                          {isRtl ? 'توقيع ممثل العميل فوري' : 'Client Representative Sign'}
                        </span>
                        {visit.clientSignature ? (
                          <div className="flex flex-col items-center justify-center">
                            <img 
                              src={visit.clientSignature.url} 
                              alt="Client Signature" 
                              className="max-h-[55px] object-contain mb-1.5 mix-blend-multiply" 
                              referrerPolicy="no-referrer"
                            />
                            <span className="text-[11px] font-bold text-slate-800 leading-tight truncate max-w-[150px]" title={visit.clientSignature.name}>
                              {visit.clientSignature.name}
                            </span>
                            <span className="text-[9px] text-slate-500 block font-mono mt-0.5">
                              {visit.clientSignature.signedAt}
                            </span>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 italic">
                            {isRtl ? 'بانتظار توقيع ممثل العميل' : 'Awaiting client signature'}
                          </div>
                        )}
                      </div>

                      {/* Maintenance Dept Audit & Approval */}
                      <div className="p-4 bg-rose-50/5 rounded-xl border border-rose-100/50 flex flex-col items-center justify-center text-center min-h-[140px]">
                        <span className="text-[11px] font-bold text-slate-705 text-slate-700 block mb-2">
                          {isRtl ? 'تدقيق واعتماد قسم الصيانة' : 'Maintenance Dept Audit & Approval'}
                        </span>
                        <div className="flex items-center justify-center mt-1" dangerouslySetInnerHTML={{ __html: COMPANY_STAMP_SVG.replace('width="235"', 'width="180"').replace('height="90"', 'height="69"') }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Attachments Section */}
                  {visit.attachments && visit.attachments.length > 0 && (
                    <div className="pt-6 border-t border-slate-100">
                      <h3 className={`text-sm font-bold text-slate-900 border-safety-emerald mb-4 print:hidden ${isRtl ? 'border-r-4 pr-2' : 'border-l-4 pl-2'}`}>
                        {t.attachmentsSectionTitle}
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">
                        {visit.attachments.map((file) => (
                          <div key={file.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between gap-3 text-start animate-fade-in">
                            <div className="flex items-start gap-2.5">
                              <div className="p-2 rounded-lg bg-white shadow-sm shrink-0">
                                {file.type === 'image' && <Image className="w-5 h-5 text-emerald-600" />}
                                {file.type === 'video' && <Video className="w-5 h-5 text-amber-600" />}
                                {file.type === 'pdf' && <FileText className="w-5 h-5 text-red-650" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="text-xs text-slate-400 font-mono block">{t.fileType} {file.type.toUpperCase()}</span>
                                <span className="text-xs font-semibold text-slate-700 truncate block mt-0.5" title={file.name}>
                                  {file.name}
                                </span>
                              </div>
                            </div>

                            {/* Media Preview inside Modal */}
                            {file.type === 'image' && (
                              <div 
                                className="relative w-full h-44 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shadow-sm cursor-pointer group"
                                onClick={() => {
                                  const imgUrl = file.url.startsWith('#') ? 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&q=80&w=300' : file.url;
                                  setLocalPreviewUrl(imgUrl);
                                  setLocalPreviewName(file.name);
                                }}
                              >
                                <img 
                                  src={file.url.startsWith('#') ? 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&q=80&w=300' : file.url} 
                                  alt={file.name} 
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition duration-200 flex items-center justify-center text-white text-xs font-bold gap-1 shadow-inner">
                                  <span>🔍</span>
                                  <span>{isRtl ? 'تكبير الصورة' : 'Expand Image'}</span>
                                </div>
                              </div>
                            )}

                            {file.type === 'video' && (
                              <div className="relative w-full h-48 rounded-xl bg-slate-105 bg-slate-950 flex flex-col justify-center items-center text-slate-400 overflow-hidden border border-slate-800 shadow-inner">
                                <video 
                                  src={(file.url.startsWith('#') || !file.url) ? 'https://www.w3schools.com/html/mov_bbb.mp4' : (file.url.startsWith('http') ? file.url : `${window.location.origin}${file.url}`)} 
                                  controls 
                                  playsInline
                                  preload="metadata"
                                  className="w-full h-full object-contain bg-black" 
                                />
                              </div>
                            )}

                            {file.type === 'pdf' && (
                              <div className="p-3 bg-red-50/50 rounded-lg border border-red-105 border-red-100 flex items-center justify-between">
                                <span className="text-xs text-red-900 font-medium font-mono truncate max-w-[200px] sm:max-w-xs">{file.name}</span>
                                <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-800 rounded font-semibold">PDF</span>
                              </div>
                            )}

                            <div className="flex gap-2 justify-end mt-1">
                              {file.type === 'video' && (
                                <a 
                                  href={(file.url.startsWith('#') || !file.url) ? 'https://www.w3schools.com/html/mov_bbb.mp4' : (file.url.startsWith('http') ? file.url : `${window.location.origin}${file.url}`)} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs text-sky-700 hover:text-sky-900 font-bold px-3 py-1.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors shadow-sm cursor-pointer"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-sky-600" />
                                  {isRtl ? 'مشاهدة في صفحة خارجية' : 'Watch in Tab'}
                                </a>
                              )}

                              {file.type === 'pdf' && (
                                <a 
                                  href={file.url.startsWith('#') ? '#' : (file.url.startsWith('http') ? file.url : `${window.location.origin}${file.url}`)} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs text-sky-700 hover:text-sky-900 font-bold px-3 py-1.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors shadow-sm cursor-pointer"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-sky-600" />
                                  {isRtl ? 'فتح وقراءة المستند' : 'Open Document'}
                                </a>
                              )}

                              <button 
                                type="button"
                                id={`download-${file.id}`}
                                onClick={(e) => {
                                  if (file.url.startsWith('#')) {
                                    e.preventDefault();
                                    handleDownloadReport();
                                  } else {
                                    const link = document.createElement('a');
                                    link.href = file.url;
                                    link.download = file.name;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 text-xs text-teal-700 hover:text-teal-900 font-bold px-3 py-1.5 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors shadow-sm cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5 text-teal-600" />
                                {t.downloadFile}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

              {/* Internal Code or Watermark */}
              <div className="hidden print:block pt-12 text-center text-[10px] text-slate-400 border-t border-slate-200">
                {t.printCertificateWatermark.replace('{date}', new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US'))}
              </div>
            </div>

            {/* Footer actions */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between print:hidden shrink-0">
              <div className="flex items-center gap-2">
                <button 
                  id="print-btn"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  {t.printReportBtn}
                </button>

                <button 
                  id="download-full-doc-btn"
                  onClick={handleDownloadReport}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-safety-emerald hover:bg-teal-900 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{isRtl ? 'تنزيل وثيقة التقرير' : 'Download Safety Doc'}</span>
                </button>
              </div>
              
              <button 
                id="close-footer-btn"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                {t.closeBtn}
              </button>
            </div>
          </>
        )}
      </div>
    </div>

      {/* Image Preview Overlay Modal */}
      {localPreviewUrl && (
        <div 
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in"
          onClick={() => setLocalPreviewUrl(null)}
        >
          <div 
            className="relative bg-white dark:bg-slate-900 rounded-3xl p-3 shadow-2xl max-w-4xl max-h-[90vh] flex flex-col items-center overflow-hidden border border-slate-700/30 text-center"
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
    </>
  );
}
