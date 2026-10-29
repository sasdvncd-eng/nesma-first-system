import { useState, FormEvent, useEffect } from 'react';
import { Technician, VisitFrequency, Branch } from '../types';
import { calculateContractEndDate } from '../lib/contractUtils';
import { Plus, ArrowLeft, ArrowRight, X, ArrowUpRight } from 'lucide-react';

interface AddClientFormProps {
  isRtl: boolean;
  t: any;
  technicians: Technician[];
  managersList: any[];
  onSave: (data: {
    name: string;
    contractNumber: string;
    phone: string;
    email?: string;
    taxNumber?: string;
    commercialRegister?: string;
    delegateName?: string;
    locationText: string;
    locationUrl: string;
    visitFrequency: VisitFrequency;
    contractStartDate: string;
    contractEndDate: string;
    assignedTechnicianId: string;
    contractSupervisorId: string;
    username: string;
    password: string;
    branches: Branch[];
    fireExtinguisherExpiry: string;
    contractFile?: { name: string; url: string; size?: string } | null;
    contractDuration: number;
  }) => void;
  onCancel: () => void;
}

export function AddClientForm({
  isRtl,
  t,
  technicians,
  managersList,
  onSave,
  onCancel
}: AddClientFormProps) {
  // Primary Client State Variables
  const [newClientName, setNewClientName] = useState('');
  const [newClientContract, setNewClientContract] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientTaxNumber, setNewClientTaxNumber] = useState('');
  const [newClientCommercialRegister, setNewClientCommercialRegister] = useState('');
  const [newClientDelegateName, setNewClientDelegateName] = useState('');
  const [newClientLocation, setNewClientLocation] = useState('');
  const [newClientLocationUrl, setNewClientLocationUrl] = useState('');
  const [newClientFrequency, setNewClientFrequency] = useState<VisitFrequency>('4');
  const [newClientStartDate, setNewClientStartDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [newClientContractDuration, setNewClientContractDuration] = useState<number>(1);
  const [newClientEndDate, setNewClientEndDate] = useState('');
  const [newClientTech, setNewClientTech] = useState(() => {
    return technicians.filter((u) => u.role !== 'admin')[0]?.id || '';
  });
  const [newClientSupervisor, setNewClientSupervisor] = useState('admin');
  const [newFireExtinguisherExpiry, setNewFireExtinguisherExpiry] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });
  const [newContractFile, setNewContractFile] = useState<{ name: string; url: string; size?: string } | null>(null);
  const [isUploadingContract, setIsUploadingContract] = useState(false);
  const [isUploadingBranchContract, setIsUploadingBranchContract] = useState(false);
  const [newClientUsername, setNewClientUsername] = useState('');
  const [newClientPassword, setNewClientPassword] = useState('123');

  // Branch Specific states inside Add Client Form
  const [newClientBranches, setNewClientBranches] = useState<Branch[]>([]);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCity, setNewBranchCity] = useState('الرياض');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchLocationUrl, setNewBranchLocationUrl] = useState('');
  const [newBranchManagerPhone, setNewBranchManagerPhone] = useState('');
  const [newBranchTech, setNewBranchTech] = useState('');
  const [newBranchContractNumber, setNewBranchContractNumber] = useState('');
  const [newBranchContractFile, setNewBranchContractFile] = useState<{ name: string; url: string; size?: string } | null>(null);
  const [newBranchFireExtinguisherExpiry, setNewBranchFireExtinguisherExpiry] = useState('');
  const [newBranchContractStartDate, setNewBranchContractStartDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [newBranchContractDurationYears, setNewBranchContractDurationYears] = useState('1');
  const [newBranchContractEndDate, setNewBranchContractEndDate] = useState('');
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);

  // Dynamic automatic calculation of contract end dates
  useEffect(() => {
    if (!newClientStartDate) return;
    setNewClientEndDate(calculateContractEndDate(newClientStartDate, newClientContractDuration));
  }, [newClientStartDate, newClientContractDuration]);

  // Branch contract end date calculation
  useEffect(() => {
    if (!newBranchContractStartDate) return;
    setNewBranchContractEndDate(calculateContractEndDate(newBranchContractStartDate, newBranchContractDurationYears));
  }, [newBranchContractStartDate, newBranchContractDurationYears]);

  // Suggest default portal username based on English name translation
  useEffect(() => {
    if (!newClientName) {
      setNewClientUsername('');
      return;
    }
    // Clean and convert to lowercase alphanumeric username suggestion
    const clean = newClientName
      .toLowerCase()
      .replace(/[\s\W_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    setNewClientUsername(clean ? `client_${clean}` : `client_${Date.now().toString().slice(-4)}`);
  }, [newClientName]);

  const handleSelectBranchForEditing = (br: Branch) => {
    setEditingBranchId(br.id);
    setNewBranchName(br.name);
    setNewBranchCity(br.city);
    setNewBranchAddress(br.locationText || '');
    setNewBranchLocationUrl(br.locationUrl || '');
    setNewBranchManagerPhone(br.managerPhone || '');
    setNewBranchTech(br.assignedTechnicianId || '');
    setNewBranchContractNumber(br.contractNumber || '');
    setNewBranchContractFile(br.contractFile ? { name: br.contractFile.name, url: br.contractFile.url, size: br.contractFile.size } : null);
    setNewBranchFireExtinguisherExpiry(br.fireExtinguisherExpiry || '');
    setNewBranchContractStartDate(br.contractStartDate || newClientStartDate);
    setNewBranchContractDurationYears(br.contractDurationYears || '1');
    setNewBranchContractEndDate(br.contractEndDate || '');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) {
      alert(isRtl ? 'الرجاء إدخال اسم العميل / المنشأة!' : 'Please enter the client / establishment name!');
      return;
    }

    onSave({
      name: newClientName.trim(),
      contractNumber: newClientContract.trim() || 'N/A',
      phone: newClientPhone.trim() || 'N/A',
      email: newClientEmail.trim() || undefined,
      taxNumber: newClientTaxNumber.trim() || undefined,
      commercialRegister: newClientCommercialRegister.trim() || undefined,
      delegateName: newClientDelegateName.trim() || undefined,
      locationText: newClientLocation.trim() || (isRtl ? 'الرياض' : 'Riyadh'),
      locationUrl: newClientLocationUrl.trim() || `https://maps.google.com/?q=24.7136,46.6753`,
      visitFrequency: newClientFrequency,
      contractStartDate: newClientStartDate,
      contractEndDate: newClientEndDate,
      assignedTechnicianId: newClientTech,
      contractSupervisorId: newClientSupervisor,
      username: newClientUsername.trim(),
      password: newClientPassword.trim() || '123',
      branches: newClientBranches,
      fireExtinguisherExpiry: newFireExtinguisherExpiry,
      contractFile: newContractFile,
      contractDuration: newClientContractDuration
    });
  };

  return (
    <div className="space-y-6 text-slate-800 font-sans" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Sub-page Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <span>{isRtl ? 'لوحة المشرف' : 'Admin Panel'}</span>
            <span>/</span>
            <span>{isRtl ? 'سجل العملاء والعقود' : 'Clients & Contracts'}</span>
            <span>/</span>
            <span className="text-slate-800 font-semibold">{isRtl ? 'إضافة عميل وعقد جديد' : 'Add New Client & Contract'}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>➕</span>
            {isRtl ? 'إضافة عميل وعقد وجدولة الصيانة' : 'Add Client & Schedule Maintenance'}
          </h1>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer border border-slate-200"
        >
          {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          <span>{isRtl ? 'الرجوع لسجل العملاء والعقود' : 'Back to Clients Ledger'}</span>
        </button>
      </div>

      {/* Beautiful Form Card */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 sm:p-8 max-w-5xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Split layout: Client info on left/right, Contract info next to it */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Column 1: Client Info */}
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
              <span className="text-sm font-extrabold text-slate-900 block border-b border-slate-200 pb-2 flex items-center gap-2">
                👤 {isRtl ? 'بيانات العميل (المنشأة)' : 'Client Information'}
              </span>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isRtl ? 'اسم العميل او المنشأة *' : 'Client / Establishment Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t.clientNamePlaceholder}
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-800 focus:ring-2 focus:ring-emerald-50"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {isRtl ? 'رقم الجوال *' : 'Mobile Number *'}
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="05xxxxxxxx"
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-800 text-left font-mono focus:ring-2 focus:ring-emerald-50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {isRtl ? 'الايميل' : 'Email Address'}
                    </label>
                    <input
                      type="email"
                      placeholder="client@example.com"
                      value={newClientEmail}
                      onChange={(e) => setNewClientEmail(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-800 text-left font-mono focus:ring-2 focus:ring-emerald-50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {isRtl ? 'الرقم الضريبي' : 'Tax Number'}
                    </label>
                    <input
                      type="text"
                      placeholder="310xxxxxxxxxxxx"
                      value={newClientTaxNumber}
                      onChange={(e) => setNewClientTaxNumber(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-800 text-left font-mono focus:ring-2 focus:ring-emerald-50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {isRtl ? 'السجل التجاري' : 'Commercial Register'}
                    </label>
                    <input
                      type="text"
                      placeholder="1010xxxxxx"
                      value={newClientCommercialRegister}
                      onChange={(e) => setNewClientCommercialRegister(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-800 text-left font-mono focus:ring-2 focus:ring-emerald-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isRtl ? 'العنوان' : 'Address'}
                  </label>
                  <input
                    type="text"
                    placeholder={t.clientLocationPlaceholder}
                    value={newClientLocation}
                    onChange={(e) => setNewClientLocation(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-800 focus:ring-2 focus:ring-emerald-50"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {isRtl ? 'المسئول عن العقد *' : 'Supervisor / Manager *'}
                    </label>
                    <select
                      value={newClientSupervisor}
                      onChange={(e) => setNewClientSupervisor(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-705 cursor-pointer focus:ring-2 focus:ring-emerald-50 text-start"
                    >
                      {managersList.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {isRtl ? 'المندوب' : 'Delegate Name'}
                    </label>
                    <input
                      type="text"
                      placeholder={isRtl ? 'أدخل اسم المندوب يدوياً' : 'Enter delegate name'}
                      value={newClientDelegateName}
                      onChange={(e) => setNewClientDelegateName(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-800 focus:ring-2 focus:ring-emerald-50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Contract Info */}
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
              <span className="text-sm font-extrabold text-slate-900 block border-b border-slate-200 pb-2 flex items-center gap-2">
                📑 {isRtl ? 'بيانات العقد الأساسية للمنشأة' : 'Contract Main Information'}
              </span>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isRtl ? 'رقم العقد *' : 'Contract Number *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t.contractNumberPlaceholder}
                    value={newClientContract}
                    onChange={(e) => setNewClientContract(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-800 focus:ring-2 focus:ring-emerald-50"
                  />
                </div>

                {newClientBranches.length > 0 ? (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-850 text-xs leading-relaxed font-semibold">
                    💡 {isRtl 
                      ? 'تم إخفاء تواريخ العقد الرئيسية لأنه تم إضافة فروع للمنشأة. سيتم جدولة الزيارات بناءً على التواريخ والمدد المحددة لكل فرع على حدة.' 
                      : 'Main contract dates are hidden because branches exist. Schedule is strictly calculated based on each branch\'s individual contract start date and duration.'}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          {isRtl ? 'تاريخ بداية العقد *' : 'Contract Start Date *'}
                        </label>
                        <input
                          type="date"
                          required
                          value={newClientStartDate}
                          onChange={(e) => setNewClientStartDate(e.target.value)}
                          className="w-full px-4 py-2.5 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-805 text-left font-mono focus:ring-2 focus:ring-emerald-50"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          {isRtl ? 'مدة العقد' : 'Contract Duration'}
                        </label>
                        <select
                          value={newClientContractDuration}
                          onChange={(e) => setNewClientContractDuration(Number(e.target.value))}
                          className="w-full px-4 py-2.5 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-750 cursor-pointer text-start focus:ring-2 focus:ring-emerald-50"
                        >
                          <option value={0.5}>{isRtl ? '6 شهور' : '6 Months'}</option>
                          <option value={1}>{isRtl ? 'سنة واحدة' : '1 Year'}</option>
                          <option value={2}>{isRtl ? 'سنتان (2)' : '2 Years'}</option>
                          <option value={3}>{isRtl ? 'ثلاث سنوات (3)' : '3 Years'}</option>
                          <option value={4}>{isRtl ? 'أربع سنوات (4)' : '4 Years'}</option>
                          <option value={5}>{isRtl ? 'خمس سنوات (5)' : '5 Years'}</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        {isRtl ? 'تاريخ نهاية العقد' : 'Contract End Date'}
                      </label>
                      <input
                        type="date"
                        required
                        value={newClientEndDate}
                        onChange={(e) => setNewClientEndDate(e.target.value)}
                        className="w-full px-4 py-2.5 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-805 text-left font-mono focus:ring-2 focus:ring-emerald-50"
                      />
                    </div>
                  </>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {isRtl ? 'عدد الزيارات السنوية *' : 'Annual Visits *'}
                    </label>
                    <select
                      value={newClientFrequency}
                      onChange={(e) => setNewClientFrequency(e.target.value as VisitFrequency)}
                      className="w-full px-4 py-2.5 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-705 cursor-pointer focus:ring-2 focus:ring-emerald-50"
                    >
                      <option value="2">{t.visitsFrequency2}</option>
                      <option value="3">{t.visitsFrequency3}</option>
                      <option value="4">{t.visitsFrequency4}</option>
                      <option value="6">{t.visitsFrequency6}</option>
                      <option value="12">{t.visitsFrequency12}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      🧯 {isRtl ? 'صلاحية طفايات الحريق *' : 'Fire Extinguisher Expiry *'}
                    </label>
                    <input
                      type="date"
                      required
                      value={newFireExtinguisherExpiry}
                      onChange={(e) => setNewFireExtinguisherExpiry(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-805 text-left font-mono focus:ring-2 focus:ring-emerald-50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      👷‍♂️ {isRtl ? 'الفني المكلف' : 'Assigned Technician'}
                    </label>
                    <select
                      value={newClientTech}
                      onChange={(e) => setNewClientTech(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-705 cursor-pointer text-start focus:ring-2 focus:ring-emerald-50"
                    >
                      {technicians.filter(u => u.role !== 'admin').map((tech) => (
                        <option key={tech.id} value={tech.id}>
                          {tech.name} ({tech.phone})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {isRtl ? 'رابط الموقع الجغرافي للمنشأة' : 'Google Maps Location Link'}
                    </label>
                    <input
                      type="text"
                      placeholder="https://maps.google.com/?q=..."
                      value={newClientLocationUrl}
                      onChange={(e) => setNewClientLocationUrl(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-800 font-mono text-left focus:ring-2 focus:ring-emerald-50"
                    />
                  </div>
                </div>

                {/* Contract File Upload */}
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                  <label className="text-[11px] font-bold text-slate-600 block">
                    📄 {isRtl ? 'إرفاق ملف العقد' : 'Attach Contract File'}
                  </label>
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    disabled={isUploadingContract}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      if (file.size > 10 * 1024 * 1024) {
                        alert(isRtl 
                          ? `تنبيه: حجم ملف العقد المرفوع يتجاوز الحد الأقصى المسموح به (10 ميجابايت).` 
                          : `Warning: The uploaded contract file size exceeds 10 MB.`
                        );
                        return;
                      }

                      setIsUploadingContract(true);
                      const reader = new FileReader();
                      reader.onload = async () => {
                        const result = reader.result as string;
                        if (!result) {
                          setIsUploadingContract(false);
                          return;
                        }
                        try {
                          const base64Content = result.split(',')[1];
                          const response = await fetch('/api/upload', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: file.name, type: file.type, base64: base64Content })
                          });
                          const uploadRes = await response.json();
                          if (uploadRes.success) {
                            setNewContractFile({
                              name: file.name,
                              url: uploadRes.url,
                              size: (file.size / (1024 * 1024)).toFixed(2) + ' MB'
                            });
                          } else {
                            throw new Error(uploadRes.error || 'Server upload failed');
                          }
                        } catch (err) {
                          console.error("Contract upload error", err);
                          alert(isRtl 
                            ? 'فشل رفع ملف العقد للموقع. يرجى المحاولة مرة أخرى أو التأكد من استقرار اتصالك بالإنترنت.' 
                            : 'Failed to upload contract file. Please try again or check your internet connection.'
                          );
                          setNewContractFile(null);
                        } finally {
                          setIsUploadingContract(false);
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer disabled:opacity-50"
                  />
                  {isUploadingContract && (
                    <div className="flex items-center gap-2 text-xs text-teal-600 font-bold bg-teal-50/50 p-2 rounded-xl border border-teal-100 animate-pulse">
                      <span>⏳ {isRtl ? 'جاري رفع ومعالجة ملف العقد ودعمه سحابياً...' : 'Uploading and processing contract file to secure cloud...'}</span>
                    </div>
                  )}
                  {newContractFile && !isUploadingContract && (
                    <div className="flex items-center justify-between text-[11px] bg-teal-50 text-teal-900 border border-teal-100 p-2 rounded-xl">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate max-w-[200px] font-bold">✓ {newContractFile.name}</span>
                        <span className="text-[10px] text-teal-600 font-bold bg-white px-1.5 py-0.5 rounded border border-teal-150">({newContractFile.size})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNewContractFile(null);
                          const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                          if (fileInput) fileInput.value = '';
                        }}
                        className="p-1 text-rose-600 hover:bg-rose-100 rounded-lg transition-all cursor-pointer font-bold"
                        title={isRtl ? 'حذف ملف العقد المرفق' : 'Delete contract file'}
                      >
                        ❌
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Dynamic Branch Overhaul Form (Wide & Full Width) */}
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
            <span className="text-xs font-bold text-slate-955 block border-b border-slate-200 pb-2 flex items-center justify-between">
              <span className="text-sm font-extrabold flex items-center gap-2">🏢 {isRtl ? 'بيانات الفروع (اسم الفرع - المدينة - جوال مسئول الفرع - رقم وتواريخ العقد)' : 'Branches Information & Schedules:'}</span>
              {newClientBranches.length > 0 && (
                <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-3 py-1 rounded-full font-bold">
                  {newClientBranches.length} {isRtl ? 'فرع مضاف' : 'Branches'}
                </span>
              )}
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">

              {/* Branch Details Row 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">{isRtl ? 'اسم الفرع *' : 'Branch Name *'}</label>
                  <input
                    type="text"
                    placeholder={isRtl ? 'مثال: فرع السليمانية' : 'e.g., Sulaimaniyah branch'}
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">{isRtl ? 'المدينة / المنطقة' : 'City / Region'}</label>
                  <select
                    value={newBranchCity}
                    onChange={(e) => setNewBranchCity(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-805"
                  >
                    <option value="الرياض">الرياض / Riyadh</option>
                    <option value="جدة">جدة / Jeddah</option>
                    <option value="الخبر">الخبر / Khobar</option>
                    <option value="الدمام">الدمام / Dammam</option>
                    <option value="الأحساء">الأحساء / Al-Ahsa</option>
                    <option value="الظهران">الظهران / Dhahran</option>
                    <option value="الجبيل">الجبيل / Al-Jubail</option>
                    <option value="مكة المكرمة">مكة المكرمة / Makkah</option>
                    <option value="المدينة المنورة">المدينة المنورة / Madinah</option>
                    <option value="أخرى">أخرى / Other</option>
                  </select>
                </div>
              </div>

              {/* Branch-Specific Contract Dates Input Fields */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                <div>
                  <label className="text-[9px] font-extrabold text-slate-700 block mb-1">{isRtl ? 'تاريخ بداية العقد للفرع' : 'Branch Contract Start Date'}</label>
                  <input
                    type="date"
                    value={newBranchContractStartDate}
                    onChange={(e) => setNewBranchContractStartDate(e.target.value)}
                    className="w-full px-2 py-1 text-[10px] bg-white border border-slate-200 rounded-lg text-slate-850"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-extrabold text-slate-700 block mb-1">{isRtl ? 'مدة عقد الفرع' : 'Branch Contract Duration'}</label>
                  <select
                    value={newBranchContractDurationYears}
                    onChange={(e) => setNewBranchContractDurationYears(e.target.value)}
                    className="w-full px-1.5 py-1 text-[10px] bg-white border border-slate-200 rounded-lg text-slate-800 cursor-pointer text-start"
                  >
                    <option value="0.5">{isRtl ? '6 شهور' : '6 Months'}</option>
                    <option value="1">{isRtl ? 'سنة واحدة' : '1 Year'}</option>
                    <option value="2">{isRtl ? 'سنتان' : '2 Years'}</option>
                    <option value="3">{isRtl ? '3 سنوات' : '3 Years'}</option>
                    <option value="4">{isRtl ? '4 سنوات' : '4 Years'}</option>
                    <option value="5">{isRtl ? '5 سنوات' : '5 Years'}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-extrabold text-slate-700 block mb-1">{isRtl ? 'تاريخ نهاية العقد للفرع' : 'Branch Contract End Date'}</label>
                  <input
                    type="date"
                    value={newBranchContractEndDate}
                    onChange={(e) => setNewBranchContractEndDate(e.target.value)}
                    className="w-full px-2 py-1 text-[10px] bg-white border border-slate-200 rounded-lg text-slate-850"
                  />
                </div>
              </div>

              {/* Branch Manager & Map url */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">{isRtl ? 'رقم جوال مسؤول الفرع' : 'Branch Manager Phone'}</label>
                  <input
                    type="tel"
                    placeholder="05xxxxxxxx"
                    value={newBranchManagerPhone}
                    onChange={(e) => setNewBranchManagerPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">{isRtl ? 'رابط خريطة الفرع (خرائط جوجل)' : 'Google Map Link'}</label>
                  <input
                    type="text"
                    placeholder="https://maps.google.com/..."
                    value={newBranchLocationUrl}
                    onChange={(e) => setNewBranchLocationUrl(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-800 font-mono text-left"
                  />
                </div>
              </div>

              {/* Branch Address & Specialist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">{isRtl ? 'العنوان التفصيلي للفرع' : 'Branch Address Text'}</label>
                  <input
                    type="text"
                    placeholder={isRtl ? 'حي العليا - شارع التحلية' : 'e.g., Olaya Dist, Tahlia St.'}
                    value={newBranchAddress}
                    onChange={(e) => setNewBranchAddress(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">{isRtl ? 'الفني المسؤول عن هذا الفرع *' : 'Assigned Technician for this Branch *'}</label>
                  <select
                    value={newBranchTech}
                    onChange={(e) => setNewBranchTech(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-805 cursor-pointer text-start"
                  >
                    <option value="">{isRtl ? 'اختر الفني المسؤول عن هذا الفرع *' : 'Select Technician *'}</option>
                    {technicians.filter(u => u.role !== 'admin').map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.name} ({tech.phone})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Branch Contract Number & Extinguisher expiry */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">{isRtl ? 'رقم عقد الفرع' : 'Branch Contract Number'}</label>
                  <input
                    type="text"
                    placeholder={isRtl ? 'رقم عقد هذا الفرع الفرعي' : 'Contract number for this branch'}
                    value={newBranchContractNumber}
                    onChange={(e) => setNewBranchContractNumber(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">🧯 {isRtl ? 'تاريخ صلاحية طفايات الحريق للفرع' : 'Branch Fire Extinguisher Expiry'}</label>
                  <input
                    type="date"
                    value={newBranchFireExtinguisherExpiry}
                    onChange={(e) => setNewBranchFireExtinguisherExpiry(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-800 font-mono"
                  />
                </div>
              </div>

              {/* Branch Contract File Attachment */}
              <div className="flex flex-col gap-1 justify-center pt-2 md:pt-4">
                <label className="text-[11px] font-bold text-slate-600 block">
                  📄 {isRtl ? 'ملحق ملف عقد الفرع' : 'Branch Contract File Attachment'}
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  disabled={isUploadingBranchContract}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    if (file.size > 10 * 1024 * 1024) {
                      alert(isRtl 
                        ? `تنبيه: حجم ملف عقد الفرع المرفوع يتجاوز الحد المسموح به (10 ميجابايت).` 
                        : `Warning: The uploaded branch contract file size exceeds 10 MB.`
                      );
                      return;
                    }

                    setIsUploadingBranchContract(true);
                    const reader = new FileReader();
                    reader.onload = async () => {
                      const result = reader.result as string;
                      if (!result) {
                        setIsUploadingBranchContract(false);
                        return;
                      }
                      try {
                        const base64Content = result.split(',')[1];
                        const response = await fetch('/api/upload', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: file.name, type: file.type, base64: base64Content })
                        });
                        const uploadRes = await response.json();
                        if (uploadRes.success) {
                          setNewBranchContractFile({
                            name: file.name,
                            url: uploadRes.url,
                            size: (file.size / (1024 * 1024)).toFixed(2) + ' MB'
                          });
                        } else {
                          throw new Error(uploadRes.error || 'Server upload failed');
                        }
                      } catch (err) {
                        console.error("Branch contract upload error", err);
                        alert(isRtl 
                          ? 'فشل رفع ملف عقد الفرع للموقع. يرجى المحاولة مرة أخرى أو التأكد من استقرار اتصالك بالإنترنت.' 
                          : 'Failed to upload branch contract file. Please try again or check your internet connection.'
                        );
                        setNewBranchContractFile(null);
                      } finally {
                        setIsUploadingBranchContract(false);
                      }
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200 cursor-pointer disabled:opacity-50"
                />
                {isUploadingBranchContract && (
                  <div className="flex items-center gap-2 text-[10px] text-teal-700 font-bold bg-teal-50/50 p-1.5 rounded-lg border border-teal-100 animate-pulse">
                    <span>⏳ {isRtl ? 'جاري رفع ملف عقد الفرع سحابياً...' : 'Uploading branch contract file...'}</span>
                  </div>
                )}
                {newBranchContractFile && (
                  <div className="flex items-center justify-between text-[10px] bg-teal-50 text-teal-800 border border-teal-100 p-1.5 rounded-lg">
                    <span className="truncate max-w-[130px] font-bold">✓ {newBranchContractFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setNewBranchContractFile(null)}
                      className="text-rose-600 hover:text-rose-800 font-bold px-1 text-xs cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>

            </div>

            {/* Branch Add Button / Select For Edit button */}
            <div className="flex justify-end items-center gap-2 pt-2">
              {editingBranchId && (
                <button
                  type="button"
                  onClick={() => {
                    setNewBranchName('');
                    setNewBranchAddress('');
                    setNewBranchLocationUrl('');
                    setNewBranchManagerPhone('');
                    setNewBranchTech('');
                    setNewBranchContractNumber('');
                    setNewBranchContractFile(null);
                    setNewBranchFireExtinguisherExpiry('');
                    setEditingBranchId(null);
                  }}
                  className="px-4 py-2 bg-slate-200 text-slate-750 hover:bg-slate-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>✕ {isRtl ? 'إلغاء التعديل' : 'Cancel Edit'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!newBranchName.trim()) {
                    alert(isRtl ? 'الرجاء إدخال اسم الفرع!' : 'Please enter the branch name!');
                    return;
                  }
                  if (!newBranchTech) {
                    alert(isRtl ? 'الرجاء اختيار الفني المسؤول عن هذا الفرع!' : 'Please choose the technician for this branch!');
                    return;
                  }
                  if (editingBranchId) {
                    setNewClientBranches(prev => prev.map(item => {
                      if (item.id === editingBranchId) {
                        return {
                          ...item,
                          name: newBranchName.trim(),
                          city: newBranchCity,
                          locationText: newBranchAddress.trim() || undefined,
                          locationUrl: newBranchLocationUrl.trim() || undefined,
                          managerPhone: newBranchManagerPhone.trim() || undefined,
                          assignedTechnicianId: newBranchTech,
                          contractNumber: newBranchContractNumber.trim() || undefined,
                          contractFile: newBranchContractFile ? {
                            name: newBranchContractFile.name,
                            url: newBranchContractFile.url,
                            uploadedAt: item.contractFile?.uploadedAt || new Date().toISOString(),
                            size: newBranchContractFile.size
                          } : undefined,
                          fireExtinguisherExpiry: newBranchFireExtinguisherExpiry.trim() || undefined,
                          contractStartDate: newBranchContractStartDate || undefined,
                          contractDurationYears: newBranchContractDurationYears || undefined,
                          contractEndDate: newBranchContractEndDate || undefined
                        };
                      }
                      return item;
                    }));
                    setEditingBranchId(null);
                  } else {
                    const b: Branch = {
                      id: `branch_add_${Date.now()}`,
                      name: newBranchName.trim(),
                      city: newBranchCity,
                      locationText: newBranchAddress.trim() || undefined,
                      locationUrl: newBranchLocationUrl.trim() || undefined,
                      managerPhone: newBranchManagerPhone.trim() || undefined,
                      assignedTechnicianId: newBranchTech,
                      contractNumber: newBranchContractNumber.trim() || undefined,
                      contractFile: newBranchContractFile ? {
                        name: newBranchContractFile.name,
                        url: newBranchContractFile.url,
                        uploadedAt: new Date().toISOString(),
                        size: newBranchContractFile.size
                      } : undefined,
                      fireExtinguisherExpiry: newBranchFireExtinguisherExpiry.trim() || undefined,
                      contractStartDate: newBranchContractStartDate || undefined,
                      contractDurationYears: newBranchContractDurationYears || undefined,
                      contractEndDate: newBranchContractEndDate || undefined
                    };
                    setNewClientBranches(prev => [...prev, b]);
                  }
                  // Reset branch fields
                  setNewBranchName('');
                  setNewBranchAddress('');
                  setNewBranchLocationUrl('');
                  setNewBranchManagerPhone('');
                  setNewBranchTech('');
                  setNewBranchContractNumber('');
                  setNewBranchContractFile(null);
                  setNewBranchFireExtinguisherExpiry('');
                }}
                className={`px-5 py-2 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow transition-colors cursor-pointer ${
                  editingBranchId ? 'bg-amber-600 hover:bg-amber-750' : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                <span>{editingBranchId ? '💾' : '➕'} {editingBranchId ? (isRtl ? 'حفظ تعديلات الفرع' : 'Save Branch Details') : (isRtl ? 'إضافة الفرع للمنشأة' : 'Add Branch')}</span>
              </button>
            </div>

            {/* Added Branches List (Renders inside section) */}
            {newClientBranches.length > 0 ? (
              <div className="space-y-2 pt-3 border-t border-slate-200">
                <span className="text-xs text-slate-500 font-bold block">{isRtl ? 'الفروع المضافة للمنشأة حالياً (اضغط لتعديل أي فرع):' : 'Currently added branches (Click to edit any branch):'}</span>
                <div className="grid grid-cols-1 gap-2">
                  {newClientBranches.map((br) => {
                    const isUnderEditing = editingBranchId === br.id;
                    return (
                      <div
                        key={br.id}
                        onClick={() => handleSelectBranchForEditing(br)}
                        className={`p-3 rounded-xl border flex items-center justify-between text-xs group cursor-pointer transition-all ${
                          isUnderEditing
                            ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-100 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50'
                        }`}
                        title={isRtl ? 'اضغط لتعديل أو الاطلاع على بيانات هذا الفرع' : 'Click to edit or inspect this branch\'s data'}
                      >
                        <div className="flex flex-wrap gap-x-2 items-center text-slate-705">
                          <span className="font-bold text-teal-850 flex items-center gap-1">
                            📍 {br.name}
                            {isUnderEditing && (
                              <span className="text-[10px] bg-amber-500 text-white font-semibold rounded px-1 animate-pulse">
                                {isRtl ? 'جاري التعديل' : 'Editing'}
                              </span>
                            )}
                          </span>
                          <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded font-bold">{br.city}</span>
                          {br.managerPhone && <span className="font-mono text-slate-500">📞 {br.managerPhone}</span>}
                          {br.contractNumber && (
                            <span className="bg-blue-50 text-blue-800 text-[10px] px-2 py-0.5 rounded font-bold border border-blue-100">
                              📑 {isRtl ? `عقد: ${br.contractNumber}` : `Contract: ${br.contractNumber}`}
                            </span>
                          )}
                          {br.assignedTechnicianId && (
                            <span className="bg-amber-50 text-amber-850 text-[10px] px-2 py-0.5 rounded font-bold border border-amber-100/50">
                              👷‍♂️ {technicians.find(t => t.id === br.assignedTechnicianId)?.name}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-4 text-center bg-white rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                {isRtl ? 'لا يوجد فروع مضافة حالياً. سيتم استخدام العنوان العام للمنشأة.' : 'No branches configured yet. Primary address will be designated.'}
              </div>
            )}

          </div>

          {/* Portal login credentials configuration card */}
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
            <span className="text-sm font-extrabold text-slate-950 block border-b border-slate-200 pb-2 flex items-center gap-2">
              🔑 {isRtl ? 'بيانات حساب الدخول المخصص للعميل للبوابة' : 'Client Portal Account Credentials'}
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  {isRtl ? 'اسم المستخدم لبوابة العميل *' : 'Client Portal Username *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isRtl ? 'مثال: shifa_hospital' : 'e.g. client_shifa'}
                  value={newClientUsername}
                  onChange={(e) => setNewClientUsername(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-800"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  {isRtl ? 'كلمة المرور (الباسوورد) *' : 'Password *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="123"
                  value={newClientPassword}
                  onChange={(e) => setNewClientPassword(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-850"
                />
              </div>
            </div>
          </div>

          {/* Informative Auto scheduler description badge */}
          <div className="p-4 bg-sky-50 text-sky-850 rounded-2xl border border-sky-100 text-xs leading-relaxed font-semibold">
            {t.smartSchedulerNote.replace('{count}', newClientFrequency).replace('{date}', newClientStartDate)}
          </div>

          {/* Submit & Reset actions */}
          <div className="flex gap-3 pt-6 border-t border-slate-200 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-3 bg-slate-150 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition border border-slate-200"
            >
              {t.cancelBtn}
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-safety-emerald hover:bg-teal-900 text-white text-xs font-extrabold rounded-xl transition shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <span>💾</span>
              <span>{isRtl ? 'حفظ العقد والمنشأة وجدولة الصيانة السنوية' : 'Save & Schedule Annual Maintenance'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
