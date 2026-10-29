import React, { useState } from 'react';
import { X, Palette, Type, Sliders, FileText, Building2, Shield, Plus, Trash2, Edit3, Check, RefreshCw, Eye } from 'lucide-react';
import { SystemCustomization, CustomPage } from '../types';

interface SuperAdminControlCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRtl: boolean;
  customization: SystemCustomization;
  onSaveCustomization: (newCustomization: SystemCustomization) => void;
  adminName: string;
  adminUsername: string;
  adminPassword: string;
  onUpdateAdminProfile: (name: string, user: string, pass: string) => void;
  maintenanceModeEnabled: boolean;
  onUpdateMaintenanceMode: (enabled: boolean) => void;
}

export const SuperAdminControlCenterModal: React.FC<SuperAdminControlCenterModalProps> = ({
  isOpen,
  onClose,
  isRtl,
  customization,
  onSaveCustomization,
  adminName,
  adminUsername,
  adminPassword,
  onUpdateAdminProfile,
  maintenanceModeEnabled,
  onUpdateMaintenanceMode,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'theme' | 'labels' | 'modules' | 'pages' | 'print' | 'company'>('theme');

  // Form local state initialized with current customization values
  const [primaryColor, setPrimaryColor] = useState(customization.primaryColor || '#0f766e');
  const [headerBgColor, setHeaderBgColor] = useState(customization.headerBgColor || '#0f172a');
  
  const [companyName, setCompanyName] = useState(customization.companyName || 'شركة نسما الأولى لأنظمة السلامة');
  const [unifiedNumber, setUnifiedNumber] = useState(customization.unifiedNumber || '7003489890');
  const [companyPhone, setCompanyPhone] = useState(customization.companyPhone || '0533310442');
  const [companyEmail, setCompanyEmail] = useState(customization.companyEmail || 'info@nesmaasafety.com');
  const [companyTaxNumber, setCompanyTaxNumber] = useState(customization.companyTaxNumber || '310245689100003');
  const [companyAddress, setCompanyAddress] = useState(customization.companyAddress || 'الرياض - حي الملز - شارع صلاح الدين الأيوبي');

  // Custom Tab Labels
  const [overviewTabTitle, setOverviewTabTitle] = useState(customization.overviewTabTitle || '');
  const [clientsTabTitle, setClientsTabTitle] = useState(customization.clientsTabTitle || '');
  const [emergencyTabTitle, setEmergencyTabTitle] = useState(customization.emergencyTabTitle || '');
  const [quotesTabTitle, setQuotesTabTitle] = useState(customization.quotesTabTitle || '');
  const [workOrdersTabTitle, setWorkOrdersTabTitle] = useState(customization.workOrdersTabTitle || '');
  const [extinguishersTabTitle, setExtinguishersTabTitle] = useState(customization.extinguishersTabTitle || '');
  const [reportsArchiveTabTitle, setReportsArchiveTabTitle] = useState(customization.reportsArchiveTabTitle || '');
  const [techniciansTabTitle, setTechniciansTabTitle] = useState(customization.techniciansTabTitle || '');
  const [smsTabTitle, setSmsTabTitle] = useState(customization.smsTabTitle || '');

  // Print Footer Note
  const [printFooterNote, setPrintFooterNote] = useState(customization.printFooterNote || '');

  // Feature Toggles
  const [enableQuotesModule, setEnableQuotesModule] = useState(customization.enableQuotesModule ?? true);
  const [enableWorkOrdersModule, setEnableWorkOrdersModule] = useState(customization.enableWorkOrdersModule ?? true);
  const [enableExtinguishersModule, setEnableExtinguishersModule] = useState(customization.enableExtinguishersModule ?? true);
  const [enableEmergencyModule, setEnableEmergencyModule] = useState(customization.enableEmergencyModule ?? true);
  const [enableSmsModule, setEnableSmsModule] = useState(customization.enableSmsModule ?? true);
  const [enableClientInquiries, setEnableClientInquiries] = useState(customization.enableClientInquiries ?? true);

  // Custom Dynamic Pages State
  const [customPages, setCustomPages] = useState<CustomPage[]>(customization.customPages || []);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState('');
  const [pageIcon, setPageIcon] = useState('📜');
  const [pageContent, setPageContent] = useState('');
  const [pageAudience, setPageAudience] = useState<'all' | 'admin' | 'clients' | 'technicians'>('all');
  const [showPageForm, setShowPageForm] = useState(false);

  // Super Admin Credentials
  const [adminEditName, setAdminEditName] = useState(adminName);
  const [adminEditUsername, setAdminEditUsername] = useState(adminUsername);
  const [adminEditPassword, setAdminEditPassword] = useState(adminPassword);

  if (!isOpen) return null;

  // Preset Color Palette handler
  const applyPresetColor = (primary: string, header: string) => {
    setPrimaryColor(primary);
    setHeaderBgColor(header);
  };

  const handleResetColors = () => {
    setPrimaryColor('#0f766e');
    setHeaderBgColor('#0f172a');
  };

  const handleResetLabels = () => {
    setOverviewTabTitle('');
    setClientsTabTitle('');
    setEmergencyTabTitle('');
    setQuotesTabTitle('');
    setWorkOrdersTabTitle('');
    setExtinguishersTabTitle('');
    setReportsArchiveTabTitle('');
    setTechniciansTabTitle('');
    setSmsTabTitle('');
  };

  // Custom Page Management
  const handleSavePage = () => {
    if (!pageTitle.trim() || !pageContent.trim()) {
      alert(isRtl ? 'يرجى كتابة عنوان الصفحة والمحتوى المطلوب!' : 'Please enter page title and content!');
      return;
    }

    if (editingPageId) {
      setCustomPages(prev => prev.map(p => p.id === editingPageId ? {
        ...p,
        title: pageTitle.trim(),
        icon: pageIcon.trim() || '📜',
        content: pageContent.trim(),
        targetAudience: pageAudience,
      } : p));
    } else {
      const newPage: CustomPage = {
        id: 'page_' + Date.now(),
        title: pageTitle.trim(),
        icon: pageIcon.trim() || '📜',
        content: pageContent.trim(),
        targetAudience: pageAudience,
        createdAt: new Date().toISOString().split('T')[0],
        enabled: true,
      };
      setCustomPages(prev => [...prev, newPage]);
    }

    setEditingPageId(null);
    setPageTitle('');
    setPageIcon('📜');
    setPageContent('');
    setPageAudience('all');
    setShowPageForm(false);
  };

  const handleEditPage = (page: CustomPage) => {
    setEditingPageId(page.id);
    setPageTitle(page.title);
    setPageIcon(page.icon);
    setPageContent(page.content);
    setPageAudience(page.targetAudience);
    setShowPageForm(true);
  };

  const handleDeletePage = (id: string) => {
    if (confirm(isRtl ? 'هل أنت تأكد من حذف هذه الصفحة المخصصة؟' : 'Are you sure you want to delete this custom page?')) {
      setCustomPages(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleTogglePage = (id: string) => {
    setCustomPages(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  const handleSaveAllCustomizations = (e: React.FormEvent) => {
    e.preventDefault();

    const updatedCustomization: SystemCustomization = {
      primaryColor,
      headerBgColor,
      companyName: companyName.trim(),
      unifiedNumber: unifiedNumber.trim(),
      companyPhone: companyPhone.trim(),
      companyEmail: companyEmail.trim(),
      companyTaxNumber: companyTaxNumber.trim(),
      companyAddress: companyAddress.trim(),
      overviewTabTitle: overviewTabTitle.trim() || undefined,
      clientsTabTitle: clientsTabTitle.trim() || undefined,
      emergencyTabTitle: emergencyTabTitle.trim() || undefined,
      quotesTabTitle: quotesTabTitle.trim() || undefined,
      workOrdersTabTitle: workOrdersTabTitle.trim() || undefined,
      extinguishersTabTitle: extinguishersTabTitle.trim() || undefined,
      reportsArchiveTabTitle: reportsArchiveTabTitle.trim() || undefined,
      techniciansTabTitle: techniciansTabTitle.trim() || undefined,
      smsTabTitle: smsTabTitle.trim() || undefined,
      printFooterNote: printFooterNote.trim() || undefined,
      enableQuotesModule,
      enableWorkOrdersModule,
      enableExtinguishersModule,
      enableEmergencyModule,
      enableSmsModule,
      enableClientInquiries,
      customPages,
    };

    onSaveCustomization(updatedCustomization);

    if (adminEditName.trim() && adminEditUsername.trim() && adminEditPassword.trim()) {
      onUpdateAdminProfile(adminEditName.trim(), adminEditUsername.trim(), adminEditPassword.trim());
    }

    alert(isRtl ? '✨ تم حفظ وتطبيق كافة تخصيصات وتعديلات المشرف العام بنجاح!' : 'All Super Admin customizations saved and applied successfully!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-md animate-fade-in text-start">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200" 
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 font-extrabold text-xl shadow-inner">
              👑
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <span>{isRtl ? 'مركز تخصيص وإعدادات المشرف العام' : 'Super Admin Master Control Center'}</span>
                <span className="text-[10px] bg-amber-500/30 text-amber-300 border border-amber-400/40 font-bold px-2 py-0.5 rounded-full">
                  {isRtl ? 'صلاحيات حاكمة' : 'Root Control'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isRtl ? 'تحكم كامل بالألوان، النصوص، الأقسام، الصفحات المخصصة، وترويسة النظام' : 'Customize theme colors, titles, tabs, custom pages & system branding'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title={isRtl ? 'إغلاق' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with Sidebar Tabs */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* Internal Navigation Menu */}
          <div className="w-full md:w-64 bg-slate-50 border-b md:border-b-0 md:border-l border-slate-200 p-3 flex md:flex-col gap-1.5 overflow-x-auto shrink-0 no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveSubTab('theme')}
              className={`w-full text-start px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition shrink-0 ${
                activeSubTab === 'theme' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              <Palette className="w-4 h-4 text-teal-400 shrink-0" />
              <span>{isRtl ? 'الألوان والأنماط البصرية' : 'Theme & Accent Colors'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('labels')}
              className={`w-full text-start px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition shrink-0 ${
                activeSubTab === 'labels' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              <Type className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>{isRtl ? 'تخصيص المسميات والتبويبات' : 'Titles & Tab Labels'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('modules')}
              className={`w-full text-start px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition shrink-0 ${
                activeSubTab === 'modules' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              <Sliders className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{isRtl ? 'تفعيل وتعطيل الميزات والأقسام' : 'Module Feature Flags'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('pages')}
              className={`w-full text-start px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition shrink-0 ${
                activeSubTab === 'pages' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              <FileText className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{isRtl ? 'إدارة الصفحات المخصصة' : 'Custom Pages & Tabs'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('print')}
              className={`w-full text-start px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition shrink-0 ${
                activeSubTab === 'print' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              <Building2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{isRtl ? 'ترويسات وتقارير الطباعة' : 'Print & Report Branding'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('company')}
              className={`w-full text-start px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition shrink-0 ${
                activeSubTab === 'company' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              <Shield className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{isRtl ? 'بيانات المنشأة والحساب' : 'Company & Admin Profile'}</span>
            </button>
          </div>

          {/* Form Content Panel */}
          <form onSubmit={handleSaveAllCustomizations} className="flex-1 overflow-y-auto p-5 space-y-6">
            
            {/* 🎨 SUB-TAB 1: Theme & Colors */}
            {activeSubTab === 'theme' && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <Palette className="w-4 h-4 text-teal-600" />
                    <span>{isRtl ? 'تخصيص الألوان والأنماط البصرية للنظام' : 'System Color Theme & Branding Styles'}</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {isRtl 
                      ? 'يمكنك تغيير اللون الرئيسي للنظام ولون الشريط العلوي بحرية. يتم الاحتفاظ باللون الافتراضي حتى تقوم بالتعديل.'
                      : 'Customize standard theme colors. Choose custom hex values or quick preset palettes.'}
                  </p>
                </div>

                {/* Preset Palettes */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <label className="text-xs font-extrabold text-slate-800 block">
                    🎨 {isRtl ? 'نماذج وجداول ألوان جاهزة بضغطة واحدة:' : 'Quick Preset Color Palettes:'}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => applyPresetColor('#0f766e', '#0f172a')}
                      className="p-3 bg-white border border-slate-200 hover:border-teal-500 rounded-xl text-start transition shadow-sm cursor-pointer group"
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="w-4 h-4 rounded-full bg-[#0f766e]"></span>
                        <span className="w-4 h-4 rounded-full bg-[#0f172a]"></span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-800 block group-hover:text-teal-700">
                        {isRtl ? 'الزمردي الوقائي (الافتراضي)' : 'Safety Emerald (Default)'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyPresetColor('#1d4ed8', '#0f172a')}
                      className="p-3 bg-white border border-slate-200 hover:border-blue-500 rounded-xl text-start transition shadow-sm cursor-pointer group"
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="w-4 h-4 rounded-full bg-[#1d4ed8]"></span>
                        <span className="w-4 h-4 rounded-full bg-[#0f172a]"></span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-800 block group-hover:text-blue-700">
                        {isRtl ? 'الأزرق الملكي' : 'Royal Blue Safety'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyPresetColor('#b91c1c', '#0f172a')}
                      className="p-3 bg-white border border-slate-200 hover:border-rose-500 rounded-xl text-start transition shadow-sm cursor-pointer group"
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="w-4 h-4 rounded-full bg-[#b91c1c]"></span>
                        <span className="w-4 h-4 rounded-full bg-[#0f172a]"></span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-800 block group-hover:text-rose-700">
                        {isRtl ? 'العنابي القيادي' : 'Crimson Executive'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyPresetColor('#d97706', '#111827')}
                      className="p-3 bg-white border border-slate-200 hover:border-amber-500 rounded-xl text-start transition shadow-sm cursor-pointer group"
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="w-4 h-4 rounded-full bg-[#d97706]"></span>
                        <span className="w-4 h-4 rounded-full bg-[#111827]"></span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-800 block group-hover:text-amber-700">
                        {isRtl ? 'الذهبي الوقائي' : 'Amber Gold Safety'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyPresetColor('#4338ca', '#0f172a')}
                      className="p-3 bg-white border border-slate-200 hover:border-indigo-500 rounded-xl text-start transition shadow-sm cursor-pointer group"
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="w-4 h-4 rounded-full bg-[#4338ca]"></span>
                        <span className="w-4 h-4 rounded-full bg-[#0f172a]"></span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-800 block group-hover:text-indigo-700">
                        {isRtl ? 'النيل الأزرق الداكن' : 'Indigo Navy'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyPresetColor('#334155', '#0f172a')}
                      className="p-3 bg-white border border-slate-200 hover:border-slate-500 rounded-xl text-start transition shadow-sm cursor-pointer group"
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="w-4 h-4 rounded-full bg-[#334155]"></span>
                        <span className="w-4 h-4 rounded-full bg-[#0f172a]"></span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-800 block group-hover:text-slate-700">
                        {isRtl ? 'الفحمي الصناعي' : 'Slate Industrial'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Color Pickers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <label className="text-xs font-bold text-slate-800 block">
                      {isRtl ? 'اللون الرئيسي للأزرار والتظليل (Primary Accent):' : 'Primary Accent Color:'}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-12 h-10 rounded-xl border border-slate-300 cursor-pointer p-0.5 bg-white"
                      />
                      <input
                        type="text"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl w-32 uppercase"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <label className="text-xs font-bold text-slate-800 block">
                      {isRtl ? 'لون خلفية الشريط العلوي (Header Navbar):' : 'Top Navbar Header Color:'}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={headerBgColor}
                        onChange={(e) => setHeaderBgColor(e.target.value)}
                        className="w-12 h-10 rounded-xl border border-slate-300 cursor-pointer p-0.5 bg-white"
                      />
                      <input
                        type="text"
                        value={headerBgColor}
                        onChange={(e) => setHeaderBgColor(e.target.value)}
                        className="px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl w-32 uppercase"
                      />
                    </div>
                  </div>
                </div>

                {/* Live Color Preview Card */}
                <div className="p-4 border border-slate-200 rounded-2xl space-y-3 bg-slate-100/60">
                  <span className="text-xs font-extrabold text-slate-700 block flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-slate-600" />
                    {isRtl ? 'معاينة حية وتفاعلية للألوان المختارة:' : 'Live Component Color Preview:'}
                  </span>

                  <div className="rounded-xl overflow-hidden shadow-md border border-slate-300">
                    {/* Simulated Header */}
                    <div className="p-3 text-white flex items-center justify-between text-xs font-bold" style={{ backgroundColor: headerBgColor }}>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-teal-400"></span>
                        <span>{companyName}</span>
                      </div>
                      <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">{unifiedNumber}</span>
                    </div>

                    {/* Simulated Body Button */}
                    <div className="p-4 bg-white flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-600 font-semibold">{isRtl ? 'زر إجراء فحص السلامة المعتمد:' : 'Action Button:'}</span>
                      <button
                        type="button"
                        style={{ backgroundColor: primaryColor }}
                        className="px-4 py-2 text-white text-xs font-bold rounded-xl transition shadow"
                      >
                        {isRtl ? 'حفظ الفحص والمعاينة' : 'Save & Confirm Inspection'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleResetColors}
                    className="text-xs text-slate-600 hover:text-slate-900 font-bold flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{isRtl ? 'استعادة الألوان الافتراضية' : 'Reset Default Colors'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* 📝 SUB-TAB 2: Custom Titles & Tab Labels */}
            {activeSubTab === 'labels' && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <Type className="w-4 h-4 text-indigo-600" />
                    <span>{isRtl ? 'تخصيص مسميات العناوين والتبويبات الرئيسية' : 'Customize Tab Titles & Navigation Labels'}</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {isRtl 
                      ? 'يمكنك تغيير أسماء التبويبات والأقسام في شريط التنقل حسب رغبتك. اترك الخانة فارغة للاحتفاظ بالمسمى الافتراضي.'
                      : 'Rename system tabs and headers. Leave empty to retain default names.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50 p-4 border border-slate-200 rounded-2xl">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {isRtl ? 'تبويب: جدول الزيارات العام (Overview)' : 'Overview Tab Title'}
                    </label>
                    <input
                      type="text"
                      placeholder={isRtl ? 'المهام والجدول العام' : 'Overview & Schedule'}
                      value={overviewTabTitle}
                      onChange={(e) => setOverviewTabTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {isRtl ? 'تبويب: سجل المنشآت والعملاء (Clients)' : 'Clients Registry Tab Title'}
                    </label>
                    <input
                      type="text"
                      placeholder={isRtl ? 'سجل المنشآت والعملاء' : 'Clients Registry'}
                      value={clientsTabTitle}
                      onChange={(e) => setClientsTabTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {isRtl ? 'تبويب: الزيارات الطارئة (Emergency)' : 'Emergency Visits Tab Title'}
                    </label>
                    <input
                      type="text"
                      placeholder={isRtl ? 'البلاغات والزيارات الطارئة' : 'Emergency Inspections'}
                      value={emergencyTabTitle}
                      onChange={(e) => setEmergencyTabTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {isRtl ? 'تبويب: عروض الأسعار (Quotations)' : 'Quotations Tab Title'}
                    </label>
                    <input
                      type="text"
                      placeholder={isRtl ? 'عروض الأسعار' : 'Quotations'}
                      value={quotesTabTitle}
                      onChange={(e) => setQuotesTabTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {isRtl ? 'تبويب: أوامر العمل (Work Orders)' : 'Work Orders Tab Title'}
                    </label>
                    <input
                      type="text"
                      placeholder={isRtl ? 'أوامر العمل' : 'Work Orders'}
                      value={workOrdersTabTitle}
                      onChange={(e) => setWorkOrdersTabTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {isRtl ? 'تبويب: صيانة الطفايات (Extinguishers)' : 'Extinguishers Tab Title'}
                    </label>
                    <input
                      type="text"
                      placeholder={isRtl ? 'صيانة الطفايات' : 'Extinguisher Maintenance'}
                      value={extinguishersTabTitle}
                      onChange={(e) => setExtinguishersTabTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {isRtl ? 'تبويب: أرشيف التقارير (Reports Archive)' : 'Reports Archive Tab Title'}
                    </label>
                    <input
                      type="text"
                      placeholder={isRtl ? 'أرشيف وسجلات التقارير' : 'Reports Archive'}
                      value={reportsArchiveTabTitle}
                      onChange={(e) => setReportsArchiveTabTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {isRtl ? 'تبويب: سجل الفنيين (Technicians)' : 'Technicians Tab Title'}
                    </label>
                    <input
                      type="text"
                      placeholder={isRtl ? 'سجل الفنيين' : 'Technicians Registry'}
                      value={techniciansTabTitle}
                      onChange={(e) => setTechniciansTabTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {isRtl ? 'تبويب: الرسائل والإشعارات (SMS / WhatsApp)' : 'Notifications Tab Title'}
                    </label>
                    <input
                      type="text"
                      placeholder={isRtl ? 'الرسائل والإشعارات' : 'SMS Notifications'}
                      value={smsTabTitle}
                      onChange={(e) => setSmsTabTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleResetLabels}
                    className="text-xs text-slate-600 hover:text-slate-900 font-bold flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{isRtl ? 'استعادة مسميات التبويبات الافتراضية' : 'Reset Default Titles'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* ⚡ SUB-TAB 3: Module Toggles */}
            {activeSubTab === 'modules' && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-emerald-600" />
                    <span>{isRtl ? 'تفعيل وتعطيل أقسام وميزات النظام' : 'Enable/Disable System Modules & Features'}</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {isRtl 
                      ? 'يمكنك إخفاء أو إظهار أقسام النظام الرئيسية في الواجهات حسب احتياج المنشأة بضغط زر واحدة.'
                      : 'Toggle visibility of main features and portals across the dashboard.'}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                  
                  {/* Quotes Module */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <span className="font-bold text-slate-800 text-xs block">
                        📜 {isRtl ? 'قسم عروض الأسعار (Quotations Module)' : 'Quotations Module'}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {isRtl ? 'إمكانية إعداد وإرسال عروض أسعار قطع غيار وملاحظات الفحص للعملاء' : 'Manage defect quotes and parts pricing'}
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={enableQuotesModule}
                        onChange={(e) => setEnableQuotesModule(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-teal-500 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                    </label>
                  </div>

                  {/* Work Orders Module */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <span className="font-bold text-slate-800 text-xs block">
                        💼 {isRtl ? 'قسم أوامر العمل والإنجاز (Work Orders Module)' : 'Work Orders Module'}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {isRtl ? 'متابعة تنفيذ عروض الأسعار المقبولة وتعيين الفني لتنفيذها' : 'Assign tech tasks for approved client quotes'}
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={enableWorkOrdersModule}
                        onChange={(e) => setEnableWorkOrdersModule(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-teal-500 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                    </label>
                  </div>

                  {/* Extinguishers Module */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <span className="font-bold text-slate-800 text-xs block">
                        🧯 {isRtl ? 'قسم صيانة وسندات طفايات الحريق (Extinguisher Maintenance)' : 'Extinguishers Module'}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {isRtl ? 'سندات استلام وإعادة طفايات الحريق المعبأة وسجل التواريخ' : 'Receipts for fire extinguisher refilling & expiry dates'}
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={enableExtinguishersModule}
                        onChange={(e) => setEnableExtinguishersModule(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-teal-500 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                    </label>
                  </div>

                  {/* Emergency Module */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <span className="font-bold text-slate-800 text-xs block">
                        🚨 {isRtl ? 'قسم البلاغات والزيارات الطارئة (Emergency Inspections)' : 'Emergency Visits Module'}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {isRtl ? 'إنشاء وتتبع طلبات الفحص الطارئ الفوري خارج الجدول الدوري' : 'On-demand urgent safety inspections'}
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={enableEmergencyModule}
                        onChange={(e) => setEnableEmergencyModule(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-teal-500 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                    </label>
                  </div>

                  {/* SMS / WhatsApp Module */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <span className="font-bold text-slate-800 text-xs block">
                        📱 {isRtl ? 'قسم إشعارات الرسائل والواتساب (Notifications Log)' : 'SMS / WhatsApp Notifications'}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {isRtl ? 'سجل الرسائل المرسلة تلقائياً واستفسارات العملاء' : 'Outbound logs and client messages'}
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={enableSmsModule}
                        onChange={(e) => setEnableSmsModule(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-teal-500 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                    </label>
                  </div>

                  {/* Client Inquiries Feature */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 text-xs block">
                        💬 {isRtl ? 'ميزة إرسال الملاحظات والاستفسارات من بوابة العملاء' : 'Client Inquiries Feature'}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {isRtl ? 'السماح للعملاء بإرسال استفسارات وملاحظات مباشرة من حسابهم' : 'Allow clients to send direct inquiry tickets'}
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={enableClientInquiries}
                        onChange={(e) => setEnableClientInquiries(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-teal-500 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                    </label>
                  </div>

                </div>
              </div>
            )}

            {/* 📌 SUB-TAB 4: Custom Pages */}
            {activeSubTab === 'pages' && (
              <div className="space-y-5 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-600" />
                      <span>{isRtl ? 'إضافة وإدارة الصفحات والتبويبات المخصصة' : 'Manage Custom System Dynamic Pages'}</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {isRtl 
                        ? 'يمكنك إضافة صفحات مخصصة كتعاليم سلامة أو تعاميم أو إرشادات تظهر كتبويب مستقل للمشرفين، العملاء، أو الفنيين.'
                        : 'Create internal guideline or notice pages that appear dynamically in navigation.'}
                    </p>
                  </div>

                  {!showPageForm && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPageId(null);
                        setPageTitle('');
                        setPageIcon('📜');
                        setPageContent('');
                        setPageAudience('all');
                        setShowPageForm(true);
                      }}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow cursor-pointer shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isRtl ? 'إضافة صفحة مخصصة' : 'Add Custom Page'}</span>
                    </button>
                  )}
                </div>

                {/* Add/Edit Custom Page Form */}
                {showPageForm && (
                  <div className="p-4 bg-slate-50 border-2 border-amber-300/70 rounded-2xl space-y-3.5 shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                        <span>{editingPageId ? '✏️' : '➕'}</span>
                        <span>{editingPageId ? (isRtl ? 'تعديل الصفحة المخصصة' : 'Edit Custom Page') : (isRtl ? 'إنشاء صفحة مخصصة جديدة' : 'Create New Custom Page')}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowPageForm(false)}
                        className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                      >
                        {isRtl ? 'إلغاء' : 'Cancel'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="text-xs font-bold text-slate-700 block mb-1">{isRtl ? 'عنوان الصفحة:' : 'Page Title:'}</label>
                        <input
                          type="text"
                          required
                          placeholder={isRtl ? 'مثال: تعاميم وإرشادات الوقاية من الحريق 2026' : 'e.g. Safety Guidelines 2026'}
                          value={pageTitle}
                          onChange={(e) => setPageTitle(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">{isRtl ? 'الأيقونة (Emoji):' : 'Icon (Emoji):'}</label>
                        <input
                          type="text"
                          required
                          placeholder="📜"
                          value={pageIcon}
                          onChange={(e) => setPageIcon(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 text-center"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">{isRtl ? 'الفئة المستهدفة للظهور:' : 'Target Audience:'}</label>
                      <select
                        value={pageAudience}
                        onChange={(e: any) => setPageAudience(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-bold"
                      >
                        <option value="all">{isRtl ? '🌐 الجميع (المشرفين + العملاء + الفنيين)' : 'Everyone (Admin + Clients + Technicians)'}</option>
                        <option value="admin">{isRtl ? '👑 المشرفين والإدارة فقط' : 'Admins Only'}</option>
                        <option value="clients">{isRtl ? '🏢 العملاء وأصحاب المنشآت فقط' : 'Clients Portal Only'}</option>
                        <option value="technicians">{isRtl ? '🛠️ الفنيين ومسؤولي الفحص فقط' : 'Technicians Only'}</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">{isRtl ? 'محتوى ونصوص الصفحة:' : 'Page Content (Guidelines / Text):'}</label>
                      <textarea
                        rows={4}
                        required
                        placeholder={isRtl ? 'اكتب تفاصيل التعليمات والسياسات الخاصة بالسلامة التي ترغب بعرضها للمستخدمين هنا...' : 'Enter formatted content or guidelines...'}
                        value={pageContent}
                        onChange={(e) => setPageContent(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 leading-relaxed"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowPageForm(false)}
                        className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition"
                      >
                        {isRtl ? 'تراجع' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={handleSavePage}
                        className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shadow flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>{isRtl ? 'حفظ الصفحة المخصصة' : 'Save Custom Page'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* List of Created Custom Pages */}
                <div className="space-y-2.5">
                  <span className="text-xs font-bold text-slate-700 block">
                    {isRtl ? `الصفحات المخصصة الحالية (${customPages.length}):` : `Active Custom Pages (${customPages.length}):`}
                  </span>

                  {customPages.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-slate-500 text-xs">
                      <p className="font-bold">{isRtl ? 'لا توجد صفحات مخصصة حالياً' : 'No custom pages created yet'}</p>
                      <p className="text-[11px] mt-1 text-slate-400">
                        {isRtl ? 'اضغط زر "إضافة صفحة مخصصة" بالأعلى لإنشاء تبويب تعليمات جديدة للعملاء أو الفنيين.' : 'Click "Add Custom Page" to add internal guidelines.'}
                      </p>
                    </div>
                  ) : (
                    customPages.map(page => (
                      <div key={page.id} className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-sm hover:border-slate-300 transition">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-lg shrink-0">
                            {page.icon || '📜'}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h5 className="font-extrabold text-slate-900 text-xs truncate">{page.title}</h5>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                page.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                              }`}>
                                {page.enabled ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'معطل' : 'Disabled')}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 truncate mt-0.5">
                              {page.targetAudience === 'all' && (isRtl ? '🌐 يظهر للجميع' : 'Visible to All')}
                              {page.targetAudience === 'admin' && (isRtl ? '👑 للمشرفين فقط' : 'Admins Only')}
                              {page.targetAudience === 'clients' && (isRtl ? '🏢 للعملاء فقط' : 'Clients Only')}
                              {page.targetAudience === 'technicians' && (isRtl ? '🛠️ للفنيين فقط' : 'Technicians Only')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleTogglePage(page.id)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                              page.enabled ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                            }`}
                          >
                            {page.enabled ? (isRtl ? 'تعطيل' : 'Disable') : (isRtl ? 'تفعيل' : 'Enable')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditPage(page)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                            title={isRtl ? 'تعديل' : 'Edit'}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePage(page.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                            title={isRtl ? 'حذف' : 'Delete'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 🏢 SUB-TAB 5: Print Branding */}
            {activeSubTab === 'print' && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-cyan-600" />
                    <span>{isRtl ? 'تخصيص ترويسة وتذييل عقود وتقارير الطباعة' : 'Print & Official Document Branding'}</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {isRtl 
                      ? 'تعديل النص الرسمي الذي يظهر في أسفل طباعة العقد المعتمد وسندات صيانة الطفايات وتقارير الفحص.'
                      : 'Customize print notes displayed at the bottom of printed contracts and audit receipts.'}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      {isRtl ? 'نص تذييل الطباعة المعتمد (Print Footer Note):' : 'Official Print Footer Note:'}
                    </label>
                    <textarea
                      rows={3}
                      placeholder={isRtl ? 'هذه الوثيقة نسخة طبق الأصل تفصيلية رقمية، مأخوذة بشكل ديناميكي من ملف العقد الأصلي للمنشأة وتخضع للائحة المعتمدة...' : 'This document resides digitally in compliance with preventative guidelines...'}
                      value={printFooterNote}
                      onChange={(e) => setPrintFooterNote(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 leading-relaxed"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 🛡️ SUB-TAB 6: Company & Admin Credentials */}
            {activeSubTab === 'company' && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-rose-600" />
                    <span>{isRtl ? 'بيانات المنشأة الحاكمة وحساب المشرف العام' : 'Primary Company & Super Admin Credentials'}</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {isRtl 
                      ? 'تعديل بيانات الشركة الرسمية واسم المشرف العام وكلمة السر وتفعيل وضع الصيانة.'
                      : 'Primary company settings, general supervisor login and global maintenance lock.'}
                  </p>
                </div>

                {/* Company Details */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <span className="text-xs font-extrabold text-slate-800 block border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                    🏢 {isRtl ? 'بيانات الشركة الرئيسية' : 'Primary Company Details'}
                  </span>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">{isRtl ? 'اسم الشركة' : 'Company Name'}</label>
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">{isRtl ? 'الرقم الموحد' : 'Unified Registration ID'}</label>
                        <input
                          type="text"
                          required
                          value={unifiedNumber}
                          onChange={(e) => setUnifiedNumber(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">{isRtl ? 'جوال الشركة' : 'Company Phone'}</label>
                        <input
                          type="tel"
                          required
                          value={companyPhone}
                          onChange={(e) => setCompanyPhone(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">{isRtl ? 'البريد الإلكتروني' : 'Company Email'}</label>
                        <input
                          type="email"
                          required
                          value={companyEmail}
                          onChange={(e) => setCompanyEmail(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">{isRtl ? 'الرقم الضريبي' : 'Tax VAT Number'}</label>
                        <input
                          type="text"
                          required
                          value={companyTaxNumber}
                          onChange={(e) => setCompanyTaxNumber(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">{isRtl ? 'العنوان الرئيسي' : 'Company Address'}</label>
                      <input
                        type="text"
                        required
                        value={companyAddress}
                        onChange={(e) => setCompanyAddress(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Super Admin Credentials */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <span className="text-xs font-extrabold text-slate-800 block border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                    👤 {isRtl ? 'بيانات دخول المشرف العام' : 'Super Admin Credentials'}
                  </span>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">{isRtl ? 'اسم المشرف العام' : 'Supervisor Name'}</label>
                      <input
                        type="text"
                        required
                        value={adminEditName}
                        onChange={(e) => setAdminEditName(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">{isRtl ? 'اسم المستخدم للدخول' : 'Username'}</label>
                        <input
                          type="text"
                          required
                          value={adminEditUsername}
                          onChange={(e) => setAdminEditUsername(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">{isRtl ? 'كلمة المرور الحاكمة' : 'Password'}</label>
                        <input
                          type="text"
                          required
                          value={adminEditPassword}
                          onChange={(e) => setAdminEditPassword(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Maintenance Mode Toggle */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block text-xs flex items-center gap-1.5">
                        ⚙️ {isRtl ? 'وضع الصيانة وإغلاق الروابط' : 'Global Maintenance Mode Lock'}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {isRtl ? 'وقف تشغيل بوابة الفنيين والعملاء فوراً مع إظهار لوحة تنبيه صيانة' : 'Lock technician and client access during updates'}
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={!!maintenanceModeEnabled}
                        onChange={(e) => onUpdateMaintenanceMode(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-teal-500 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Actions Footer inside Form */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <span className="text-[11px] text-slate-400">
                {isRtl ? 'جميع التعديلات تحفظ وتنعكس فوراً على كامل النظام' : 'All customizations persist immediately in local workspace'}
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition shadow cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-teal-400" />
                  <span>{isRtl ? 'حفظ كافة تخصيصات المشرف العام' : 'Save & Apply All Customizations'}</span>
                </button>
              </div>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};
