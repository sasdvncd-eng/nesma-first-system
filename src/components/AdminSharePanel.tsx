import { useState } from 'react';
import { Technician, Client } from '../types';
import { 
  Share2, Smartphone, Copy, Check, ExternalLink, Send, ShieldCheck, FileText 
} from 'lucide-react';

interface AdminSharePanelProps {
  isRtl: boolean;
  t: any;
  adminUsername: string;
  adminPassword: string;
  technicians: Technician[];
  clients: Client[];
  getPublicSharedUrl: () => string;
  getShareTextForWhatsapp: (tech?: Technician) => string;
}

export function AdminSharePanel({
  isRtl,
  t,
  adminUsername,
  adminPassword,
  technicians,
  clients,
  getPublicSharedUrl,
  getShareTextForWhatsapp
}: AdminSharePanelProps) {
  // Sharing States
  const [copied, setCopied] = useState(false);
  const [copiedDirectPublic, setCopiedDirectPublic] = useState(false);
  const [selectedShareTechId, setSelectedShareTechId] = useState('');
  const [shareMessageText, setShareMessageText] = useState('');

  // Custom Direct Link Generator States
  const [directLinkRole, setDirectLinkRole] = useState<'admin' | 'tech' | 'client'>('tech');
  const [directLinkTechId, setDirectLinkTechId] = useState<string>('');
  const [directLinkClientId, setDirectLinkClientId] = useState<string>('');
  const [copiedDirect, setCopiedDirect] = useState(false);

  return (
    <div className="space-y-6 animate-fade-in text-start">
      
      {/* Header info banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 text-white rounded-3xl p-6 shadow-xl border border-slate-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-500/10 text-teal-400 font-semibold text-xs rounded-full border border-teal-500/15">
            <Share2 className="w-3.5 h-3.5" />
            <span>{isRtl ? 'أنظمة النشر والتشغيل للهندسة الميدانية' : 'Mobile Distribution Console'}</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">{isRtl ? 'تجهيز ومشاركة التطبيق على الجوال' : 'PWA Mobile App Distribution & Install'}</h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            {isRtl 
              ? 'منصة شركة نسما الأولى مجهزة بتقنية تشغيل الويب التقدمية PWA. يمكنك توليد روابط مشاركة فورية للفنيين، إرسال تفاصيل الدخول التلقائية عبر الواتساب، ورؤية كيفية تثبيتها على الشاشة الرئيسية برمز الشعار المعتمد.' 
              : 'The Nesma First platform is built on Progressive Web App standards. Generate customized install invitations, send automated login links directly to technicians via WhatsApp, and review home-screen setup guidelines with the official Nesma First logo badge.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Box 1: Dynamic Link and QR Code Generation */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Smartphone className="w-5 h-5 text-safety-emerald" />
              <h3 className="font-bold text-slate-900 text-sm">
                {isRtl ? 'رابط الوصول للهواتف الذكية وتخطي تسجيل الدخول' : 'App Access Links & Bypass Login'}
              </h3>
            </div>

            {/* Info Alert Box for clarifying Google Sign-in & Public access URLs */}
            <div className="p-4 bg-teal-50 border border-teal-200/60 rounded-2xl text-xs space-y-2.5">
              <span className="font-bold text-teal-950 block flex items-center gap-1.5">
                💡 {isRtl ? 'هام جداً لتشغيل التطبيق على هواتف الفنيين وبدون تسجيل دخول جوجل:' : 'Important checklist for Technician access:'}
              </span>
              <div className="text-slate-750 leading-relaxed space-y-1.5">
                <p>
                  {isRtl 
                    ? '1. 🔐 لماذا طلب مني تسجيل دخول جوجل؟ لأن الرابط الطويل (رابط خادم التطوير) مخصص للمطور فقط. عند فتح التطبيق من جوال آخر أو متصفح خارجي، يجب استخدام الرابط العام المشترك (Shared URL) أدناه لتخطي حماية جوجل تماماً.'
                    : '1. 🔐 Why did it ask for Google login? The Dev URL is private. To enable public access for technicians on other browsers or phones without Google sign-in, use the General Shared URL generated below.'}
                </p>
                <p>
                  {isRtl 
                    ? '2. 📲 هل يلزم وجود تطبيق جيميني؟ لا على الإطلاق! التطبيق عبارة عن موقع ويب متطور (PWA)، يعمل مباشرة من المتصفح دون الحاجة لتحميل أي تطبيقات مساعدة أو خدمات خارجية.'
                    : '2. 📲 Is Gemini app required? Absolutely not! The platform is a Progressive Web App (PWA) that runs instantly inside any default browser (Safari, Chrome) without downloading anything from App Stores.'}
                </p>
                <p>
                  {isRtl 
                    ? '3. 🖥️ طريقة التثبيت كأيقونة: عند فتح الرابط العام من هاتف الفني، انقر على زر "مشاركة" بالمتصفح ثم اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen) ليظهر كتطبيق مثبت رسمي.'
                    : '3. 🖥️ Install as Home icon: Open the public link on mobile, tap "Share" (iOS) or the menu button (Android) and choose "Add to Home Screen" to install as a native-behaving app icon.'}
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Official Public Direct Access Link (Bypasses Google & AI Studio login + Auto-enters system) */}
              <div className="p-5 sm:p-6 bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 text-white rounded-3xl border border-teal-500/30 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">⚡</span>
                    <div>
                      <h4 className="font-extrabold text-sm sm:text-base text-white">
                        {isRtl ? 'الرابط العام المباشر للنظام (بدون تسجيل دخول - بدون جوجل استديو)' : 'Official Public Direct Link (No Google / AI Studio Login)'}
                      </h4>
                      <p className="text-[11px] text-teal-300 font-sans mt-0.5">
                        {isRtl 
                          ? 'رابط عام ومفتوح 100% يسمح لك وللفنيين بالدخول للنظام مباشرة دون طلب حساب جوجل أو تسجيل الدخول' 
                          : '100% open public link granting instant direct access without Google sign-in or AI Studio accounts'}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[11px] font-bold w-fit">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    {isRtl ? 'مفتوح وعام للجميع' : 'Public & Direct'}
                  </span>
                </div>

                {/* Primary Direct Link Box */}
                <div>
                  <span className="text-xs font-bold text-slate-300 block mb-1.5">
                    {isRtl ? 'رابط الدخول الفوري المباشر للوحة التحكم:' : 'Direct Dashboard Access Link:'}
                  </span>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1 bg-slate-900/90 border border-teal-500/40 rounded-xl px-4 py-3 text-xs font-mono text-emerald-300 select-all flex items-center font-bold overflow-x-auto whitespace-nowrap shadow-inner">
                      {`${getPublicSharedUrl()}/?direct=admin`}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const directUrl = `${getPublicSharedUrl()}/?direct=admin`;
                          navigator.clipboard.writeText(directUrl);
                          setCopiedDirectPublic(true);
                          setTimeout(() => setCopiedDirectPublic(false), 2000);
                        }}
                        className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition bg-emerald-500 hover:bg-emerald-600 text-slate-950 cursor-pointer shadow-md shadow-emerald-500/20 font-sans"
                      >
                        {copiedDirectPublic ? <Check className="w-4 h-4 text-slate-950 font-bold" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedDirectPublic ? (isRtl ? 'تم النسخ!' : 'Copied!') : (isRtl ? 'نسخ الرابط المباشر' : 'Copy Direct Link')}</span>
                      </button>
                      <a
                        href={`${getPublicSharedUrl()}/?direct=admin`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition bg-white/10 hover:bg-white/20 text-white border border-white/15 cursor-pointer font-sans"
                        title={isRtl ? 'فتح الرابط في نافذة جديدة' : 'Open in new tab'}
                      >
                        <ExternalLink className="w-4 h-4 text-emerald-300" />
                        <span className="hidden sm:inline">{isRtl ? 'فتح للتجربة' : 'Open'}</span>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Secondary Base Link */}
                <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-300 text-[11px] overflow-hidden text-ellipsis">
                    <span className="text-slate-400 font-sans">{isRtl ? 'الرابط العام الأساسي:' : 'Base Public URL:'}</span>
                    <span className="font-mono text-teal-300 text-[11px] truncate">{getPublicSharedUrl()}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(getPublicSharedUrl());
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="text-[11px] font-bold text-teal-300 hover:text-teal-200 flex items-center gap-1 transition cursor-pointer self-end sm:self-auto"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? (isRtl ? 'تم النسخ!' : 'Copied!') : (isRtl ? 'نسخ الأساسي فقط' : 'Copy Base Only')}</span>
                  </button>
                </div>

                {/* Benefits / Guarantees Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="bg-white/5 border border-white/10 p-3 rounded-2xl">
                    <span className="text-base block mb-1">🛡️</span>
                    <span className="font-bold text-xs text-white block mb-0.5">
                      {isRtl ? 'بدون جوجل أو استديو' : 'No Google Sign-in'}
                    </span>
                    <p className="text-[10px] text-slate-300 leading-relaxed font-sans">
                      {isRtl 
                        ? 'يعمل مباشرة على أي هاتف أو جهاز كمبيوتر دون طلب حساب جوجل.' 
                        : 'Loads on any device without requiring Google or AI Studio credentials.'}
                    </p>
                  </div>

                  <div className="bg-white/5 border border-white/10 p-3 rounded-2xl">
                    <span className="text-base block mb-1">⚡</span>
                    <span className="font-bold text-xs text-white block mb-0.5">
                      {isRtl ? 'دخول مباشر فوري' : 'Instant Direct Entry'}
                    </span>
                    <p className="text-[10px] text-slate-300 leading-relaxed font-sans">
                      {isRtl 
                        ? 'يتجاوز شاشة الدخول ويفتح لوحة التحكم فوراً بكامل الصلاحيات.' 
                        : 'Bypasses login gates directly into the full admin workspace.'}
                    </p>
                  </div>

                  <div className="bg-white/5 border border-white/10 p-3 rounded-2xl">
                    <span className="text-base block mb-1">📲</span>
                    <span className="font-bold text-xs text-white block mb-0.5">
                      {isRtl ? 'جاهز للتثبيت كـ PWA' : 'Installable PWA'}
                    </span>
                    <p className="text-[10px] text-slate-300 leading-relaxed font-sans">
                      {isRtl 
                        ? 'يدعم التثبيت كأيقونة على الشاشة الرئيسية بشعار شركة نسما الأولى.' 
                        : 'Pin to home screen as a standalone app with the official Nesma badge.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Clarified direct communication redirect */}
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-1.5">
                  {isRtl ? 'رابط الوصول التلقائي المباشر المخصص (لتسجيل الدخول الفوري دون طلب كلمة مرور):' : 'Generate Direct Auto-Login Link (Bypasses logins/passwords):'}
                </span>
                
                {/* Role selector tabs */}
                <div className="flex gap-1 mb-2 bg-slate-100 p-1 rounded-xl w-fit">
                  <button
                    type="button"
                    onClick={() => setDirectLinkRole('admin')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      directLinkRole === 'admin' 
                        ? 'bg-slate-900 text-white shadow-sm' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    {isRtl ? 'حساب المدير' : 'Administrator'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDirectLinkRole('tech');
                      if (technicians.length > 0 && !directLinkTechId) {
                        setDirectLinkTechId(technicians[0].id);
                      }
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      directLinkRole === 'tech' 
                        ? 'bg-slate-900 text-white shadow-sm' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    {isRtl ? 'الفنيين الميدانيين' : 'Technicians'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDirectLinkRole('client');
                      if (clients.length > 0 && !directLinkClientId) {
                        setDirectLinkClientId(clients[0].id);
                      }
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      directLinkRole === 'client' 
                        ? 'bg-slate-900 text-white shadow-sm' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    {isRtl ? 'العملاء / المنشآت' : 'Clients'}
                  </button>
                </div>

                {/* Conditional Selectors */}
                {directLinkRole === 'tech' && technicians.length > 0 && (
                  <div className="mb-2">
                    <select
                      value={directLinkTechId}
                      onChange={(e) => setDirectLinkTechId(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-safety-emerald font-sans font-medium"
                    >
                      {technicians.filter(u => u.role !== 'admin').map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.phone})</option>
                      ))}
                    </select>
                  </div>
                )}

                {directLinkRole === 'client' && clients.length > 0 && (
                  <div className="mb-2">
                    <select
                      value={directLinkClientId}
                      onChange={(e) => setDirectLinkClientId(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-safety-emerald font-sans font-medium max-w-xs"
                    >
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Calculated Direct Login Link */}
                {(() => {
                  let generatedUrl = getPublicSharedUrl();
                  if (directLinkRole === 'admin') {
                    generatedUrl = `${getPublicSharedUrl()}/?u=${encodeURIComponent(adminUsername)}&p=${encodeURIComponent(adminPassword)}`;
                  } else if (directLinkRole === 'tech') {
                    const targetTech = technicians.find(t => t.id === directLinkTechId) || technicians[0];
                    if (targetTech) {
                      generatedUrl = `${getPublicSharedUrl()}/?u=${encodeURIComponent(targetTech.username || targetTech.id)}&p=${encodeURIComponent(targetTech.password || '123')}`;
                    }
                  } else if (directLinkRole === 'client') {
                    const targetClient = clients.find(c => c.id === directLinkClientId) || clients[0];
                    if (targetClient) {
                      generatedUrl = `${getPublicSharedUrl()}/?u=${encodeURIComponent(targetClient.username || targetClient.id)}&p=${encodeURIComponent(targetClient.password || '123')}`;
                    }
                  }

                  return (
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 bg-slate-100/60 border border-slate-200 border-dashed rounded-xl px-4 py-3 text-xs font-mono font-bold text-sky-850 break-all flex items-center justify-between overflow-x-auto whitespace-nowrap">
                        <span>{generatedUrl}</span>
                        <span className="text-[10px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-md font-sans border border-sky-200 shrink-0 ml-2">
                          {isRtl ? 'موثوق ودخول فوري مباشر' : 'Instant Bypass Access'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedUrl);
                          setCopiedDirect(true);
                          setTimeout(() => setCopiedDirect(false), 2000);
                        }}
                        className="px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 bg-sky-50 hover:bg-sky-100 text-sky-850 border border-sky-150 transition cursor-pointer shrink-0"
                      >
                        {copiedDirect ? <Check className="w-4 h-4 text-emerald-600 animate-pulse" /> : <Copy className="w-4 h-4 text-sky-600" />}
                        <span>{copiedDirect ? (isRtl ? 'تم نسخ الرابط المباشر!' : 'Link Copied!') : (isRtl ? 'نسخ ومشاركة' : 'Copy & Share')}</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150 flex flex-col md:flex-row items-center gap-6">
              {/* Dynamic clean QR code using the Direct Public Access URL */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm shrink-0 flex items-center justify-center">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${getPublicSharedUrl()}/?direct=admin`)}`}
                  alt="Nesma Application QR Code"
                  className="w-32 h-32 select-none"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="space-y-2 text-center md:text-start">
                <h4 className="font-bold text-slate-950 text-xs text-start">
                  {isRtl ? 'رمز الاستجابة السريعة QR للدخول المباشر (صالح لجميع الهواتف)' : 'Public Direct QR Code (Instant Access on All Phones)'}
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed max-w-sm text-start font-sans">
                  {isRtl 
                    ? 'امسح هذا الرمز بكاميرا الجوال، وسيفتح لك النظام مباشرة بدون طلب تسجيل دخول وبدون الحاجة لحساب جوجل أو جوجل استديو.' 
                    : 'Scan this QR code using any mobile camera to enter the system immediately without password prompts or Google accounts.'}
                </p>
                <div className="pt-1.5 flex justify-center md:justify-start">
                  <a 
                    href={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(`${getPublicSharedUrl()}/?direct=admin`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-safety-emerald hover:text-teal-900 transition font-sans"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{isRtl ? 'فتح الرمز المباشر بدقة عالية للطباعة والمسح' : 'Open high-res direct QR Code'}</span>
                  </a>
                </div>
              </div>
            </div>

          </div>

          {/* Box 1.2: Interactive Custom messaging for technicians and supervisors */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Send className="w-5 h-5 text-safety-emerald" />
              <h3 className="font-bold text-slate-900 text-sm">
                {isRtl ? 'مُرسل الدعوات السريعة للفنيين (واتساب / رسائل)' : 'Quick Dispatch & Invite Service'}
              </h3>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isRtl ? 'اختر الفني الميداني المستهدف:' : 'Select Target Technician:'}
                  </label>
                  <select
                    value={selectedShareTechId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedShareTechId(val);
                      const chosenTech = technicians.find(t => t.id === val);
                      const message = getShareTextForWhatsapp(chosenTech);
                      setShareMessageText(message);
                    }}
                    className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-800"
                  >
                    <option value="">{isRtl ? '-- اختيار فني معتمد --' : '-- Choose registered tech --'}</option>
                    {technicians.filter(u => u.role !== 'admin').map(tech => (
                      <option key={tech.id} value={tech.id}>
                        {tech.name} ({tech.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isRtl ? 'طريقة إرسال الموثوقة الكبرى:' : 'Major Sharing Gateway:'}
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!selectedShareTechId}
                      onClick={() => {
                        const tech = technicians.find(t => t.id === selectedShareTechId);
                        if (!tech) return;
                        const link = `https://api.whatsapp.com/send?phone=${tech.phone.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(shareMessageText)}`;
                        window.open(link, '_blank');
                      }}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                        selectedShareTechId 
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500' 
                          : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      }`}
                    >
                      <span>💬</span>
                      <span>{isRtl ? 'دعوة وإرسال فوري عبر واتساب' : 'Invite via WhatsApp'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Message editor box */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {isRtl ? 'نص رسالة الدعوة الفورية (اضغط للتعديل والنسخ):' : 'Invitation Message Text (Click to edit/copy):'}
                </label>
                <textarea
                  value={shareMessageText}
                  onChange={(e) => setShareMessageText(e.target.value)}
                  placeholder={isRtl ? 'حدد فني من الخيارات بالأعلى لتوليد رسالة دعوة شاملة محددة باسمه وحسابه تلقائياً' : 'Select a technician above to construct custom login details.'}
                  className="w-full h-36 px-4 py-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-safety-emerald text-slate-800 font-sans leading-relaxed resize-none"
                />
                <div className="flex justify-between items-center mt-1 text-[11px]">
                  <span className="text-slate-500">
                    {isRtl ? '* يتضمن الاختصار التلقائي لضمان الموثوقية التثبيت السلس' : '* Contains PWA URL, username, and password instructions'}
                  </span>
                  {shareMessageText && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(shareMessageText);
                        alert(isRtl ? 'تم نسخ نص الدعوة وهيكل الدخول الخاصين بالفني المختار بنجاح!' : 'Invitation text copied!');
                      }}
                      className="font-bold text-safety-emerald hover:text-teal-900 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{isRtl ? 'نسخ النص بالكامل' : 'Copy Full Message'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Box 2: Icon details and Home screen guidelines */}
        <div className="space-y-6">
          
          {/* Box 2.1: Beautiful PWA Launcher Icon showcase */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm text-center space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-start">
              <ShieldCheck className="w-5 h-5 text-safety-emerald" />
              <h3 className="font-bold text-slate-900 text-sm">
                {isRtl ? 'أيجونة الهوية ورمز التطبيق الموثق' : 'Official Launcher Icon'}
              </h3>
            </div>

            <div className="relative py-4 flex flex-col items-center justify-center">
              {/* Smartphone visual frame showing the Nesma First App Logo */}
              <div className="w-28 h-28 bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl p-1.5 shadow-xl border-2 border-slate-700 relative group transition-all duration-300 hover:scale-105">
                {/* SVG app logo loaded */}
                <img 
                  src="/logo_nesma.png?v=2" 
                  alt="Nesma First Logo" 
                  className="w-full h-full rounded-xl select-none"
                  referrerPolicy="no-referrer"
                />
                {/* Shadow indicators */}
                <div className="absolute -bottom-1 left-4 right-4 h-2 bg-black/40 blur-sm rounded-full"></div>
              </div>
              
              <span className="mt-4 font-bold text-xs text-slate-900 block font-sans">
                Nesma First
              </span>
              <span className="text-[10px] text-slate-500 block">
                {isRtl ? 'أيقونة الشاشة المدمجة الـ PWA' : 'Official Home-Screen Symbol'}
              </span>
            </div>

            <div className="bg-teal-50 text-teal-950 p-4 border border-teal-150 rounded-xl text-[11px] leading-relaxed text-start space-y-1 font-sans">
              <span className="font-bold text-teal-900 block mb-0.5">
                {isRtl ? 'هل شعار الشركة مرفوع وجاهز للظهور؟' : 'Is Company Icon Configured?'}
              </span>
              <p>
                {isRtl 
                  ? 'نعم بكل تأكيد! تم دمج شعار شركة نسما الأولى الفاخر وطابع مكافحة الحريق والوقاية المعتمد داخل رمز التطبيق المدمج (PWA) بصيغة فائقة الوضوح. بمجرد إضافة التطبيق لسطح المكتب في هواتفكم سيظهر بهذا الشعار فوراً.' 
                  : 'Yes indeed! Company design is permanently integrated. A beautiful logo vector is preconfigured responsive across Apple retina displays and major Android devices so that it loads like a native store application.'}
              </p>
            </div>
          </div>

          {/* Box 2.2: iOS and Android detailed installation cards */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <FileText className="w-5 h-5 text-safety-emerald" />
              <h3 className="font-bold text-slate-900 text-sm">
                {isRtl ? 'طريقة وحيل التثبيت على الهاتف' : 'PWA Install Guide'}
              </h3>
            </div>

            {/* iPhone setup guidelines */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                <span></span>
                <span>{isRtl ? 'على هواتف آيفون (سفاري):' : 'On iOS iPhones (Safari):'}</span>
              </div>
              <ol className="text-[11px] text-slate-650 space-y-2 list-decimal list-inside px-1 leading-relaxed text-right dir-rtl font-sans">
                <li>{isRtl ? 'افتح رابط المنصة باستخدام متصفح سـفـاري (Safari).' : 'Open the application link in Safari.'}</li>
                <li>
                  {isRtl 
                    ? 'انقر على رمز مشاركة (Share) 🔗 في أسفل شاشه المتصفح.' 
                    : 'Tap the "Share" button 🔗 at the bottom navigation drawer.'}
                </li>
                <li>
                  {isRtl 
                    ? 'اختر من الخيارات "إضافة إلى الشاشة الرئيسية" (Add to Home Screen) ➕.' 
                    : 'Select "Add to Home Screen" ➕.'}
                </li>
                <li>{isRtl ? 'اضغط إضافة (Add). ستجد رمز نسما الاولى ظهر على هاتفك كأنه تطبيق جوال مستقل!' : 'Click Add to pin it with the beautiful fire insignia.'}</li>
              </ol>
            </div>

            {/* Android Setup guidelines */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-900 bg-sky-50 px-3 py-2 rounded-lg border border-sky-100">
                <span>🤖</span>
                <span>{isRtl ? 'على هواتف أندرويد (جوجل كروم):' : 'On Android phones (Chrome):'}</span>
              </div>
              <ol className="text-[11px] text-slate-650 space-y-2 list-decimal list-inside px-1 leading-relaxed text-right dir-rtl font-sans">
                <li>{isRtl ? 'افتح رابط المنصة في متصفح كــروم (Chrome).' : 'Load the system link within Google Chrome.'}</li>
                <li>
                  {isRtl 
                    ? 'اضغط على رمز النقاط الثلاث ⁝ في أعلى يمين المتصفح.' 
                    : 'Click on the trailing 3-dots menu button ⁝.'}
                </li>
                <li>
                  {isRtl 
                    ? 'اختر "تثبيت التطبيق" (Install) أو "إضافة إلى الشاشة الرئيسية".' 
                    : 'Select "Install App" or "Add to Home Screen" options.'}
                </li>
                <li>{isRtl ? 'انتظر ثوان وستجده مثبت كأيقونة نسما الاولى على شاشتك وجاهز للتشغيل الفوري.' : 'It registers desktop wide with full native styling.'}</li>
              </ol>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
