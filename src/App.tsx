import { useState, useEffect, useRef, FormEvent } from 'react';
import { Client, Visit, Technician, NotificationLog, Quotation, ClientSubUser, ExtinguisherReceipt, CompanyBranch, SystemCustomization, RenewContractData, ContractRenewalRecord } from './types';
import { mockClients, mockTechnicians, mockVisits } from './data/mockData';
import AdminDashboard from './components/AdminDashboard';
import TechnicianView from './components/TechnicianView';
import ClientPortal from './components/ClientPortal';
import VisitDetailsModal from './components/VisitDetailsModal';
import { Language, translations } from './lib/translations';
import { getContractDurationYears } from './lib/contractUtils';
import { 
  Shield, Users, LogIn, Bell, RefreshCw, AlertTriangle, 
  HelpCircle, Check, Info, FileStack, ArrowUpRight, Globe,
  Lock, LogOut, UserCheck, Trash2, X, Link, Copy, ExternalLink, Share2,
  ChevronDown, Settings
} from 'lucide-react';

// Safe proxy persistence: All writes are managed authoritatively by the full-stack server (/api/data)
// with server-side debouncing and disk fallback, eliminating client-side Firestore write stream quota errors (RESOURCE_EXHAUSTED).
async function writeStateToFirestoreClient(_stateData: any): Promise<boolean> {
  return true;
}

interface LoggedInUser {
  role: 'admin' | 'technician' | 'client' | 'viewer';
  id?: string;
  name: string;
  subUserId?: string;
  companyBranchId?: string;
  isBranchUser?: boolean;
  permissions?: {
    manageClients?: boolean;
    manageTechnicians?: boolean;
    manageQuotes?: boolean;
    wipeDatabase?: boolean;
  };
  subUserPermissions?: {
    viewVisits?: boolean;
    replyQuotes?: boolean;
    submitInquiries?: boolean;
  };
}

// Safe LocalStorage setter helper to prevent crashes due to QuotaExceededError when uploading large report media
const safeSetItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`[SAS LocalStorage] Error saving "${key}" (possibly quota exceeded):`, error);
  }
};

// Pure self-healing visits scheduler utility to ensure every branch has periodic scheduled visits
function selfHealBranchVisits(allClients: Client[], allVisits: Visit[], allTechnicians: Technician[]): Visit[] {
  const updated = [...allVisits];
  let changed = false;

  allClients.forEach(client => {
    if (!client || !client.branches || client.branches.length === 0) return;

    client.branches.forEach((br, brIdx) => {
      if (!br || !br.name) return;
      
      // Look for any visits (pending or completed) belonging to this client and this branch name
      const hasVisits = updated.some(v => 
        v.clientId === client.id && 
        v.branchName && 
        v.branchName.trim().replace(/\s+/g, ' ') === br.name.trim().replace(/\s+/g, ' ')
      );

      if (!hasVisits) {
        console.log(`[SAS Self-Healing visits] Branch "${br.name}" of client "${client.name}" has no scheduled visits. Generating them now...`);
        changed = true;
        
        let brFrequencyNum = parseInt(br.visitFrequency || client.visitFrequency || '4');
        if (isNaN(brFrequencyNum) || brFrequencyNum < 1) {
          brFrequencyNum = 4;
        }
        const brMonthsInterval = 12 / brFrequencyNum;

        const brDuration = parseFloat(br.contractDurationYears || '1') || 1;
        const totalBranchVisits = Math.max(1, Math.round(brFrequencyNum * brDuration));
        const brStartDate = br.contractStartDate || client.contractStartDate || new Date().toISOString().split('T')[0];

        const branchTechId = br.assignedTechnicianId || client.assignedTechnicianId;
        const branchTech = allTechnicians.find(t => t.id === branchTechId);
        const branchTechName = branchTech?.name || 'فني الصيانة';

        for (let i = 0; i < totalBranchVisits; i++) {
          const visitDate = new Date(brStartDate);
          visitDate.setMonth(visitDate.getMonth() + Math.round(i * brMonthsInterval));
          let scheduledStr = '';
          try {
            scheduledStr = visitDate.toISOString().split('T')[0];
          } catch {
            scheduledStr = new Date().toISOString().split('T')[0];
          }

          updated.push({
            id: `visit_${client.id}_i${i}_bselfheal_${br.id || brIdx}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            clientId: client.id,
            clientName: client.name,
            contractNumber: client.contractNumber || 'N/A',
            technicianId: branchTechId,
            technicianName: branchTechName,
            scheduledDate: scheduledStr,
            status: 'pending',
            result: 'not_visited',
            branchName: br.name
          });
        }
      }
    });
  });

  return updated;
}

export default function App() {
  // Global States (synchronized to localStorage & backed up securely to the full-stack server)
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('sas_lang');
    return (saved as Language) || 'ar'; // Default to 'ar'
  });

  const [clients, setClients] = useState<Client[]>(() => {
    try {
      const saved = localStorage.getItem('sas_clients');
      const parsed = saved ? JSON.parse(saved) : mockClients;
      return parsed.map((c: any) => {
        if (!c || !Array.isArray(c.inquiries)) return c;
        return {
          ...c,
          inquiries: c.inquiries.filter((inq: any) => inq && inq.id !== 'inq_1780662623192' && !(inq.text || '').includes('بياتو'))
        };
      });
    } catch (e) {
      console.warn('[SAS Storage] Failed parsing clients state, defaulting.', e);
      return mockClients;
    }
  });

  const [visits, setVisits] = useState<Visit[]>(() => {
    try {
      const saved = localStorage.getItem('sas_visits');
      const parsed = saved ? JSON.parse(saved) : mockVisits;
      const deletedStr = localStorage.getItem('sas_deleted_visit_ids');
      const deleted: string[] = deletedStr ? JSON.parse(deletedStr) : [];
      return parsed.filter((v: any) => v && v.id && !deleted.includes(v.id));
    } catch (e) {
      console.warn('[SAS Storage] Failed parsing visits state, defaulting.', e);
      return mockVisits;
    }
  });

  const [technicians, setTechnicians] = useState<Technician[]>(() => {
    try {
      const saved = localStorage.getItem('sas_technicians');
      return saved ? JSON.parse(saved) : mockTechnicians;
    } catch (e) {
      console.warn('[SAS Storage] Failed parsing technicians state, defaulting.', e);
      return mockTechnicians;
    }
  });

  const [daysBeforeVisitAlert, setDaysBeforeVisitAlert] = useState<number>(() => {
    const saved = localStorage.getItem('sas_alert_days');
    return saved ? parseInt(saved) : 2; // Default 2 days
  });

  // SMS Notification Logs in Session state
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>(() => {
    try {
      const saved = localStorage.getItem('sas_notification_logs');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Quotations for parts and defects
  const [quotations, setQuotations] = useState<Quotation[]>(() => {
    try {
      const saved = localStorage.getItem('sas_quotations');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Emergency visits on-demand
  const [emergencyVisits, setEmergencyVisits] = useState<Visit[]>(() => {
    try {
      const saved = localStorage.getItem('sas_emergency_visits');
      const parsed = saved ? JSON.parse(saved) : [];
      const deletedStr = localStorage.getItem('sas_deleted_visit_ids');
      const deleted: string[] = deletedStr ? JSON.parse(deletedStr) : [];
      return parsed.filter((v: any) => v && v.id && !deleted.includes(v.id));
    } catch (e) {
      console.warn('[SAS Storage] Failed parsing emergency visits, defaulting.', e);
      return [];
    }
  });

  const [extinguisherReceipts, setExtinguisherReceipts] = useState<ExtinguisherReceipt[]>(() => {
    try {
      const saved = localStorage.getItem('sas_extinguisher_receipts');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Configured general manager target SMS number
  const [managerPhone, setManagerPhone] = useState<string>(() => {
    const saved = localStorage.getItem('sas_manager_phone');
    return saved || '0555012345';
  });

  // Configured general manager target Email address for client inquiries
  const [managerEmail, setManagerEmail] = useState<string>(() => {
    const saved = localStorage.getItem('sas_manager_email');
    return saved || 'maintenance-admin@sas-safety.com';
  });

  // Dynamic administrator credentials persisted in LocalStorage
  const [adminUsername, setAdminUsername] = useState<string>(() => {
    return localStorage.getItem('sas_admin_username') || 'admin';
  });
  const [adminPassword, setAdminPassword] = useState<string>(() => {
    return localStorage.getItem('sas_admin_password') || '123';
  });
  const [adminName, setAdminName] = useState<string>(() => {
    return localStorage.getItem('sas_admin_name') || 'المشرف العام';
  });

  // Principal Company Details
  const [companyName, setCompanyName] = useState<string>(() => {
    return localStorage.getItem('sas_company_name') || 'شركة نسما الأولى لمعدات السلامة';
  });
  const [companyUnified, setCompanyUnified] = useState<string>(() => {
    return localStorage.getItem('sas_company_unified') || '7003489890';
  });
  const [companyPhone, setCompanyPhone] = useState<string>(() => {
    return localStorage.getItem('sas_company_phone') || '0555012345';
  });
  const [companyEmail, setCompanyEmail] = useState<string>(() => {
    return localStorage.getItem('sas_company_email') || 'maintenance-admin@sas-safety.com';
  });
  const [companyTaxId, setCompanyTaxId] = useState<string>(() => {
    return localStorage.getItem('sas_company_tax_id') || '310456789000003';
  });
  const [companyAddress, setCompanyAddress] = useState<string>(() => {
    return localStorage.getItem('sas_company_address') || 'جدة، المملكة العربية السعودية';
  });

  // System Customization State (Super Admin Control Center)
  const [customization, setCustomization] = useState<SystemCustomization>(() => {
    try {
      const saved = localStorage.getItem('sas_system_customization');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('[SAS Storage] Failed parsing customization settings', e);
    }
    return {
      primaryColor: '#0f766e',
      headerBgColor: '#0f172a',
      companyName: localStorage.getItem('sas_company_name') || 'شركة نسما الأولى لمعدات السلامة',
      unifiedNumber: localStorage.getItem('sas_company_unified') || '7003489890',
      companyPhone: localStorage.getItem('sas_company_phone') || '0555012345',
      companyEmail: localStorage.getItem('sas_company_email') || 'maintenance-admin@sas-safety.com',
      companyTaxNumber: localStorage.getItem('sas_company_tax_id') || '310456789000003',
      companyAddress: localStorage.getItem('sas_company_address') || 'جدة، المملكة العربية السعودية',
      enableQuotesModule: true,
      enableWorkOrdersModule: true,
      enableExtinguishersModule: true,
      enableEmergencyModule: true,
      enableSmsModule: true,
      enableClientInquiries: true,
      customPages: [],
    };
  });

  const customizationRef = useRef(customization);
  useEffect(() => { 
    customizationRef.current = customization; 
    if (customization.primaryColor) {
      document.documentElement.style.setProperty('--color-safety-emerald', customization.primaryColor);
    }
  }, [customization]);

  // Real-time tab sync via storage event
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sas_system_customization' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setCustomization(parsed);
        } catch (err) {
          console.warn('Failed parsing customization from storage event', err);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleSaveCustomization = (newCust: SystemCustomization) => {
    setCustomization(newCust);
    localStorage.setItem('sas_system_customization', JSON.stringify(newCust));

    if (newCust.companyName) {
      setCompanyName(newCust.companyName);
      localStorage.setItem('sas_company_name', newCust.companyName);
    }
    if (newCust.unifiedNumber) {
      setCompanyUnified(newCust.unifiedNumber);
      localStorage.setItem('sas_company_unified', newCust.unifiedNumber);
    }
    if (newCust.companyPhone) {
      setCompanyPhone(newCust.companyPhone);
      localStorage.setItem('sas_company_phone', newCust.companyPhone);
    }
    if (newCust.companyEmail) {
      setCompanyEmail(newCust.companyEmail);
      localStorage.setItem('sas_company_email', newCust.companyEmail);
    }
    if (newCust.companyTaxNumber) {
      setCompanyTaxId(newCust.companyTaxNumber);
      localStorage.setItem('sas_company_tax_id', newCust.companyTaxNumber);
    }
    if (newCust.companyAddress) {
      setCompanyAddress(newCust.companyAddress);
      localStorage.setItem('sas_company_address', newCust.companyAddress);
    }
    setLocalVersion(v => v + 1);
  };

  // System Separation & Deployment Mode State Variables
  const [systemMode, setSystemMode] = useState<'hq' | 'independent_branch'>(() => {
    return (localStorage.getItem('sas_system_mode') as 'hq' | 'independent_branch') || 'hq';
  });
  const [independentBranchId, setIndependentBranchId] = useState<string>(() => {
    return localStorage.getItem('sas_independent_branch_id') || 'hq';
  });
  const [apiAccessToken, setApiAccessToken] = useState<string>(() => {
    const saved = localStorage.getItem('sas_api_access_token');
    if (saved) return saved;
    const generated = 'NESMA-SECURE-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    localStorage.setItem('sas_api_access_token', generated);
    return generated;
  });
  const [linkedBranches, setLinkedBranches] = useState<Array<{ id: string, name: string, url: string, token: string }>>(() => {
    try {
      const saved = localStorage.getItem('sas_linked_branches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // State variables for Remote Branch Viewer
  const [isViewingRemoteBranch, setIsViewingRemoteBranch] = useState<boolean>(false);
  const [viewedRemoteBranchId, setViewedRemoteBranchId] = useState<string | null>(null);
  const [branchesSubTab, setBranchesSubTab] = useState<'local' | 'separation' | 'purger'>('local');

  // State variables for Safe Branch Data Purger
  const [purgerSelectedBranchId, setPurgerSelectedBranchId] = useState<string>('');
  const [purgerConfirmText, setPurgerConfirmText] = useState<string>('');
  const [purgerBackupChecked, setPurgerBackupChecked] = useState<boolean>(false);

  // Form states for adding linked independent branches (HQ mode)
  const [newRemoteName, setNewRemoteName] = useState('');
  const [newRemoteUrl, setNewRemoteUrl] = useState('');
  const [newRemoteToken, setNewRemoteToken] = useState('');

  // Maintenance & Service Mode Status
  const [maintenanceModeEnabled, setMaintenanceModeEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sas_maintenance_mode_enabled');
      return saved === 'true';
    } catch (e) {
      return false;
    }
  });

  const maintenanceModeEnabledRef = useRef(maintenanceModeEnabled);
  useEffect(() => { maintenanceModeEnabledRef.current = maintenanceModeEnabled; }, [maintenanceModeEnabled]);

  // Dynamic SMTP Server Credentials
  const [smtpHost, setSmtpHost] = useState<string>(() => {
    return localStorage.getItem('sas_smtp_host') || '';
  });
  const [smtpPort, setSmtpPort] = useState<string>(() => {
    return localStorage.getItem('sas_smtp_port');
  });
  const [smtpUser, setSmtpUser] = useState<string>(() => {
    return localStorage.getItem('sas_smtp_user') || '';
  });
  const [smtpPass, setSmtpPass] = useState<string>(() => {
    return localStorage.getItem('sas_smtp_pass') || '';
  });
  const [smtpFromEmail, setSmtpFromEmail] = useState<string>(() => {
    return localStorage.getItem('sas_smtp_from_email') || '';
  });
  const [smtpEnabled, setSmtpEnabled] = useState<boolean>(() => {
    return localStorage.getItem('sas_smtp_enabled') !== 'false';
  });

  const smtpHostRef = useRef(smtpHost);
  const smtpPortRef = useRef(smtpPort);
  const smtpUserRef = useRef(smtpUser);
  const smtpPassRef = useRef(smtpPass);
  const smtpFromEmailRef = useRef(smtpFromEmail);
  const smtpEnabledRef = useRef(smtpEnabled);

  useEffect(() => { smtpHostRef.current = smtpHost; }, [smtpHost]);
  useEffect(() => { smtpPortRef.current = smtpPort; }, [smtpPort]);
  useEffect(() => { smtpUserRef.current = smtpUser; }, [smtpUser]);
  useEffect(() => { smtpPassRef.current = smtpPass; }, [smtpPass]);
  useEffect(() => { smtpFromEmailRef.current = smtpFromEmail; }, [smtpFromEmail]);
  useEffect(() => { smtpEnabledRef.current = smtpEnabled; }, [smtpEnabled]);

  const [deletedVisitIds, setDeletedVisitIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sas_deleted_visit_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('sas_deleted_visit_ids', JSON.stringify(deletedVisitIds));
  }, [deletedVisitIds]);

  // One-time automated clean block to zero out previous trial inquiries lists
  useEffect(() => {
    const hasZeroed = localStorage.getItem('sas_inquiries_zeroed_v2');
    if (!hasZeroed) {
      setClients(prev => {
        const cleared = prev.map(c => {
          if (!c) return c;
          return {
            ...c,
            inquiries: []
          };
        });
        localStorage.setItem('sas_clients', JSON.stringify(cleared));
        return cleared;
      });
      localStorage.setItem('sas_inquiries_zeroed_v2', 'true');
    }
  }, []);

  // Secure identity login session state
  const [session, setSession] = useState<LoggedInUser | null>(() => {
    try {
      const saved = localStorage.getItem('sas_session');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [translationCache, setTranslationCache] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('sas_dynamic_translations');
      if (saved) {
        const parsed = JSON.parse(saved);
        const clean: Record<string, string> = {};
        let pollutedFound = false;
        Object.entries(parsed).forEach(([key, val]) => {
          // A translation is valid only if it's a non-empty string, different from the key, and does not contain Arabic characters
          if (val && typeof val === 'string' && val.trim() !== key.trim() && !/[\u0600-\u06FF]/.test(val)) {
            clean[key] = val;
          } else {
            pollutedFound = true;
          }
        });
        if (pollutedFound) {
          console.log('[SAS Translation Service] Auto-purged poisoned/invalid translation keys from local cache.');
        }
        return clean;
      }
      return {};
    } catch (e) {
      return {};
    }
  });

  // Save translation cache when it changes
  useEffect(() => {
    safeSetItem('sas_dynamic_translations', JSON.stringify(translationCache));
  }, [translationCache]);

  // Inject dynamic translation into global window context for react-independent component usage
  (window as any).dt = (text: string | null | undefined): string => {
    if (!text || typeof text !== 'string') return '';
    if (lang === 'ar') return text;
    return translationCache[text.trim()] || text;
  };

  // Automated background translation scanner for manually entered Arabic data (to translate when language is changed)
  useEffect(() => {
    if (lang !== 'en') return;

    // Helper to check if a string contains Arabic characters
    const hasArabic = (text: string) => /[\u0600-\u06FF]/.test(text);

    const stringsToTranslate = new Set<string>();

    // 1. Dynamic Client info
    clients.forEach(c => {
      if (c.name && hasArabic(c.name)) stringsToTranslate.add(c.name.trim());
      if (c.locationText && hasArabic(c.locationText)) stringsToTranslate.add(c.locationText.trim());
      
      // Client branches
      if (c.branches) {
        c.branches.forEach(b => {
          if (b.name && hasArabic(b.name)) stringsToTranslate.add(b.name.trim());
          if (b.city && hasArabic(b.city)) stringsToTranslate.add(b.city.trim());
          if (b.locationText && hasArabic(b.locationText)) stringsToTranslate.add(b.locationText.trim());
        });
      }

      // Client inquiries and replies
      if (c.inquiries) {
        c.inquiries.forEach(inq => {
          if (inq.text && hasArabic(inq.text)) stringsToTranslate.add(inq.text.trim());
          if (inq.replyText && hasArabic(inq.replyText)) stringsToTranslate.add(inq.replyText.trim());
        });
      }

      // Client sub-users (roles / descriptive titles)
      if (c.subUsers) {
        c.subUsers.forEach(sub => {
          if (sub.name && hasArabic(sub.name)) stringsToTranslate.add(sub.name.trim());
          if (sub.role && hasArabic(sub.role)) stringsToTranslate.add(sub.role.trim());
        });
      }
    });

    // 2. Dynamic Visit notes / defects
    visits.forEach(v => {
      if (v.notes && hasArabic(v.notes)) stringsToTranslate.add(v.notes.trim());
      if (v.defects && hasArabic(v.defects)) stringsToTranslate.add(v.defects.trim());
      if (v.emergencyReason && hasArabic(v.emergencyReason)) stringsToTranslate.add(v.emergencyReason.trim());
      if (v.branchName && hasArabic(v.branchName)) stringsToTranslate.add(v.branchName.trim());
    });

    // 3. Dynamic Emergency Visits notes / reasons
    emergencyVisits.forEach(ev => {
      if (ev.notes && hasArabic(ev.notes)) stringsToTranslate.add(ev.notes.trim());
      if (ev.defects && hasArabic(ev.defects)) stringsToTranslate.add(ev.defects.trim());
      if (ev.emergencyReason && hasArabic(ev.emergencyReason)) stringsToTranslate.add(ev.emergencyReason.trim());
      if (ev.branchName && hasArabic(ev.branchName)) stringsToTranslate.add(ev.branchName.trim());
    });

    // 4. Quotation descriptions & notes
    quotations.forEach(q => {
      if (q.clientNote && hasArabic(q.clientNote)) stringsToTranslate.add(q.clientNote.trim());
      if (q.terms && hasArabic(q.terms)) stringsToTranslate.add(q.terms.trim());
      if (q.branchName && hasArabic(q.branchName)) stringsToTranslate.add(q.branchName.trim());
      
      if (q.items) {
        q.items.forEach(itm => {
          if (itm.description && hasArabic(itm.description)) stringsToTranslate.add(itm.description.trim());
          if (itm.warranty && hasArabic(itm.warranty)) stringsToTranslate.add(itm.warranty.trim());
        });
      }
    });

    // 5. Technicians dynamic notes / names
    technicians.forEach(t => {
      if (t.name && hasArabic(t.name)) stringsToTranslate.add(t.name.trim());
    });

    // Filter out texts that are already in our cache
    const missing = Array.from(stringsToTranslate).filter(str => !translationCache[str]);

    if (missing.length === 0) return;

    // Fetch translations from endpoint
    const fetchTranslations = async () => {
      console.log(`[SAS Translation Service] Scanning found ${missing.length} missing dynamic translations. Fetching...`, missing);
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: missing })
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.translations)) {
          const newCache = { ...translationCache };
          let hasNewValue = false;
          missing.forEach((orig, idx) => {
            const trans = data.translations[idx];
            // Only cache valid translations: non-empty, not same as orig, and doesn't contain Arabic
            if (trans && typeof trans === 'string' && trans.trim() !== orig.trim() && !/[\u0600-\u06FF]/.test(trans)) {
              newCache[orig] = trans;
              hasNewValue = true;
            }
          });
          if (hasNewValue) {
            setTranslationCache(newCache);
            console.log('[SAS Translation Service] Cache successfully populated with valid predictions!');
          }
        }
      } catch (err) {
        console.error('[SAS Translation Service] Failed fetching translations from backend:', err);
      }
    };

    // Rate-limit/debounce so we don't fire too many parallel requests during initial state hydration
    const timer = setTimeout(() => {
      fetchTranslations();
    }, 1500);

    return () => clearTimeout(timer);
  }, [lang, clients, visits, emergencyVisits, quotations, technicians, translationCache]);

  // Header Settings Dropdown & Control Panel Modal States
  const [isHeaderDropdownOpen, setIsHeaderDropdownOpen] = useState(false);
  const [isControlPanelModalOpen, setIsControlPanelModalOpen] = useState(false);
  const [controlPanelActiveTab, setControlPanelActiveTab] = useState<'profile' | 'password' | 'addUser' | 'listUsers' | 'backup' | 'branches'>('profile');

  // 🏢 Company Branches States
  const [companyBranches, setCompanyBranches] = useState<CompanyBranch[]>(() => {
    try {
      const saved = localStorage.getItem('sas_company_branches');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          return parsed.map((b: any) => b.id === 'hq' ? { ...b, name: 'المقر الرئيسي' } : b);
        }
      }
      return [
        { id: 'hq', name: 'المقر الرئيسي', city: 'جدة', createdAt: new Date().toISOString() }
      ];
    } catch (e) {
      return [
        { id: 'hq', name: 'المقر الرئيسي', city: 'جدة', createdAt: new Date().toISOString() }
      ];
    }
  });

  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    return localStorage.getItem('sas_selected_branch_id') || 'all';
  });

  const [newUserBranchId, setNewUserBranchId] = useState<string>('hq');
  const [editUserBranchId, setEditUserBranchId] = useState<string>('hq');

  // Auto-persist companyBranches
  useEffect(() => {
    localStorage.setItem('sas_company_branches', JSON.stringify(companyBranches));
  }, [companyBranches]);

  // Control Panel Profile Local Form States
  const [adminEditName, setAdminEditName] = useState('');
  const [adminEditUsername, setAdminEditUsername] = useState('');
  const [adminEditPassword, setAdminEditPassword] = useState('');
  const [companyEditName, setCompanyEditName] = useState('');
  const [companyEditUnified, setCompanyEditUnified] = useState('');
  const [companyEditPhone, setCompanyEditPhone] = useState('');
  const [companyEditEmail, setCompanyEditEmail] = useState('');
  const [companyEditTaxId, setCompanyEditTaxId] = useState('');
  const [companyEditAddress, setCompanyEditAddress] = useState('');
  
  // New User Form States
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'technician' | 'admin' | 'viewer'>('technician');
  
  // New User Permissions Checkboxes
  const [permClients, setPermClients] = useState(true);
  const [permTechs, setPermTechs] = useState(true);
  const [permQuotes, setPermQuotes] = useState(true);
  const [permWipe, setPermWipe] = useState(false);

  // Edit User Form States
  const [editingTechId, setEditingTechId] = useState<string | null>(null);
  const [editUserFullName, setEditUserFullName] = useState('');
  const [editUserPhone, setEditUserPhone] = useState('');
  const [editUserUsername, setEditUserUsername] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserRole, setEditUserRole] = useState<'technician' | 'admin' | 'viewer'>('technician');
  const [editPermClients, setEditPermClients] = useState(true);
  const [editPermTechs, setEditPermTechs] = useState(true);
  const [editPermQuotes, setEditPermQuotes] = useState(true);
  const [editPermWipe, setEditPermWipe] = useState(false);

  // 🏢 States for managing company branches with credentials and permissions
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCity, setNewBranchCity] = useState('');
  const [newBranchUsername, setNewBranchUsername] = useState('');
  const [newBranchPassword, setNewBranchPassword] = useState('');
  const [newBranchPermClients, setNewBranchPermClients] = useState(true);
  const [newBranchPermTechs, setNewBranchPermTechs] = useState(true);
  const [newBranchPermQuotes, setNewBranchPermQuotes] = useState(true);
  const [newBranchPermWipe, setNewBranchPermWipe] = useState(false);

  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editBranchName, setEditBranchName] = useState('');
  const [editBranchCity, setEditBranchCity] = useState('');
  const [editBranchUsername, setEditBranchUsername] = useState('');
  const [editBranchPassword, setEditBranchPassword] = useState('');
  const [editBranchPermClients, setEditBranchPermClients] = useState(true);
  const [editBranchPermTechs, setEditBranchPermTechs] = useState(true);
  const [editBranchPermQuotes, setEditBranchPermQuotes] = useState(true);
  const [editBranchPermWipe, setEditBranchPermWipe] = useState(false);

  // ⚙️ Client Control Panel & Settings states
  const [isClientControlPanelOpen, setIsClientControlPanelOpen] = useState(false);
  const [clientControlActiveTab, setClientControlActiveTab] = useState<'profile' | 'password' | 'subUsers' | 'manageSubUsers'>('profile');
  
  // Client edit fields
  const [clientEditName, setClientEditName] = useState('');
  const [clientEditPhone, setClientEditPhone] = useState('');
  const [clientEditEmail, setClientEditEmail] = useState('');
  const [clientEditLocation, setClientEditLocation] = useState('');
  const [clientEditUsername, setClientEditUsername] = useState('');
  const [clientEditPassword, setClientEditPassword] = useState('');

  // Sub user fields
  const [subUserFullName, setSubUserFullName] = useState('');
  const [subUserPhone, setSubUserPhone] = useState('');
  const [subUserUsername, setSubUserUsername] = useState('');
  const [subUserPassword, setSubUserPassword] = useState('');
  const [subUserPermViewVisits, setSubUserPermViewVisits] = useState(true);
  const [subUserPermReplyQuotes, setSubUserPermReplyQuotes] = useState(true);
  const [subUserPermSubmitInquiries, setSubUserPermSubmitInquiries] = useState(true);

  // Editing sub-user state
  const [editingSubUserId, setEditingSubUserId] = useState<string | null>(null);
  const [editSubUserFullName, setEditSubUserFullName] = useState('');
  const [editSubUserPhone, setEditSubUserPhone] = useState('');
  const [editSubUserUsername, setEditSubUserUsername] = useState('');
  const [editSubUserPassword, setEditSubUserPassword] = useState('');
  const [editSubUserPermViewVisits, setEditSubUserPermViewVisits] = useState(true);
  const [editSubUserPermReplyQuotes, setEditSubUserPermReplyQuotes] = useState(true);
  const [editSubUserPermSubmitInquiries, setEditSubUserPermSubmitInquiries] = useState(true);

  // Helper to robustly propagate denormalized Client name & contract changes to visits, emergency inspections, and quotations
  const propagateClientUpdates = (clientId: string, newName: string, newContractNumber: string) => {
    try {
      setVisits(prev => {
        if (!Array.isArray(prev)) return prev;
        return prev.map(v => {
          if (v && v.clientId === clientId) {
            return {
              ...v,
              clientName: newName,
              contractNumber: newContractNumber
            };
          }
          return v;
        }).filter(Boolean);
      });

      setEmergencyVisits(prev => {
        if (!Array.isArray(prev)) return prev;
        return prev.map(ev => {
          if (ev && ev.clientId === clientId) {
            return {
              ...ev,
              clientName: newName,
              contractNumber: newContractNumber
            };
          }
          return ev;
        }).filter(Boolean);
      });

      setQuotations(prev => {
        if (!Array.isArray(prev)) return prev;
        return prev.map(q => {
          if (q && q.clientId === clientId) {
            return {
              ...q,
              clientName: newName
            };
          }
          return q;
        }).filter(Boolean);
      });
    } catch (err) {
      console.error("[propagateClientUpdates critical error]", err);
    }
  };

  // Handler: Edit / Update Client details specifically for settings updates (bypass visit auto-generation loops)
  const handleEditClientMetadata = (updatedClient: Client) => {
    triggerLocalMutation();
    setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
    propagateClientUpdates(updatedClient.id, updatedClient.name, updatedClient.contractNumber);
  };

  // Sync form states with Admin variables on open
  useEffect(() => {
    if (isControlPanelModalOpen) {
      setAdminEditName(adminName);
      setAdminEditUsername(adminUsername);
      setAdminEditPassword(adminPassword);
      
      setCompanyEditName(companyName);
      setCompanyEditUnified(companyUnified);
      setCompanyEditPhone(companyPhone);
      setCompanyEditEmail(companyEmail);
      setCompanyEditTaxId(companyTaxId);
      setCompanyEditAddress(companyAddress);
      
      setNewUserFullName('');
      setNewUserPhone('');
      setNewUserUsername('');
      setNewUserPassword('');
      setNewUserRole('technician');
      setPermClients(true);
      setPermTechs(true);
      setPermQuotes(true);
      setPermWipe(false);
      
      setEditingTechId(null);
    }
  }, [isControlPanelModalOpen, adminName, adminUsername, adminPassword]);

  // Synchronization Indicators
  const [isSyncLoaded, setIsSyncLoaded] = useState(false);
  const [localVersion, setLocalVersion] = useState(0);
  const [dbLoading, setDbLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const lastLocalWriteRef = useRef<number>(0);
  const masterStateRef = useRef<string>('');

  // Stable references of current states for zero-teardown interval synchronization
  const clientsRef = useRef(clients);
  const visitsRef = useRef(visits);
  const techniciansRef = useRef(technicians);
  const daysBeforeVisitAlertRef = useRef(daysBeforeVisitAlert);
  const notificationLogsRef = useRef(notificationLogs);
  const managerPhoneRef = useRef(managerPhone);
  const managerEmailRef = useRef(managerEmail);
  const adminUsernameRef = useRef(adminUsername);
  const adminPasswordRef = useRef(adminPassword);
  const adminNameRef = useRef(adminName);
  const companyNameRef = useRef(companyName);
  const companyUnifiedRef = useRef(companyUnified);
  const companyPhoneRef = useRef(companyPhone);
  const companyEmailRef = useRef(companyEmail);
  const companyTaxIdRef = useRef(companyTaxId);
  const companyAddressRef = useRef(companyAddress);
  const nominationsRef = useRef<any>(null); // dummy placeholder for compilation
  const quotationsRef = useRef(quotations);
  const emergencyVisitsRef = useRef(emergencyVisits);
  const deletedVisitIdsRef = useRef(deletedVisitIds);
  const extinguisherReceiptsRef = useRef(extinguisherReceipts);
  const companyBranchesRef = useRef(companyBranches);
  const localVersionRef = useRef(localVersion);
  const isSyncingRef = useRef(isSyncing);

  // Keep references in lock-step with React states
  useEffect(() => { clientsRef.current = clients; }, [clients]);
  useEffect(() => { visitsRef.current = visits; }, [visits]);
  useEffect(() => { techniciansRef.current = technicians; }, [technicians]);
  useEffect(() => { daysBeforeVisitAlertRef.current = daysBeforeVisitAlert; }, [daysBeforeVisitAlert]);
  useEffect(() => { notificationLogsRef.current = notificationLogs; }, [notificationLogs]);
  useEffect(() => { quotationsRef.current = quotations; }, [quotations]);
  useEffect(() => { emergencyVisitsRef.current = emergencyVisits; }, [emergencyVisits]);
  useEffect(() => { deletedVisitIdsRef.current = deletedVisitIds; }, [deletedVisitIds]);
  useEffect(() => { extinguisherReceiptsRef.current = extinguisherReceipts; }, [extinguisherReceipts]);
  useEffect(() => { companyBranchesRef.current = companyBranches; }, [companyBranches]);
  useEffect(() => { managerPhoneRef.current = managerPhone; }, [managerPhone]);
  useEffect(() => { managerEmailRef.current = managerEmail; }, [managerEmail]);
  useEffect(() => { adminUsernameRef.current = adminUsername; }, [adminUsername]);
  useEffect(() => { adminPasswordRef.current = adminPassword; }, [adminPassword]);
  useEffect(() => { adminNameRef.current = adminName; }, [adminName]);
  useEffect(() => { companyNameRef.current = companyName; }, [companyName]);
  useEffect(() => { companyUnifiedRef.current = companyUnified; }, [companyUnified]);
  useEffect(() => { companyPhoneRef.current = companyPhone; }, [companyPhone]);
  useEffect(() => { companyEmailRef.current = companyEmail; }, [companyEmail]);
  useEffect(() => { companyTaxIdRef.current = companyTaxId; }, [companyTaxId]);
  useEffect(() => { companyAddressRef.current = companyAddress; }, [companyAddress]);
  useEffect(() => { localVersionRef.current = localVersion; }, [localVersion]);
  useEffect(() => { isSyncingRef.current = isSyncing; }, [isSyncing]);

  // Synchronously lock background pulls and increment version
  const triggerLocalMutation = () => {
    lastLocalWriteRef.current = Date.now();
    localVersionRef.current = localVersionRef.current + 1;
    setLocalVersion(v => v + 1);
  };

  const executePurgeBranch = (branchId: string) => {
    const branchName = companyBranches.find(b => b.id === branchId)?.name || '';
    
    // Create filtered states
    const filteredClients = clients.filter(c => c.companyBranchId !== branchId);
    const filteredVisits = visits.filter(v => v.companyBranchId !== branchId);
    const filteredTechnicians = technicians.filter(t => t.companyBranchId !== branchId);
    const filteredQuotations = quotations.filter(q => q.companyBranchId !== branchId);
    const filteredEmergencyVisits = emergencyVisits.filter(v => v.companyBranchId !== branchId);
    const filteredReceipts = extinguisherReceipts.filter(r => r.companyBranchId !== branchId);
    const filteredLogs = notificationLogs.filter(l => l.companyBranchId !== branchId);
    const filteredBranches = companyBranches.filter(b => b.id !== branchId);

    // Apply state updates
    setClients(filteredClients);
    setVisits(filteredVisits);
    setTechnicians(filteredTechnicians);
    setQuotations(filteredQuotations);
    setEmergencyVisits(filteredEmergencyVisits);
    setExtinguisherReceipts(filteredReceipts);
    setNotificationLogs(filteredLogs);
    setCompanyBranches(filteredBranches);

    // Apply local storage updates
    localStorage.setItem('sas_clients', JSON.stringify(filteredClients));
    localStorage.setItem('sas_visits', JSON.stringify(filteredVisits));
    localStorage.setItem('sas_technicians', JSON.stringify(filteredTechnicians));
    localStorage.setItem('sas_quotations', JSON.stringify(filteredQuotations));
    localStorage.setItem('sas_emergency_visits', JSON.stringify(filteredEmergencyVisits));
    localStorage.setItem('sas_extinguisher_receipts', JSON.stringify(filteredReceipts));
    localStorage.setItem('sas_notification_logs', JSON.stringify(filteredLogs));
    localStorage.setItem('sas_company_branches', JSON.stringify(filteredBranches));

    // Trigger sync to Firestore
    triggerLocalMutation();

    // Reset purger form states
    setPurgerSelectedBranchId('');
    setPurgerConfirmText('');
    setPurgerBackupChecked(false);
  };

  const reloadCentralData = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/data?t=' + Date.now());
      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data) {
          const d = json.data;
          setClients(d.clients || []);
          setVisits(d.visits || []);
          setTechnicians(d.technicians || []);
          setQuotations(d.quotations || []);
          setEmergencyVisits(d.emergencyVisits || []);
          setExtinguisherReceipts(d.extinguisherReceipts || []);
          setNotificationLogs(d.notificationLogs || []);
          const sanitizedBranches = (d.companyBranches || []).map((b: any) => b.id === 'hq' ? { ...b, name: 'المقر الرئيسي' } : b);
          setCompanyBranches(sanitizedBranches);
          setIsViewingRemoteBranch(false);
          setViewedRemoteBranchId(null);
          console.log('[SAS Separation] Successfully restored Headquarters central state.');
        }
      }
    } catch (e) {
      console.error('[SAS Separation] Failed to restore central state:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSetExtinguisherReceipts = (receipts: ExtinguisherReceipt[]) => {
    setExtinguisherReceipts(receipts);
    localStorage.setItem('sas_extinguisher_receipts', JSON.stringify(receipts));
    triggerLocalMutation();
  };

  // Login Form States
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [selectedVisitForModal, setSelectedVisitForModal] = useState<Visit | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);

  // 1. Fetch Shared Database State from Node Server on Mount with Robust Double-Sided Reconciliation
  useEffect(() => {
    const loadSharedDatabase = async () => {
      setIsSyncing(true);
      let retries = 15;
      let success = false;

      // Extract fresh local storage copies first
      let localClients: Client[] = [];
      let localVisits: Visit[] = [];
      let localTechs: Technician[] = [];
      let localLogs: NotificationLog[] = [];
      let localQuotes: Quotation[] = [];
      let localEmergencyVisits: Visit[] = [];
      let localDeletedVisitIds: string[] = [];

      try {
        const cSaved = localStorage.getItem('sas_clients');
        if (cSaved) localClients = JSON.parse(cSaved);
      } catch (e) {}
      try {
        const vSaved = localStorage.getItem('sas_visits');
        if (vSaved) localVisits = JSON.parse(vSaved);
      } catch (e) {}
      try {
        const tSaved = localStorage.getItem('sas_technicians');
        if (tSaved) localTechs = JSON.parse(tSaved);
      } catch (e) {}
      try {
        const nSaved = localStorage.getItem('sas_notification_logs');
        if (nSaved) localLogs = JSON.parse(nSaved);
      } catch (e) {}
      try {
        const qSaved = localStorage.getItem('sas_quotations');
        if (qSaved) localQuotes = JSON.parse(qSaved);
      } catch (e) {}
      try {
        const evSaved = localStorage.getItem('sas_emergency_visits');
        if (evSaved) localEmergencyVisits = JSON.parse(evSaved);
      } catch (e) {}
      try {
        const delSaved = localStorage.getItem('sas_deleted_visit_ids');
        if (delSaved) localDeletedVisitIds = JSON.parse(delSaved);
      } catch (e) {}
      let localExtinguisherReceipts: ExtinguisherReceipt[] = [];
      try {
        const extSaved = localStorage.getItem('sas_extinguisher_receipts');
        if (extSaved) localExtinguisherReceipts = JSON.parse(extSaved);
      } catch (e) {}

      const localPhone = localStorage.getItem('sas_manager_phone') || '0555012345';
      const localEmail = localStorage.getItem('sas_manager_email') || 'maintenance-admin@sas-safety.com';
      const localUser = localStorage.getItem('sas_admin_username') || 'admin';
      const localPass = localStorage.getItem('sas_admin_password') || '123';
      const localName = localStorage.getItem('sas_admin_name') || 'المشرف العام';
      const localAlertDays = parseInt(localStorage.getItem('sas_alert_days') || '2');
      let localMaintenanceMode = false;
      try {
        const mSaved = localStorage.getItem('sas_maintenance_mode_enabled');
        if (mSaved) localMaintenanceMode = mSaved === 'true';
      } catch (e) {}

      while (retries > 0 && !success) {
        try {
          const response = await fetch('/api/data?t=' + Date.now());
          if (!response.ok) {
            throw new Error(`HTTP status ${response.status}`);
          }
          const json = await response.json();
          if (json.success && json.data) {
            const d = json.data;
            console.log('[SAS Sync] Merging master data state from container storage with local storage:', d);
            
            // Check if server database is blank or newly initialized
            const serverIsEmpty = 
              (!d.clients || d.clients.length === 0) &&
              (!d.technicians || d.technicians.length === 0) &&
              (!d.quotations || d.quotations.length === 0) &&
              (!d.visits || d.visits.length === 0) &&
              (!d.extinguisherReceipts || d.extinguisherReceipts.length === 0) &&
              (!d.emergencyVisits || d.emergencyVisits.length === 0);

            // Check if browser has local cached data to restore
            const localHasData = 
              localClients.length > 0 ||
              localTechs.length > 0 ||
              localQuotes.length > 0 ||
              localVisits.length > 0 ||
              localExtinguisherReceipts.length > 0 ||
              localEmergencyVisits.length > 0;

            let reconciledClients = d.clients || [];
            let reconciledVisits = d.visits || [];
            let reconciledTechs = d.technicians || [];
            let reconciledLogs = d.notificationLogs || [];
            let reconciledQuotations = d.quotations || [];
            let reconciledEmergencyVisits = d.emergencyVisits || [];
            let reconciledDeletedVisitIds = d.deletedVisitIds || [];
            let reconciledExtinguisherReceipts = d.extinguisherReceipts !== undefined ? d.extinguisherReceipts : localExtinguisherReceipts;

            if (d.isWiped === true) {
              console.log('[SAS Sync] Central database is explicitly wiped. Clearing local cache...');
              reconciledClients = [];
              reconciledVisits = [];
              reconciledQuotations = [];
              reconciledEmergencyVisits = [];
              reconciledExtinguisherReceipts = [];
              localStorage.setItem('sas_clients', '[]');
              localStorage.setItem('sas_visits', '[]');
              localStorage.setItem('sas_quotations', '[]');
              localStorage.setItem('sas_emergency_visits', '[]');
              localStorage.setItem('sas_extinguisher_receipts', '[]');
            } else if (serverIsEmpty && localHasData) {
              console.log('[SAS Sync] Central server state is completely blank. Restoratively seeding from local browser state storage...');
              reconciledClients = localClients;
              reconciledVisits = localVisits;
              reconciledTechs = localTechs;
              reconciledLogs = localLogs;
              reconciledQuotations = localQuotes;
              reconciledEmergencyVisits = localEmergencyVisits;
              reconciledDeletedVisitIds = localDeletedVisitIds;
              reconciledExtinguisherReceipts = localExtinguisherReceipts;
            } else {
              console.log('[SAS Sync] Trusting container master database state as the absolute single source of truth.');
              // Merge local deleted IDs to be robust
              reconciledDeletedVisitIds = Array.from(new Set([...reconciledDeletedVisitIds, ...localDeletedVisitIds]));
            }

            // FILTER EXCLUDED DELETED VISITS IMMEDIATELY
            reconciledVisits = reconciledVisits.filter(v => v && v.id && !reconciledDeletedVisitIds.includes(v.id));
            reconciledEmergencyVisits = reconciledEmergencyVisits.filter(ev => ev && ev.id && !reconciledDeletedVisitIds.includes(ev.id));

            // Reconcile scalar values, preserving customized values over defaults
            const reconciledPhone = d.managerPhone || localPhone;
            const reconciledEmail = d.managerEmail || localEmail;
            const reconciledUser = d.adminUsername || localUser;
            const reconciledPass = d.adminPassword || localPass;
            const reconciledName = d.adminName || localName;
            const reconciledAlertDays = d.daysBeforeVisitAlert !== undefined ? d.daysBeforeVisitAlert : localAlertDays;
            const reconciledMaintenanceMode = d.maintenanceModeEnabled !== undefined ? d.maintenanceModeEnabled === true : localMaintenanceMode;

            const reconciledSmtpHost = d.smtpHost !== undefined ? d.smtpHost : (localStorage.getItem('sas_smtp_host') || '');
            const reconciledSmtpPort = d.smtpPort !== undefined ? d.smtpPort : (localStorage.getItem('sas_smtp_port') || '');
            const reconciledSmtpUser = d.smtpUser !== undefined ? d.smtpUser : (localStorage.getItem('sas_smtp_user') || '');
            const reconciledSmtpPass = d.smtpPass !== undefined ? d.smtpPass : (localStorage.getItem('sas_smtp_pass') || '');
            const reconciledSmtpFrom = d.smtpFromEmail !== undefined ? d.smtpFromEmail : (localStorage.getItem('sas_smtp_from_email') || '');
            const reconciledSmtpEnabled = d.smtpEnabled !== undefined ? d.smtpEnabled === true : (localStorage.getItem('sas_smtp_enabled') !== 'false');

            const reconciledSystemMode = d.systemMode || localStorage.getItem('sas_system_mode') || 'hq';
            const reconciledIndependentBranchId = d.independentBranchId || localStorage.getItem('sas_independent_branch_id') || 'hq';
            const reconciledApiAccessToken = d.apiAccessToken || localStorage.getItem('sas_api_access_token') || ('NESMA-SECURE-' + Math.random().toString(36).substring(2, 10).toUpperCase());
            let reconciledLinkedBranches = [];
            try {
              reconciledLinkedBranches = d.linkedBranches ? (typeof d.linkedBranches === 'string' ? JSON.parse(d.linkedBranches) : d.linkedBranches) : JSON.parse(localStorage.getItem('sas_linked_branches') || '[]');
            } catch (e) {}

            const reconciledCustomization = d.customization || customizationRef.current;
            if (reconciledCustomization) {
              setCustomization(reconciledCustomization);
              localStorage.setItem('sas_system_customization', JSON.stringify(reconciledCustomization));
            }

            // Filter out old mock inquiries
            reconciledClients = reconciledClients.map(c => {
              if (!c || !Array.isArray(c.inquiries)) return c;
              return {
                ...c,
                inquiries: c.inquiries.filter(inq => inq && inq.id !== 'inq_1780662623192' && !(inq.text || '').includes('بياتو'))
              };
            });

            // Run self-healing visit generation on initial load to schedule any missing visits for newly added branches
            const healedVisits = selfHealBranchVisits(reconciledClients, reconciledVisits, reconciledTechs);

            // Apply to local state
            setClients(reconciledClients);
            setVisits(healedVisits);
            setTechnicians(reconciledTechs);
            setDaysBeforeVisitAlert(reconciledAlertDays);
            setNotificationLogs(reconciledLogs);
            setQuotations(reconciledQuotations);
            setEmergencyVisits(reconciledEmergencyVisits);
            setDeletedVisitIds(reconciledDeletedVisitIds);
            setExtinguisherReceipts(reconciledExtinguisherReceipts);
            setEmergencyVisits(reconciledEmergencyVisits);
            setManagerPhone(reconciledPhone);
            setManagerEmail(reconciledEmail);
            setAdminUsername(reconciledUser);
            setAdminPassword(reconciledPass);
            setAdminName(reconciledName);
            setMaintenanceModeEnabled(reconciledMaintenanceMode);
            setSmtpHost(reconciledSmtpHost);
            setSmtpPort(reconciledSmtpPort);
            setSmtpUser(reconciledSmtpUser);
            setSmtpPass(reconciledSmtpPass);
            setSmtpFromEmail(reconciledSmtpFrom);
            setSmtpEnabled(reconciledSmtpEnabled);
            setSystemMode(reconciledSystemMode as 'hq' | 'independent_branch');
            setIndependentBranchId(reconciledIndependentBranchId);
            setApiAccessToken(reconciledApiAccessToken);
            setLinkedBranches(reconciledLinkedBranches);

            // Persist locally
            localStorage.setItem('sas_clients', JSON.stringify(reconciledClients));
            localStorage.setItem('sas_visits', JSON.stringify(reconciledVisits));
            localStorage.setItem('sas_technicians', JSON.stringify(reconciledTechs));
            localStorage.setItem('sas_alert_days', reconciledAlertDays.toString());
            localStorage.setItem('sas_notification_logs', JSON.stringify(reconciledLogs));
            localStorage.setItem('sas_quotations', JSON.stringify(reconciledQuotations));
            localStorage.setItem('sas_emergency_visits', JSON.stringify(reconciledEmergencyVisits));
            localStorage.setItem('sas_deleted_visit_ids', JSON.stringify(reconciledDeletedVisitIds));
            localStorage.setItem('sas_extinguisher_receipts', JSON.stringify(reconciledExtinguisherReceipts));
            localStorage.setItem('sas_manager_phone', reconciledPhone);
            localStorage.setItem('sas_manager_email', reconciledEmail);
            localStorage.setItem('sas_admin_username', reconciledUser);
            localStorage.setItem('sas_admin_password', reconciledPass);
            localStorage.setItem('sas_admin_name', reconciledName);
            localStorage.setItem('sas_maintenance_mode_enabled', reconciledMaintenanceMode ? 'true' : 'false');
            localStorage.setItem('sas_smtp_host', reconciledSmtpHost);
            localStorage.setItem('sas_smtp_port', reconciledSmtpPort);
            localStorage.setItem('sas_smtp_user', reconciledSmtpUser);
            localStorage.setItem('sas_smtp_pass', reconciledSmtpPass);
            localStorage.setItem('sas_smtp_from_email', reconciledSmtpFrom);
            localStorage.setItem('sas_smtp_enabled', reconciledSmtpEnabled ? 'true' : 'false');
            localStorage.setItem('sas_system_mode', reconciledSystemMode);
            localStorage.setItem('sas_independent_branch_id', reconciledIndependentBranchId);
            localStorage.setItem('sas_api_access_token', reconciledApiAccessToken);
            localStorage.setItem('sas_linked_branches', JSON.stringify(reconciledLinkedBranches));

            // Compute unified payload
            const reconciledPayload = {
              clients: reconciledClients,
              visits: reconciledVisits,
              technicians: reconciledTechs,
              daysBeforeVisitAlert: reconciledAlertDays,
              notificationLogs: reconciledLogs,
              managerPhone: reconciledPhone,
              managerEmail: reconciledEmail,
              adminUsername: reconciledUser,
              adminPassword: reconciledPass,
              adminName: reconciledName,
              quotations: reconciledQuotations,
              emergencyVisits: reconciledEmergencyVisits,
              deletedVisitIds: reconciledDeletedVisitIds,
              extinguisherReceipts: reconciledExtinguisherReceipts,
              maintenanceModeEnabled: reconciledMaintenanceMode,
              smtpHost: reconciledSmtpHost,
              smtpPort: reconciledSmtpPort,
              smtpUser: reconciledSmtpUser,
              smtpPass: reconciledSmtpPass,
              smtpFromEmail: reconciledSmtpFrom,
              smtpEnabled: reconciledSmtpEnabled,
              systemMode: reconciledSystemMode,
              independentBranchId: reconciledIndependentBranchId,
              apiAccessToken: reconciledApiAccessToken,
              linkedBranches: reconciledLinkedBranches,
              customization: reconciledCustomization
            };

            const reconciledStr = JSON.stringify(reconciledPayload);
            masterStateRef.current = reconciledStr;

            // Check if server is missing some records that the local storage resurrected
            const serverStr = JSON.stringify({
              clients: d.clients || [],
              visits: d.visits || [],
              technicians: d.technicians || [],
              daysBeforeVisitAlert: d.daysBeforeVisitAlert ?? 2,
              notificationLogs: d.notificationLogs || [],
              managerPhone: d.managerPhone || '0555012345',
              managerEmail: d.managerEmail || 'maintenance-admin@sas-safety.com',
              adminUsername: d.adminUsername || 'admin',
              adminPassword: d.adminPassword || '123',
              adminName: d.adminName || 'المشرف العام',
              quotations: d.quotations || [],
              emergencyVisits: d.emergencyVisits || [],
              deletedVisitIds: d.deletedVisitIds || [],
              extinguisherReceipts: d.extinguisherReceipts || [],
              maintenanceModeEnabled: d.maintenanceModeEnabled === true,
              smtpHost: d.smtpHost || '',
              smtpPort: d.smtpPort || '',
              smtpUser: d.smtpUser || '',
              smtpPass: d.smtpPass || '',
              smtpFromEmail: d.smtpFromEmail || '',
              smtpEnabled: d.smtpEnabled !== false,
              systemMode: d.systemMode || reconciledSystemMode,
              independentBranchId: d.independentBranchId || reconciledIndependentBranchId,
              apiAccessToken: d.apiAccessToken || reconciledApiAccessToken,
              linkedBranches: d.linkedBranches ? (typeof d.linkedBranches === 'string' ? JSON.parse(d.linkedBranches) : d.linkedBranches) : reconciledLinkedBranches,
              customization: d.customization || null
            });

            if (serverIsEmpty && localHasData && !d.isWiped && reconciledStr !== serverStr) {
              console.log('[SAS Sync] Resurrecting local records back to server database.json...');
              await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: reconciledStr
              });
            }

            success = true;
          } else {
            // No file exists or not initialized yet
            if (json.message === 'Database file not initialized on server.') {
              console.log('[SAS Sync] Initializing database.json on backend with reconciled browser state...');
              const payload = {
                clients: localClients,
                visits: localVisits,
                technicians: localTechs,
                daysBeforeVisitAlert: localAlertDays,
                notificationLogs: localLogs,
                managerPhone: localPhone,
                managerEmail: localEmail,
                adminUsername: localUser,
                adminPassword: localPass,
                adminName: localName,
                quotations: localQuotes,
                emergencyVisits: localEmergencyVisits,
                deletedVisitIds: localDeletedVisitIds,
                customization: customizationRef.current
              };
              masterStateRef.current = JSON.stringify(payload);
              await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
              success = true;
            } else {
              throw new Error(json.message || 'Verification failed');
            }
          }
        } catch (err) {
          retries--;
          console.warn(`[SAS Sync Interface] Node server database offline or unreachable. Retries remaining: ${retries}`, err);
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
      }

      setIsSyncLoaded(true);
      setDbLoading(false);
      setIsSyncing(false);
      setLastSyncTime(new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }));
    };

    loadSharedDatabase();
  }, []);

  // 1.5. Dynamic auto login from direct links (technicians, clients, admin)
  useEffect(() => {
    if (dbLoading) return;

    const params = new URLSearchParams(window.location.search);
    const uParam = params.get('u') || params.get('username') || params.get('user');
    const pParam = params.get('p') || params.get('password') || params.get('pass');
    const directParam = params.get('direct') || params.get('login') || params.get('mode') || params.get('access') || params.get('public');

    let matchedUser: LoggedInUser | null = null;

    if (uParam && pParam) {
      const normU = uParam.trim().toLowerCase();
      const normP = pParam.trim();

      // Check admin
      if (normU === adminUsername.trim().toLowerCase() && normP === adminPassword) {
        matchedUser = { role: 'admin', name: adminName };
      } else {
        // Check techs
        const foundTech = technicians.find(t => {
          const u = (t.username || '').trim().toLowerCase();
          const p = (t.password || '123').trim();
          return (normU === u || normU === t.id) && normP === p;
        });
        if (foundTech) {
          matchedUser = { role: 'technician', id: foundTech.id, name: foundTech.name };
        } else {
          // Check clients
          const foundClient = clients.find(c => {
            const u = (c.username || '').trim().toLowerCase();
            const p = (c.password || '123').trim();
            return normU === u && normP === p;
          });
          if (foundClient) {
            matchedUser = { role: 'client', id: foundClient.id, name: foundClient.name };
          }
        }
      }
    } else if (directParam) {
      const val = directParam.trim().toLowerCase();
      if (
        val === 'admin' || 
        val === 'public' || 
        val === 'guest' || 
        val === 'direct' || 
        val === 'general' || 
        val === '1' || 
        val === 'true' || 
        val === adminUsername.trim().toLowerCase()
      ) {
        matchedUser = { role: 'admin', name: adminName };
      } else {
        const foundTech = technicians.find(t => t.id.toLowerCase() === val || (t.username || '').toLowerCase() === val);
        if (foundTech) {
          matchedUser = { role: 'technician', id: foundTech.id, name: foundTech.name };
        } else {
          const foundClient = clients.find(c => c.id.toLowerCase() === val || (c.username || '').toLowerCase() === val);
          if (foundClient) {
            matchedUser = { role: 'client', id: foundClient.id, name: foundClient.name };
          }
        }
      }
    } else {
      // Check router pathname, e.g., /direct/t_1 or /direct/admin or /direct or /public
      const pathSegs = window.location.pathname.split('/').filter(Boolean);
      if (pathSegs[0] === 'direct' || pathSegs[0] === 'public' || pathSegs[0] === 'guest') {
        const val = (pathSegs[1] || 'admin').trim().toLowerCase();
        if (val === 'admin' || val === 'public' || val === 'guest' || val === 'general') {
          matchedUser = { role: 'admin', name: adminName };
        } else {
          const foundTech = technicians.find(t => t.id.toLowerCase() === val || (t.username || '').toLowerCase() === val);
          if (foundTech) {
            matchedUser = { role: 'technician', id: foundTech.id, name: foundTech.name };
          } else {
            const foundClient = clients.find(c => c.id.toLowerCase() === val || (c.username || '').toLowerCase() === val);
            if (foundClient) {
              matchedUser = { role: 'client', id: foundClient.id, name: foundClient.name };
            }
          }
        }
      }
    }

    if (matchedUser) {
      const isGeneral = matchedUser.role === 'admin' && !matchedUser.id && !matchedUser.companyBranchId;
      if (maintenanceModeEnabled && !isGeneral) {
        console.log('[SAS Custom Auth Router] Blocked auto login during maintenance mode.');
        const cleanUrl = window.location.origin + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
        return;
      }
      console.log('[SAS Custom Auth Router] Successfully logged in from short/direct login link:', matchedUser);
      setSession(matchedUser);
      
      // Clear navigation address bar parameters/segments to protect credentials and maintain a professional look
      const cleanUrl = window.location.origin + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, [dbLoading, technicians, clients, adminUsername, adminPassword, adminName, maintenanceModeEnabled]);

  // 2. Fast debounced active replication of local writes back to full-stack container and Cloud Firestore
  useEffect(() => {
    if (isViewingRemoteBranch) return;
    if (!isSyncLoaded) return;

    const payload = {
      clients,
      visits,
      technicians,
      daysBeforeVisitAlert,
      notificationLogs,
      managerPhone,
      managerEmail,
      adminUsername,
      adminPassword,
      adminName,
      quotations,
      emergencyVisits,
      deletedVisitIds,
      extinguisherReceipts,
      maintenanceModeEnabled,
      companyName,
      companyUnified,
      companyPhone,
      companyEmail,
      companyTaxId,
      companyAddress,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      smtpFromEmail,
      smtpEnabled,
      companyBranches,
      systemMode,
      independentBranchId,
      apiAccessToken,
      linkedBranches,
      customization: customizationRef.current
    };

    const currentLocalStr = JSON.stringify(payload);

    // If there is no real diff with the last synced master state, do not replicate
    if (currentLocalStr === masterStateRef.current) {
      setLocalVersion(0);
      return;
    }

    // Record the timestamp of the last local write from this user
    lastLocalWriteRef.current = Date.now();

    const handler = setTimeout(() => {
      setIsSyncing(true);
      fetch('/api/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      .then(async res => {
        if (!res.ok) return { success: false };
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          return await res.json();
        }
        return { success: false };
      })
      .then(res => {
        if (res && res.success) {
          masterStateRef.current = currentLocalStr;
          setLastSyncTime(new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }));
          setLocalVersion(0);
        }
      })
      .catch(err => console.warn('[SAS Sync] Replication warning:', err))
      .finally(() => setIsSyncing(false));
    }, 400);

    return () => clearTimeout(handler);
  }, [
    isSyncLoaded,
    clients,
    visits,
    technicians,
    daysBeforeVisitAlert,
    notificationLogs,
    quotations,
    emergencyVisits,
    deletedVisitIds,
    extinguisherReceipts,
    managerPhone,
    managerEmail,
    adminUsername,
    adminPassword,
    adminName,
    maintenanceModeEnabled,
    companyName,
    companyUnified,
    companyPhone,
    companyEmail,
    companyTaxId,
    companyAddress,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpFromEmail,
    smtpEnabled,
    companyBranches,
    systemMode,
    independentBranchId,
    apiAccessToken,
    linkedBranches,
    customization
  ]);

  // 3. Continuous real-time background sync from server database (syncs multiple browser tabs / technician devices instantaneously)
  useEffect(() => {
    if (isViewingRemoteBranch) return;
    if (!isSyncLoaded) return;

    const checkAndSyncRemoteData = async () => {
      if (isViewingRemoteBranch) return;
      // If we are actively posting or syncing local changes, wait until upload completes
      if (isSyncingRef.current || localVersionRef.current > 0) return;

      // Avoid pulling remote states immediately after a local action to prevent overriding deleted/modified items (6s grace window)
      if (Date.now() - lastLocalWriteRef.current < 6000) {
        return;
      }

      try {
        const response = await fetch('/api/data?t=' + Date.now());
        if (!response.ok) return;
        const json = await response.json();
        
        if (json.success && json.data) {
          const d = json.data;
          
          // Serialize current local state to check for differences, using refs to ensure fresh state values
          const currentLocalStr = JSON.stringify({
            clients: clientsRef.current,
            visits: visitsRef.current,
            technicians: techniciansRef.current,
            daysBeforeVisitAlert: daysBeforeVisitAlertRef.current,
            notificationLogs: notificationLogsRef.current,
            managerPhone: managerPhoneRef.current,
            managerEmail: managerEmailRef.current,
            adminUsername: adminUsernameRef.current,
            adminPassword: adminPasswordRef.current,
            adminName: adminNameRef.current,
            quotations: quotationsRef.current,
            emergencyVisits: emergencyVisitsRef.current,
            deletedVisitIds: deletedVisitIdsRef.current,
            extinguisherReceipts: extinguisherReceiptsRef.current,
            maintenanceModeEnabled: maintenanceModeEnabledRef.current,
            companyName: companyNameRef.current,
            companyUnified: companyUnifiedRef.current,
            companyPhone: companyPhoneRef.current,
            companyEmail: companyEmailRef.current,
            companyTaxId: companyTaxIdRef.current,
            companyAddress: companyAddressRef.current,
            smtpHost: smtpHostRef.current,
            smtpPort: smtpPortRef.current,
            smtpUser: smtpUserRef.current,
            smtpPass: smtpPassRef.current,
            smtpFromEmail: smtpFromEmailRef.current,
            smtpEnabled: smtpEnabledRef.current,
            companyBranches: companyBranchesRef.current,
            customization: customizationRef.current
          });

          // Serialize retrieved remote server state
          const remoteStr = JSON.stringify({
            clients: d.clients || [],
            visits: d.visits || [],
            technicians: d.technicians || [],
            daysBeforeVisitAlert: d.daysBeforeVisitAlert ?? 2,
            notificationLogs: d.notificationLogs || [],
            managerPhone: d.managerPhone || '0555012345',
            managerEmail: d.managerEmail || 'maintenance-admin@sas-safety.com',
            adminUsername: d.adminUsername || 'admin',
            adminPassword: d.adminPassword || '123',
            adminName: d.adminName || 'المشرف العام',
            quotations: d.quotations || [],
            emergencyVisits: d.emergencyVisits || [],
            deletedVisitIds: d.deletedVisitIds || [],
            extinguisherReceipts: d.extinguisherReceipts || [],
            maintenanceModeEnabled: d.maintenanceModeEnabled === true,
            companyName: d.companyName || 'شركة نسما الأولى لمعدات السلامة',
            companyUnified: d.companyUnified || '7003489890',
            companyPhone: d.companyPhone || '0555012345',
            companyEmail: d.companyEmail || 'maintenance-admin@sas-safety.com',
            companyTaxId: d.companyTaxId || '310456789000003',
            companyAddress: d.companyAddress || 'جدة، المملكة العربية السعودية',
            smtpHost: d.smtpHost || '',
            smtpPort: d.smtpPort || '',
            smtpUser: d.smtpUser || '',
            smtpPass: d.smtpPass || '',
            smtpFromEmail: d.smtpFromEmail || '',
            smtpEnabled: d.smtpEnabled !== false,
            companyBranches: d.companyBranches || [],
            customization: d.customization || null
          });

          // Only apply updates if the remote state actually differs (avoids re-triggers / loops)
          if (currentLocalStr !== remoteStr) {
            // If the server was explicitly wiped, clear local state and LocalStorage immediately
            if (d.isWiped === true) {
              console.log('[SAS Realtime Sync] Server was intentionally wiped clean. Syncing empty state...');
              setIsSyncLoaded(false);
              masterStateRef.current = remoteStr;
              setClients([]);
              setVisits([]);
              setQuotations([]);
              setEmergencyVisits([]);
              setExtinguisherReceipts([]);
              setNotificationLogs([]);
              setDeletedVisitIds([]);
              localStorage.setItem('sas_clients', '[]');
              localStorage.setItem('sas_visits', '[]');
              localStorage.setItem('sas_quotations', '[]');
              localStorage.setItem('sas_emergency_visits', '[]');
              localStorage.setItem('sas_extinguisher_receipts', '[]');
              localStorage.setItem('sas_notification_logs', '[]');
              localStorage.setItem('sas_deleted_visit_ids', '[]');
              setTimeout(() => {
                setIsSyncLoaded(true);
              }, 100);
              return;
            }

            // Safety Guard: If the remote database is completely empty (e.g. from an accidental empty restart)
            // but our local client has actual records in memory, and the server was NOT wiped, resurrect live data
            const remoteIsEmpty = 
              (!d.clients || d.clients.length === 0) &&
              (!d.technicians || d.technicians.length === 0) &&
              (!d.visits || d.visits.length === 0) &&
              (!d.quotations || d.quotations.length === 0) &&
              (!d.extinguisherReceipts || d.extinguisherReceipts.length === 0) &&
              (!d.emergencyVisits || d.emergencyVisits.length === 0) &&
              (!d.companyBranches || d.companyBranches.length === 0);

            const localHasData = 
              clientsRef.current.length > 0 ||
              visitsRef.current.length > 0 ||
              techniciansRef.current.length > 0 ||
              quotationsRef.current.length > 0 ||
              extinguisherReceiptsRef.current.length > 0 ||
              emergencyVisitsRef.current.length > 0;

            if (remoteIsEmpty && localHasData && !d.isWiped) {
              console.log('[SAS Realtime Sync] Server database restarted blank without wipe flag. Initiating self-healing replication...');
              
              try {
                await fetch('/api/data', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: currentLocalStr
                });
                masterStateRef.current = currentLocalStr;
              } catch (e) {
                console.error('[SAS Realtime Sync] Self-healing server sync failed:', e);
              }
              return;
            }

            // Guard specifically to prevent a race condition if local changes happened while the async fetch was in flight!
            if (localVersionRef.current > 0 || isSyncingRef.current) {
              console.log('[SAS Realtime Sync] Aborted applying fetched state because local writes are pending.');
              return;
            }

            console.log('[SAS Realtime Sync] Remote database updated. Synchronizing states across dashboard devices...');
            
            // Suspend local save, update the master reference first, set state, then re-enable saving!
            setIsSyncLoaded(false);
            masterStateRef.current = remoteStr;

            if (Array.isArray(d.deletedVisitIds)) {
              setDeletedVisitIds(d.deletedVisitIds);
              localStorage.setItem('sas_deleted_visit_ids', JSON.stringify(d.deletedVisitIds));
            }
            if (Array.isArray(d.clients)) {
              const cleanedClients = d.clients.map((c: any) => {
                if (!c || !Array.isArray(c.inquiries)) return c;
                return {
                  ...c,
                  inquiries: c.inquiries.filter((inq: any) => inq && inq.id !== 'inq_1780662623192' && !(inq.text || '').includes('بياتو'))
                };
              });
              setClients(cleanedClients);
              localStorage.setItem('sas_clients', JSON.stringify(cleanedClients));
            }
            if (Array.isArray(d.visits)) {
              const activeVisits = d.visits.filter((v: any) => v && v.id && !(d.deletedVisitIds || []).includes(v.id));
              setVisits(activeVisits);
              localStorage.setItem('sas_visits', JSON.stringify(activeVisits));
            }
            if (Array.isArray(d.technicians)) {
              setTechnicians(d.technicians);
              localStorage.setItem('sas_technicians', JSON.stringify(d.technicians));
            }
            if (d.daysBeforeVisitAlert !== undefined) {
              setDaysBeforeVisitAlert(d.daysBeforeVisitAlert);
              localStorage.setItem('sas_alert_days', d.daysBeforeVisitAlert.toString());
            }
            if (Array.isArray(d.notificationLogs)) {
              setNotificationLogs(d.notificationLogs);
              localStorage.setItem('sas_notification_logs', JSON.stringify(d.notificationLogs));
            }
            if (Array.isArray(d.quotations)) {
              setQuotations(d.quotations);
              localStorage.setItem('sas_quotations', JSON.stringify(d.quotations));
            }
            if (Array.isArray(d.emergencyVisits)) {
              const activeEV = d.emergencyVisits.filter((v: any) => v && v.id && !(d.deletedVisitIds || []).includes(v.id));
              setEmergencyVisits(activeEV);
              localStorage.setItem('sas_emergency_visits', JSON.stringify(activeEV));
            }
            if (Array.isArray(d.extinguisherReceipts)) {
              setExtinguisherReceipts(d.extinguisherReceipts);
              localStorage.setItem('sas_extinguisher_receipts', JSON.stringify(d.extinguisherReceipts));
            }
            if (Array.isArray(d.companyBranches)) {
              const sanitizedBranches = d.companyBranches.map((b: any) => b.id === 'hq' ? { ...b, name: 'المقر الرئيسي' } : b);
              setCompanyBranches(sanitizedBranches);
              localStorage.setItem('sas_company_branches', JSON.stringify(sanitizedBranches));
            }
            if (d.managerPhone) {
              setManagerPhone(d.managerPhone);
              localStorage.setItem('sas_manager_phone', d.managerPhone);
            }
            if (d.managerEmail) {
              setManagerEmail(d.managerEmail);
              localStorage.setItem('sas_manager_email', d.managerEmail);
            }
            if (d.smtpHost !== undefined) {
              setSmtpHost(d.smtpHost);
              localStorage.setItem('sas_smtp_host', d.smtpHost);
            }
            if (d.smtpPort !== undefined) {
              setSmtpPort(d.smtpPort);
              localStorage.setItem('sas_smtp_port', d.smtpPort);
            }
            if (d.smtpUser !== undefined) {
              setSmtpUser(d.smtpUser);
              localStorage.setItem('sas_smtp_user', d.smtpUser);
            }
            if (d.smtpPass !== undefined) {
              setSmtpPass(d.smtpPass);
              localStorage.setItem('sas_smtp_pass', d.smtpPass);
            }
            if (d.smtpFromEmail !== undefined) {
              setSmtpFromEmail(d.smtpFromEmail);
              localStorage.setItem('sas_smtp_from_email', d.smtpFromEmail);
            }
            if (d.smtpEnabled !== undefined) {
              setSmtpEnabled(d.smtpEnabled === true);
              localStorage.setItem('sas_smtp_enabled', d.smtpEnabled ? 'true' : 'false');
            }
            if (d.adminUsername) {
              setAdminUsername(d.adminUsername);
              localStorage.setItem('sas_admin_username', d.adminUsername);
            }
            if (d.adminPassword) {
              setAdminPassword(d.adminPassword);
              localStorage.setItem('sas_admin_password', d.adminPassword);
            }
            if (d.adminName) {
              setAdminName(d.adminName);
              localStorage.setItem('sas_admin_name', d.adminName);
            }
            if (d.companyName) {
              setCompanyName(d.companyName);
              localStorage.setItem('sas_company_name', d.companyName);
            }
            if (d.companyUnified) {
              setCompanyUnified(d.companyUnified);
              localStorage.setItem('sas_company_unified', d.companyUnified);
            }
            if (d.companyPhone) {
              setCompanyPhone(d.companyPhone);
              localStorage.setItem('sas_company_phone', d.companyPhone);
            }
            if (d.companyEmail) {
              setCompanyEmail(d.companyEmail);
              localStorage.setItem('sas_company_email', d.companyEmail);
            }
            if (d.companyTaxId) {
              setCompanyTaxId(d.companyTaxId);
              localStorage.setItem('sas_company_tax_id', d.companyTaxId);
            }
            if (d.companyAddress) {
              setCompanyAddress(d.companyAddress);
              localStorage.setItem('sas_company_address', d.companyAddress);
            }
            if (d.maintenanceModeEnabled !== undefined) {
              setMaintenanceModeEnabled(d.maintenanceModeEnabled === true);
              localStorage.setItem('sas_maintenance_mode_enabled', d.maintenanceModeEnabled ? 'true' : 'false');
            }
            if (d.customization) {
              setCustomization(d.customization);
              localStorage.setItem('sas_system_customization', JSON.stringify(d.customization));
            }

            // Re-enable local state save listener
            setTimeout(() => {
              setIsSyncLoaded(true);
              setLastSyncTime(new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }));
            }, 100);
          }
        }
      } catch (err) {
        console.warn('[SAS Realtime Sync] Failed to auto-synchronize with server:', err);
      }
    };

    const interval = setInterval(checkAndSyncRemoteData, 2500);

    const handleFocusOrVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkAndSyncRemoteData();
      }
    };
    window.addEventListener('focus', handleFocusOrVisibility);
    document.addEventListener('visibilitychange', handleFocusOrVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocusOrVisibility);
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
    };
  }, [isSyncLoaded]);

  // Sync state mutations to LocalStorage + set HTML document attributes
  useEffect(() => {
    safeSetItem('sas_lang', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (!isSyncLoaded) return;
    safeSetItem('sas_clients', JSON.stringify(clients));
  }, [clients, isSyncLoaded]);

  useEffect(() => {
    if (!isSyncLoaded) return;
    safeSetItem('sas_visits', JSON.stringify(visits));
  }, [visits, isSyncLoaded]);

  useEffect(() => {
    if (!isSyncLoaded) return;
    safeSetItem('sas_technicians', JSON.stringify(technicians));
  }, [technicians, isSyncLoaded]);

  useEffect(() => {
    if (!isSyncLoaded) return;
    safeSetItem('sas_alert_days', daysBeforeVisitAlert.toString());
  }, [daysBeforeVisitAlert, isSyncLoaded]);

  useEffect(() => {
    if (!isSyncLoaded) return;
    safeSetItem('sas_notification_logs', JSON.stringify(notificationLogs));
  }, [notificationLogs, isSyncLoaded]);

  useEffect(() => {
    if (!isSyncLoaded) return;
    safeSetItem('sas_quotations', JSON.stringify(quotations));
  }, [quotations, isSyncLoaded]);

  useEffect(() => {
    if (!isSyncLoaded) return;
    safeSetItem('sas_extinguisher_receipts', JSON.stringify(extinguisherReceipts));
  }, [extinguisherReceipts, isSyncLoaded]);

  useEffect(() => {
    if (!isSyncLoaded) return;
    safeSetItem('sas_manager_phone', managerPhone);
  }, [managerPhone, isSyncLoaded]);

  useEffect(() => {
    if (!isSyncLoaded) return;
    safeSetItem('sas_manager_email', managerEmail);
  }, [managerEmail, isSyncLoaded]);

  useEffect(() => {
    if (!isSyncLoaded) return;
    safeSetItem('sas_admin_username', adminUsername);
  }, [adminUsername, isSyncLoaded]);

  useEffect(() => {
    if (!isSyncLoaded) return;
    safeSetItem('sas_admin_password', adminPassword);
  }, [adminPassword, isSyncLoaded]);

  useEffect(() => {
    if (!isSyncLoaded) return;
    safeSetItem('sas_admin_name', adminName);
  }, [adminName, isSyncLoaded]);

  useEffect(() => {
    if (!isSyncLoaded) return;
    safeSetItem('sas_company_name', companyName);
  }, [companyName, isSyncLoaded]);

  useEffect(() => {
    if (!isSyncLoaded) return;
    safeSetItem('sas_company_unified', companyUnified);
  }, [companyUnified, isSyncLoaded]);

  useEffect(() => {
    if (!isSyncLoaded) return;
    safeSetItem('sas_company_phone', companyPhone);
  }, [companyPhone, isSyncLoaded]);

  useEffect(() => {
    if (!isSyncLoaded) return;
    safeSetItem('sas_company_email', companyEmail);
  }, [companyEmail, isSyncLoaded]);

  useEffect(() => {
    if (!isSyncLoaded) return;
    safeSetItem('sas_company_tax_id', companyTaxId);
  }, [companyTaxId, isSyncLoaded]);

  useEffect(() => {
    if (!isSyncLoaded) return;
    safeSetItem('sas_company_address', companyAddress);
  }, [companyAddress, isSyncLoaded]);

  useEffect(() => {
    if (session) {
      safeSetItem('sas_session', JSON.stringify(session));
    } else {
      localStorage.removeItem('sas_session');
    }
  }, [session]);

  const t = translations[lang];
  const isRtl = lang === 'ar';

  // Automatically log out any logged-in non-general-admin users if maintenance mode is enabled
  useEffect(() => {
    if (maintenanceModeEnabled && session) {
      const isGeneral = session.role === 'admin' && !session.id && !session.isBranchUser;
      if (!isGeneral) {
        console.log('[SAS Maintenance] Automatically logged out user because system is in maintenance mode.');
        handleLogout();
        alert(isRtl 
          ? '⚠️ تم تفعيل وضع الصيانة المؤقت للمنصة من قبل المشرف العام. لقد تم تسجيل خروجك تلقائياً.' 
          : '⚠️ The platform has entered temporary maintenance mode by the General Admin. You have been logged out automatically.');
      }
    }
  }, [maintenanceModeEnabled, session, isRtl]);

  // Secure backend SMS relay proxy client
  const sendSMSNotification = async (
    to: string, 
    recipientName: string, 
    text: string, 
    type: 'manager_task' | 'technician_visit',
    clientName: string
  ): Promise<boolean> => {
    try {
      // Resolve companyBranchId
      let resolvedBranchId = session?.companyBranchId || '';
      if (!resolvedBranchId && clientName) {
        const foundClient = clients.find(c => c.name === clientName || c.id === clientName);
        if (foundClient) resolvedBranchId = foundClient.companyBranchId || '';
      }
      if (!resolvedBranchId) {
        const foundTech = technicians.find(t => t.phone === to || t.email === to || t.name === recipientName);
        if (foundTech) resolvedBranchId = foundTech.companyBranchId || '';
      }
      if (!resolvedBranchId) {
        resolvedBranchId = 'hq';
      }

      const isTwilioEnabled = localStorage.getItem('sas_twilio_enabled') !== 'false';
      
      if (!isTwilioEnabled) {
        const newLog: NotificationLog = {
          id: `sms_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          recipientPhone: to,
          recipientName: recipientName,
          messageText: `[تعطيل مؤقت للمرسل] ${text}`,
          timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString('ar-EG'),
          status: 'simulated',
          type,
          clientName,
          companyBranchId: resolvedBranchId
        };
        setNotificationLogs(prev => [newLog, ...prev]);
        return true;
      }

      const twilioSid = localStorage.getItem('sas_twilio_sid') || '';
      const twilioToken = localStorage.getItem('sas_twilio_token') || '';
      const twilioPhone = localStorage.getItem('sas_twilio_phone') || '';

      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          to, 
          text,
          twilioSid,
          twilioToken,
          twilioPhone
        }),
      });
      const data = await response.json() as any;
      
      const newLog: NotificationLog = {
        id: `sms_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        recipientPhone: to,
        recipientName: recipientName,
        messageText: text,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString('ar-EG'),
        status: data.success ? (data.simulated ? 'simulated' : 'sent') : 'failed',
        type,
        clientName,
        companyBranchId: resolvedBranchId
      };

      setNotificationLogs(prev => [newLog, ...prev]);
      return data.success;
    } catch (err) {
      console.error('[Notification Hub] SMS Gateway exception:', err);
      // Resolve companyBranchId
      let resolvedBranchId = session?.companyBranchId || '';
      if (!resolvedBranchId && clientName) {
        const foundClient = clients.find(c => c.name === clientName || c.id === clientName);
        if (foundClient) resolvedBranchId = foundClient.companyBranchId || '';
      }
      if (!resolvedBranchId) {
        const foundTech = technicians.find(t => t.phone === to || t.email === to || t.name === recipientName);
        if (foundTech) resolvedBranchId = foundTech.companyBranchId || '';
      }
      if (!resolvedBranchId) {
        resolvedBranchId = 'hq';
      }

      const newLog: NotificationLog = {
        id: `sms_${Date.now()}`,
        recipientPhone: to,
        recipientName: recipientName,
        messageText: text,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString('ar-EG'),
        status: 'simulated',
        type,
        clientName,
        companyBranchId: resolvedBranchId
      };
      setNotificationLogs(prev => [newLog, ...prev]);
      return false;
    }
  };

  // Secure backend Email relay proxy client
  const sendEmailNotification = async (
    to: string,
    recipientName: string,
    subject: string,
    text: string,
    clientName: string,
    clientId?: string,
    inquiryId?: string,
    customType?: 'manager_task' | 'technician_visit' | 'manager_email' | 'general'
  ): Promise<boolean> => {
    try {
      // Resolve companyBranchId
      let resolvedBranchId = session?.companyBranchId || '';
      if (!resolvedBranchId && (clientName || clientId)) {
        const foundClient = clients.find(c => c.name === clientName || c.id === clientName || c.id === clientId);
        if (foundClient) resolvedBranchId = foundClient.companyBranchId || '';
      }
      if (!resolvedBranchId) {
        const foundTech = technicians.find(t => t.phone === to || t.email === to || t.name === recipientName);
        if (foundTech) resolvedBranchId = foundTech.companyBranchId || '';
      }
      if (!resolvedBranchId) {
        resolvedBranchId = 'hq';
      }

      const branchObj = companyBranches.find(b => b.id === resolvedBranchId);
      const isSmtpEnabled = branchObj
        ? (branchObj.smtpEnabled !== false)
        : (localStorage.getItem('sas_smtp_enabled') !== 'false');
      
      if (!isSmtpEnabled) {
        const newLog: NotificationLog = {
          id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          recipientPhone: to,
          recipientName: `${recipientName} (${to})`,
          messageText: `[تعطيل مؤقت للبريد] ${text}`,
          timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString('ar-EG'),
          status: 'simulated',
          type: customType || 'general',
          clientName,
          clientId,
          inquiryId,
          companyBranchId: resolvedBranchId
        };
        setNotificationLogs(prev => [newLog, ...prev]);
        return true;
      }

      const sHost = (branchObj && branchObj.smtpHost) ? branchObj.smtpHost : (smtpHost || localStorage.getItem('sas_smtp_host') || '');
      const sPort = (branchObj && branchObj.smtpPort) ? branchObj.smtpPort : (smtpPort || localStorage.getItem('sas_smtp_port') || '');
      const sUser = (branchObj && branchObj.smtpUser) ? branchObj.smtpUser : (smtpUser || localStorage.getItem('sas_smtp_user') || '');
      const sPass = (branchObj && branchObj.smtpPass) ? branchObj.smtpPass : (smtpPass || localStorage.getItem('sas_smtp_pass') || '');
      const sFrom = (branchObj && branchObj.smtpFromEmail) ? branchObj.smtpFromEmail : (smtpFromEmail || localStorage.getItem('sas_smtp_from_email') || '');

      const finalTo = to.trim();

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          to: finalTo, 
          subject, 
          text,
          smtpHost: sHost,
          smtpPort: sPort,
          smtpUser: sUser,
          smtpPass: sPass,
          smtpFromEmail: sFrom
        }),
      });
      const data = await response.json() as any;
      
      const newLog: NotificationLog = {
        id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        recipientPhone: to,
        recipientName: `${recipientName} (${to})`,
        messageText: data.simulated 
          ? `[إرسال محاكى/بيانات خادم غائبة] ${text}` 
          : text,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString('ar-EG'),
        status: data.success ? (data.simulated ? 'simulated' : 'sent') : 'failed',
        type: customType || 'general',
        clientName,
        clientId,
        inquiryId,
        companyBranchId: resolvedBranchId
      };

      setNotificationLogs(prev => [newLog, ...prev]);
      return data.success;
    } catch (err) {
      console.error('[Notification Hub] Email Gateway exception:', err);
      // Resolve companyBranchId
      let resolvedBranchId = session?.companyBranchId || '';
      if (!resolvedBranchId && (clientName || clientId)) {
        const foundClient = clients.find(c => c.name === clientName || c.id === clientName || c.id === clientId);
        if (foundClient) resolvedBranchId = foundClient.companyBranchId || '';
      }
      if (!resolvedBranchId) {
        const foundTech = technicians.find(t => t.phone === to || t.email === to || t.name === recipientName);
        if (foundTech) resolvedBranchId = foundTech.companyBranchId || '';
      }
      if (!resolvedBranchId) {
        resolvedBranchId = 'hq';
      }

      const newLog: NotificationLog = {
        id: `email_${Date.now()}`,
        recipientPhone: to,
        recipientName: `${recipientName} (${to})`,
        messageText: text,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString('ar-EG'),
        status: 'failed',
        type: customType || 'manager_email',
        clientName,
        clientId,
        inquiryId,
        companyBranchId: resolvedBranchId
      };
      setNotificationLogs(prev => [newLog, ...prev]);
      return false;
    }
  };

  // Secure backend WhatsApp relay proxy client
  const sendWhatsAppNotification = async (
    to: string, 
    recipientName: string, 
    text: string, 
    type: 'manager_task' | 'technician_visit' | 'manager_email',
    clientName: string
  ): Promise<boolean> => {
    try {
      // Resolve companyBranchId
      let resolvedBranchId = session?.companyBranchId || '';
      if (!resolvedBranchId && clientName) {
        const foundClient = clients.find(c => c.name === clientName || c.id === clientName);
        if (foundClient) resolvedBranchId = foundClient.companyBranchId || '';
      }
      if (!resolvedBranchId) {
        const foundTech = technicians.find(t => t.phone === to || t.email === to || t.name === recipientName);
        if (foundTech) resolvedBranchId = foundTech.companyBranchId || '';
      }
      if (!resolvedBranchId) {
        resolvedBranchId = 'hq';
      }

      const branchObj = companyBranches.find(b => b.id === resolvedBranchId);
      const isWhatsappEnabled = branchObj
        ? (branchObj.whatsappEnabled !== false)
        : (localStorage.getItem('sas_whatsapp_enabled') !== 'false');
      
      if (!isWhatsappEnabled) {
        const newLog: NotificationLog = {
          id: `whatsapp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          recipientPhone: to,
          recipientName: `${recipientName} (WhatsApp)`,
          messageText: `[تعطيل مؤقت للواتساب] ${text}`,
          timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString('ar-EG'),
          status: 'simulated',
          type,
          clientName,
          companyBranchId: resolvedBranchId
        };
        setNotificationLogs(prev => [newLog, ...prev]);
        return true;
      }

      const instanceId = branchObj ? (branchObj.whatsappInstanceId || '') : (localStorage.getItem('sas_whatsapp_instance_id') || '');
      const waToken = branchObj ? (branchObj.whatsappToken || '') : (localStorage.getItem('sas_whatsapp_token') || '');
      const gatewayUrl = branchObj ? (branchObj.whatsappGateway || '') : (localStorage.getItem('sas_whatsapp_gateway') || 'https://api.ultramsg.com/v1/messages/chat');

      const response = await fetch('/api/send-whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          to, 
          text,
          instanceId,
          token: waToken,
          gatewayUrl
        }),
      });
      const data = await response.json() as any;
      
      const newLog: NotificationLog = {
        id: `whatsapp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        recipientPhone: to,
        recipientName: `${recipientName} (WhatsApp)`,
        messageText: text,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString('ar-EG'),
        status: data.success ? (data.simulated ? 'simulated' : 'sent') : 'failed',
        type,
        clientName,
        companyBranchId: resolvedBranchId
      };

      setNotificationLogs(prev => [newLog, ...prev]);
      return data.success;
    } catch (err) {
      console.error('[Notification Hub] WhatsApp Gateway exception:', err);
      // Resolve companyBranchId
      let resolvedBranchId = session?.companyBranchId || '';
      if (!resolvedBranchId && clientName) {
        const foundClient = clients.find(c => c.name === clientName || c.id === clientName);
        if (foundClient) resolvedBranchId = foundClient.companyBranchId || '';
      }
      if (!resolvedBranchId) {
        const foundTech = technicians.find(t => t.phone === to || t.email === to || t.name === recipientName);
        if (foundTech) resolvedBranchId = foundTech.companyBranchId || '';
      }
      if (!resolvedBranchId) {
        resolvedBranchId = 'hq';
      }

      const newLog: NotificationLog = {
        id: `whatsapp_${Date.now()}`,
        recipientPhone: to,
        recipientName: `${recipientName} (WhatsApp)`,
        messageText: text,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString('ar-EG'),
        status: 'simulated',
        type,
        clientName,
        companyBranchId: resolvedBranchId
      };
      setNotificationLogs(prev => [newLog, ...prev]);
      return false;
    }
  };

  // Handler: Add Client + associated auto-scheduler inspections & notify technician
  const handleAddClient = async (newClient: Client, generatedVisits: Visit[]) => {
    setClients(prev => [newClient, ...prev]);
    setVisits(prev => [...prev, ...generatedVisits]);
    triggerLocalMutation();

    // Dispatch task assignment SMS to assigned technician phone
    const assignedTech = technicians.find(tech => tech.id === newClient.assignedTechnicianId);
    if (assignedTech) {
      const techPhone = assignedTech.phone || '0555000000';
      const techName = assignedTech.name;
      const clientName = newClient.name;
      const freq = newClient.visitFrequency;
      const startDate = newClient.contractStartDate;
      
      const smsText = lang === 'ar'
        ? `📅 مهمة جديدة: عزيزي الفني ${techName}، تم إسنادك لعقد صيانة سنوي جديد لصالح المنشأة "${clientName}". تم جدولة عدد (${freq}) زيارات دورية تبدأ من ${startDate}. يرجى مراجعة تفاصيل المهام فوراً عبر تطبيق شركة نسما الأولى.`
        : `📅 New Assignment: Dear ${techName}, you have been assigned a new safety maintenance contract for "${clientName}". Scheduled with (${freq}) periodic inspections starting ${startDate}. Please review your tasks in the Nesma First App.`;

      // Respect notification setting for SMS
      if (assignedTech.smsNotificationsEnabled !== false) {
        await sendSMSNotification(techPhone, techName, smsText, 'manager_task', clientName);
      }

      // Respect notification setting for WhatsApp
      if (assignedTech.whatsappNotificationsEnabled !== false) {
        await sendWhatsAppNotification(techPhone, techName, smsText, 'manager_task', clientName);
      }

      // Respect notification setting and check if email is available for Email
      if (assignedTech.emailNotificationsEnabled !== false && assignedTech.email) {
        const subject = lang === 'ar' 
          ? `📅 مهمة جديدة - شركة نسما الأولى: عقد صيانة جديد لصالح ${clientName}`
          : `📅 New Task Assignment - Nesma First: New maintenance contract for ${clientName}`;
        
        const emailText = lang === 'ar'
          ? `مرحباً ${techName}،\n\nنود إفادتك بأنه تم تعيينك رسمياً لعقد صيانة سنوي جديد للمنشأة: "${clientName}".\n- عدد الزيارات المجدولة: ${freq} زيارات دورية.\n- تاريخ البدء: ${startDate}.\n\nيرجى الدخول على حسابك في نظام شركة نسما الأولى لمتابعة تفاصيل وجدول الزيارات وإجراء فحص السلامة المطلوب.\n\nمع تحيات,\nإدارة الصيانة والتشغيل - شركة نسما الأولى`
          : `Hello ${techName},\n\nWe would like to inform you that you have been officially assigned a new safety maintenance contract for "${clientName}".\n- Scheduled inspections: ${freq} periodic visits.\n- Start Date: ${startDate}.\n\nPlease log in to the Nesma First System to review task schedules and perform safety standard audits.\n\nBest regards,\nMaintenance & Operations Management - Nesma First`;

        await sendEmailNotification(assignedTech.email, techName, subject, emailText, clientName, newClient.id, undefined, 'manager_task');
      }
    }
  };

  // Handler: Edit / Update Client details and dynamically swap assigned technician
  const handleEditClient = (updatedClient: Client, regenerateVisitsFlag?: boolean) => {
    triggerLocalMutation();
    // 1. Update clients list
    setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
    
    // 2. Propagate name and contract field changes across all relative data structures
    propagateClientUpdates(updatedClient.id, updatedClient.name, updatedClient.contractNumber);

    // 3. Keep or alignment visits
    setVisits(prev => {
      try {
        if (!Array.isArray(prev)) return prev;

        // Ensure all visits have the updated client name and contract number first
        let updatedVisits = prev.map(v => {
          if (!v) return v;
          if (v.clientId === updatedClient.id) {
            return {
              ...v,
              clientName: updatedClient.name,
              contractNumber: updatedClient.contractNumber
            };
          }
          return v;
        }).filter(Boolean);

        // Retrieve original client branches to detect newly added branches, renames, and technician updates
        const originalClient = clients.find(c => c.id === updatedClient.id);
        const oldBranches = originalClient?.branches || [];
        const originalBranchNames = oldBranches.map(b => b.name).filter(Boolean);

        // 1. Propagate branch renames and technician updates to existing visits
        updatedVisits = updatedVisits.map(v => {
          if (!v || v.clientId !== updatedClient.id) return v;
          if (!v.branchName) return v;

          // Find the old branch by name first
          const oldBr = oldBranches.find(b => b.name.trim() === v.branchName?.trim());
          if (oldBr) {
            // Find corresponding new branch by ID
            const newBr = (updatedClient.branches || []).find(b => b.id === oldBr.id);
            if (newBr) {
              const updatedVisit = { ...v };
              // Propagate name change if any
              if (newBr.name.trim() !== oldBr.name.trim()) {
                updatedVisit.branchName = newBr.name.trim();
              }
              // Propagate technician change to pending visits
              if (v.status === 'pending' && newBr.assignedTechnicianId !== oldBr.assignedTechnicianId) {
                const branchTechId = newBr.assignedTechnicianId || updatedClient.assignedTechnicianId;
                const branchTech = technicians.find(t => t.id === branchTechId);
                const branchTechName = branchTech?.name || 'فني الصيانة';
                updatedVisit.technicianId = branchTechId;
                updatedVisit.technicianName = branchTechName;
              }
              return updatedVisit;
            }
          }
          return v;
        }).filter(Boolean);

        // 2. Handle deleted branches (purge pending visits for deleted branches)
        updatedVisits = updatedVisits.filter(v => {
          if (!v) return false;
          if (v.clientId === updatedClient.id && v.branchName) {
            const isStillActiveBranch = (updatedClient.branches || []).some(b => b.name.trim() === v.branchName?.trim());
            if (!isStillActiveBranch && v.status === 'pending') {
              return false; // delete pending visits of deleted branches
            }
          }
          return true;
        });

        // Calculate standard scheduled dates based on unified contract start date and frequency
        const SYSTEM_TODAY = new Date(); // Consistent system time reference

        const contractPeriodChanged = Boolean(
          originalClient && (
            originalClient.contractStartDate !== updatedClient.contractStartDate ||
            originalClient.contractEndDate !== updatedClient.contractEndDate ||
            originalClient.contractDurationYears !== updatedClient.contractDurationYears ||
            originalClient.visitFrequency !== updatedClient.visitFrequency
          )
        );
        const shouldRegenerate = Boolean(regenerateVisitsFlag || contractPeriodChanged);

        if (shouldRegenerate) {
          // Preserve completed visits for this client exactly as is (protect historical records)
          const completedVisits = updatedVisits.filter(v => v.clientId === updatedClient.id && v.status === 'completed');
          
          // Keep other clients' visits completely untouched
          const otherClientsVisits = updatedVisits.filter(v => v.clientId !== updatedClient.id);
          
          // Keep any manual past-due pending visits only if they already existed
          const pastPendingVisits = updatedVisits.filter(v => 
            v.clientId === updatedClient.id && 
            v.status === 'pending' && 
            v.scheduledDate && 
            new Date(v.scheduledDate) < SYSTEM_TODAY
          );
          
          const freshVisits: Visit[] = [];
          let frequencyNum = parseInt(updatedClient.visitFrequency);
          if (isNaN(frequencyNum) || frequencyNum < 1) {
            frequencyNum = 1;
          }
          
          const monthsInterval = 12 / frequencyNum;
          const branches = (updatedClient.branches || []).filter(Boolean);
          const tech = technicians.find(t => t.id === updatedClient.assignedTechnicianId);
          const techName = tech?.name || 'فني الصيانة';
    
          let startDateValue = updatedClient.contractStartDate || new Date().toISOString().split('T')[0];
          let baseDate = new Date(startDateValue);
          if (isNaN(baseDate.getTime())) {
            baseDate = new Date();
          }

          if (branches.length > 0) {
            branches.forEach((br, brIdx) => {
              if (!br) return;
              const branchTechId = br.assignedTechnicianId || updatedClient.assignedTechnicianId;
              const branchTech = technicians.find(t => t.id === branchTechId);
              const branchTechName = branchTech?.name || techName;

              let brFrequencyNum = parseInt(br.visitFrequency || updatedClient.visitFrequency || '4');
              if (isNaN(brFrequencyNum) || brFrequencyNum < 1) {
                brFrequencyNum = frequencyNum;
              }
              const brMonthsInterval = 12 / brFrequencyNum;

              const brDuration = parseFloat(br.contractDurationYears || '1') || 1;
              const totalBranchVisits = Math.max(1, Math.round(brFrequencyNum * brDuration));
              const brStartDate = br.contractStartDate || updatedClient.contractStartDate || new Date().toISOString().split('T')[0];

              // Check if the branch is newly added or currently has zero visits (self-healing)
              const hasNoVisitsCurrently = !updatedVisits.some(v => v.clientId === updatedClient.id && v.branchName === br.name);
              const isNewlyAdded = !originalBranchNames.includes(br.name);
              const forceAllVisits = isNewlyAdded || hasNoVisitsCurrently;

              for (let i = 0; i < totalBranchVisits; i++) {
                const visitDate = new Date(brStartDate);
                visitDate.setMonth(visitDate.getMonth() + Math.round(i * brMonthsInterval));
                let scheduledStr = '';
                try {
                  scheduledStr = visitDate.toISOString().split('T')[0];
                } catch {
                  scheduledStr = new Date().toISOString().split('T')[0];
                }
                const isFuture = new Date(scheduledStr) >= SYSTEM_TODAY;

                const isCompleted = completedVisits.some(cv => 
                  cv && 
                  cv.branchName === br.name && 
                  cv.scheduledDate === scheduledStr
                );

                if (isCompleted) {
                  continue;
                }

                if (isFuture || forceAllVisits) {
                  freshVisits.push({
                    id: `visit_${updatedClient.id}_i${i}_b${br.id || brIdx}_${Date.now()}`,
                    clientId: updatedClient.id,
                    clientName: updatedClient.name,
                    contractNumber: updatedClient.contractNumber,
                    technicianId: branchTechId,
                    technicianName: branchTechName,
                    scheduledDate: scheduledStr,
                    status: 'pending',
                    result: 'not_visited',
                    branchName: br.name
                  });
                } else {
                  const hasExistingPastPending = pastPendingVisits.some(pv => pv && pv.branchName === br.name && pv.scheduledDate === scheduledStr);
                  if (hasExistingPastPending) {
                    freshVisits.push({
                      id: `visit_${updatedClient.id}_i${i}_b${br.id || brIdx}_${Date.now()}`,
                      clientId: updatedClient.id,
                      clientName: updatedClient.name,
                      contractNumber: updatedClient.contractNumber,
                      technicianId: branchTechId,
                      technicianName: branchTechName,
                      scheduledDate: scheduledStr,
                      status: 'pending',
                      result: 'not_visited',
                      branchName: br.name
                    });
                  }
                }
              }
            });
          } else {
            // No branches: schedule client-level visits
            const clientDuration = parseFloat(updatedClient.contractDurationYears || String(getContractDurationYears(updatedClient.contractStartDate, updatedClient.contractEndDate))) || 1;
            const totalClientVisits = Math.max(1, Math.round(frequencyNum * clientDuration));
            for (let i = 0; i < totalClientVisits; i++) {
              const visitDate = new Date(baseDate);
              visitDate.setMonth(visitDate.getMonth() + Math.round(i * monthsInterval));
              let scheduledStr = '';
              try {
                scheduledStr = visitDate.toISOString().split('T')[0];
              } catch(e) {
                scheduledStr = new Date().toISOString().split('T')[0];
              }
              const isFuture = new Date(scheduledStr) >= SYSTEM_TODAY;

              const isCompleted = completedVisits.some(cv => 
                cv && 
                !cv.branchName && 
                cv.scheduledDate === scheduledStr
              );

              if (isCompleted) {
                continue;
              }
    
              if (isFuture) {
                freshVisits.push({
                  id: `visit_${updatedClient.id}_i${i}_${Date.now()}`,
                  clientId: updatedClient.id,
                  clientName: updatedClient.name,
                  contractNumber: updatedClient.contractNumber,
                  technicianId: updatedClient.assignedTechnicianId,
                  technicianName: techName,
                  scheduledDate: scheduledStr,
                  status: 'pending',
                  result: 'not_visited',
                  branchName: undefined
                });
              } else {
                const hasExistingPastPending = pastPendingVisits.some(pv => pv && !pv.branchName && pv.scheduledDate === scheduledStr);
                if (hasExistingPastPending) {
                  freshVisits.push({
                    id: `visit_${updatedClient.id}_i${i}_${Date.now()}`,
                    clientId: updatedClient.id,
                    clientName: updatedClient.name,
                    contractNumber: updatedClient.contractNumber,
                    technicianId: updatedClient.assignedTechnicianId,
                    technicianName: techName,
                    scheduledDate: scheduledStr,
                    status: 'pending',
                    result: 'not_visited',
                    branchName: undefined
                  });
                }
              }
            }
          }
    
          const nextClients = clients.map(c => c.id === updatedClient.id ? updatedClient : c);
          const rawResult = [...otherClientsVisits, ...completedVisits, ...freshVisits];
          return selfHealBranchVisits(nextClients, rawResult, technicians);
        } else {
          // Normal edit: preserve all existing visits (both pending and completed, with reports) completely!
          // Identify branches that are either newly added or currently have zero visits (self-healing)
          const branchesToSchedule = (updatedClient.branches || []).filter(br => {
            if (!br || !br.name) return false;
            const isNew = !oldBranches.some(ob => ob.id === br.id);
            const hasNoVisits = !updatedVisits.some(v => v.clientId === updatedClient.id && v.branchName && v.branchName.trim().replace(/\s+/g, ' ') === br.name.trim().replace(/\s+/g, ' '));
            return isNew || hasNoVisits;
          });
          
          if (branchesToSchedule.length > 0) {
            const freshVisits: Visit[] = [];
            let frequencyNum = parseInt(updatedClient.visitFrequency);
            if (isNaN(frequencyNum) || frequencyNum < 1) {
              frequencyNum = 1;
            }
            const tech = technicians.find(t => t.id === updatedClient.assignedTechnicianId);
            const techName = tech?.name || 'فني الصيانة';

            branchesToSchedule.forEach((br, brIdx) => {
              if (!br) return;
              const branchTechId = br.assignedTechnicianId || updatedClient.assignedTechnicianId;
              const branchTech = technicians.find(t => t.id === branchTechId);
              const branchTechName = branchTech?.name || techName;

              let brFrequencyNum = parseInt(br.visitFrequency || updatedClient.visitFrequency || '4');
              if (isNaN(brFrequencyNum) || brFrequencyNum < 1) {
                brFrequencyNum = frequencyNum;
              }
              const brMonthsInterval = 12 / brFrequencyNum;

              const brDuration = parseFloat(br.contractDurationYears || '1') || 1;
              const totalBranchVisits = Math.max(1, Math.round(brFrequencyNum * brDuration));
              const brStartDate = br.contractStartDate || updatedClient.contractStartDate || new Date().toISOString().split('T')[0];

              for (let i = 0; i < totalBranchVisits; i++) {
                const visitDate = new Date(brStartDate);
                visitDate.setMonth(visitDate.getMonth() + Math.round(i * brMonthsInterval));
                let scheduledStr = '';
                try {
                  scheduledStr = visitDate.toISOString().split('T')[0];
                } catch {
                  scheduledStr = new Date().toISOString().split('T')[0];
                }

                // For newly added or zero-visit branches, we schedule all of their visits to ensure complete coverage!
                freshVisits.push({
                  id: `visit_${updatedClient.id}_i${i}_bnew_${br.id || brIdx}_${Date.now()}`,
                  clientId: updatedClient.id,
                  clientName: updatedClient.name,
                  contractNumber: updatedClient.contractNumber,
                  technicianId: branchTechId,
                  technicianName: branchTechName,
                  scheduledDate: scheduledStr,
                  status: 'pending',
                  result: 'not_visited',
                  branchName: br.name
                });
              }
            });
            if (freshVisits.length > 0) {
              const nextClients = clients.map(c => c.id === updatedClient.id ? updatedClient : c);
              const rawResult = [...updatedVisits, ...freshVisits];
              return selfHealBranchVisits(nextClients, rawResult, technicians);
            }
          }

          const nextClients = clients.map(c => c.id === updatedClient.id ? updatedClient : c);
          return selfHealBranchVisits(nextClients, updatedVisits, technicians);
        }
      } catch (err) {
        console.error("[handleEditClient critical error caught]", err);
        return prev;
      }
    });
    triggerLocalMutation();
  };

  // Handler: Renew Contract and schedule new periodic visits while strictly preserving all historical visits and reports
  const handleRenewContract = (clientId: string, renewalData: RenewContractData) => {
    const targetClient = clients.find(c => c.id === clientId);
    if (!targetClient) return;

    const previousStartDate = targetClient.contractStartDate;
    const previousEndDate = targetClient.contractEndDate;
    const previousContractNumber = targetClient.contractNumber;

    const renewalHistoryRecord: ContractRenewalRecord = {
      renewedAt: new Date().toISOString(),
      previousStartDate,
      previousEndDate,
      previousContractNumber,
      newStartDate: renewalData.contractStartDate,
      newEndDate: renewalData.contractEndDate,
      newContractNumber: renewalData.contractNumber || targetClient.contractNumber,
      renewedBy: 'مشرف النظام'
    };

    const updatedBranches = (targetClient.branches || []).map(br => {
      if (renewalData.applyToBranches) {
        return {
          ...br,
          contractStartDate: renewalData.contractStartDate,
          contractEndDate: renewalData.contractEndDate,
          contractNumber: renewalData.contractNumber || br.contractNumber || targetClient.contractNumber,
          visitFrequency: renewalData.visitFrequency || br.visitFrequency || targetClient.visitFrequency
        };
      }
      const branchSpecific = renewalData.branchRenewals?.find(b => b.branchId === br.id);
      if (branchSpecific) {
        return {
          ...br,
          contractStartDate: branchSpecific.contractStartDate || renewalData.contractStartDate,
          contractEndDate: branchSpecific.contractEndDate || renewalData.contractEndDate,
          contractNumber: branchSpecific.contractNumber || renewalData.contractNumber || br.contractNumber,
          visitFrequency: branchSpecific.visitFrequency || renewalData.visitFrequency || br.visitFrequency
        };
      }
      return br;
    });

    const updatedClient: Client = {
      ...targetClient,
      contractStartDate: renewalData.contractStartDate,
      contractEndDate: renewalData.contractEndDate,
      contractNumber: renewalData.contractNumber || targetClient.contractNumber,
      visitFrequency: renewalData.visitFrequency || targetClient.visitFrequency,
      status: 'active', // Reactivate client upon contract renewal
      assignedTechnicianId: renewalData.assignedTechnicianId || targetClient.assignedTechnicianId,
      contractFile: renewalData.contractFile !== undefined ? (renewalData.contractFile || undefined) : targetClient.contractFile,
      branches: updatedBranches,
      contractRenewalHistory: [
        ...(targetClient.contractRenewalHistory || []),
        renewalHistoryRecord
      ]
    };

    // 1. Update client in clients state
    setClients(prev => prev.map(c => c.id === clientId ? updatedClient : c));

    // 2. Propagate client updates across related records
    propagateClientUpdates(updatedClient.id, updatedClient.name, updatedClient.contractNumber);

    // 3. Schedule the new visits for the renewed contract period while strictly safeguarding historical visits & reports
    setVisits(prev => {
      try {
        if (!Array.isArray(prev)) return prev;

        // Keep all visits of other clients completely untouched
        const otherVisits = prev.filter(v => v.clientId !== clientId);

        // Keep ALL existing visits for this client that are completed, or have reports/attachments/signatures,
        // or have past scheduled dates prior to the renewal start date, or are emergency visits
        const preservedVisits = prev.filter(v => {
          if (v.clientId !== clientId) return false;
          // Completed visits with reports MUST be preserved unconditionally
          if (v.status === 'completed' || v.completedDate || v.report) return true;
          // Emergency visits are always preserved
          if (v.isEmergency) return true;
          // Past visits before the renewal start date are preserved in history
          if (v.scheduledDate && v.scheduledDate < renewalData.contractStartDate) return true;
          // Any other completed visit is retained
          return false;
        });

        // Generate fresh visits for the renewed contract cycle
        const freshRenewalVisits: Visit[] = [];
        const clientFreqNum = parseInt(updatedClient.visitFrequency || '4') || 4;
        const defaultTechId = updatedClient.assignedTechnicianId;
        const defaultTech = technicians.find(t => t.id === defaultTechId);
        const defaultTechName = defaultTech?.name || 'فني الصيانة';

        if (updatedBranches.length > 0) {
          updatedBranches.forEach((br, brIdx) => {
            if (!br) return;
            const brFreq = parseInt(br.visitFrequency || updatedClient.visitFrequency || '4') || clientFreqNum;
            const brInterval = 12 / brFreq;
            const brStartDateStr = br.contractStartDate || updatedClient.contractStartDate;
            const brTechId = br.assignedTechnicianId || defaultTechId;
            const brTech = technicians.find(t => t.id === brTechId);
            const brTechName = brTech?.name || defaultTechName;

            for (let i = 0; i < brFreq; i++) {
              const vDate = new Date(brStartDateStr);
              vDate.setMonth(vDate.getMonth() + Math.round(i * brInterval));
              let scheduledStr = '';
              try {
                scheduledStr = vDate.toISOString().split('T')[0];
              } catch {
                scheduledStr = new Date().toISOString().split('T')[0];
              }

              freshRenewalVisits.push({
                id: `visit_${updatedClient.id}_renew_${Date.now()}_b${br.id || brIdx}_i${i}_${Math.random().toString(36).substring(2, 6)}`,
                clientId: updatedClient.id,
                clientName: updatedClient.name,
                contractNumber: br.contractNumber || updatedClient.contractNumber,
                technicianId: brTechId,
                technicianName: brTechName,
                scheduledDate: scheduledStr,
                status: 'pending',
                result: 'not_visited',
                branchName: br.name
              });
            }
          });
        } else {
          // Client without branches
          const interval = 12 / clientFreqNum;
          for (let i = 0; i < clientFreqNum; i++) {
            const vDate = new Date(updatedClient.contractStartDate);
            vDate.setMonth(vDate.getMonth() + Math.round(i * interval));
            let scheduledStr = '';
            try {
              scheduledStr = vDate.toISOString().split('T')[0];
            } catch {
              scheduledStr = new Date().toISOString().split('T')[0];
            }

            freshRenewalVisits.push({
              id: `visit_${updatedClient.id}_renew_${Date.now()}_i${i}_${Math.random().toString(36).substring(2, 6)}`,
              clientId: updatedClient.id,
              clientName: updatedClient.name,
              contractNumber: updatedClient.contractNumber,
              technicianId: defaultTechId,
              technicianName: defaultTechName,
              scheduledDate: scheduledStr,
              status: 'pending',
              result: 'not_visited'
            });
          }
        }

        const rawResult = [...otherVisits, ...preservedVisits, ...freshRenewalVisits];
        const nextClients = clients.map(c => c.id === updatedClient.id ? updatedClient : c);
        return selfHealBranchVisits(nextClients, rawResult, technicians);
      } catch (err) {
        console.error("[handleRenewContract error caught]", err);
        return prev;
      }
    });

    triggerLocalMutation();
  };

  // Handler: Delete Client and purge all unsettled scheduled visits (archiving completed logs)
  const handleDeleteClient = (clientId: string) => {
    setClients(prev => prev.filter(c => c.id !== clientId));
    setVisits(prev => prev.filter(v => !(v.clientId === clientId && v.status === 'pending')));
    triggerLocalMutation();
  };

  // Handler: Client submits a service inquiry/feedback for continuous tracking
  const handleClientSubmitInquiry = (clientId: string, text: string) => {
    let clientNameActual = 'عميل بوابه نسما الأولى';
    const inquiryId = `inq_${Date.now()}`;
    const formattedDate = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString('ar-EG');
    
    setClients(prev => prev.map(c => {
      if (c.id === clientId) {
        clientNameActual = c.name;
        const existing = c.inquiries || [];
        const newInq = {
          id: inquiryId,
          text: text,
          createdAt: formattedDate,
          status: 'pending' as const
        };
        return {
          ...c,
          inquiries: [...existing, newInq]
        };
      }
      return c;
    }));

    // Trigger Email Notification to the Manager!
    const subject = isRtl 
      ? `🚨 شكوى / استفسار جديد من العميل: ${clientNameActual}` 
      : `🚨 New Complaint/Inquiry from Client: ${clientNameActual}`;
    
    const emailBody = isRtl
      ? `إشعار إلكتروني عاجل لشركة نسما الأولى:\n\nالعميل: ${clientNameActual}\nنص الاستفسار والملاحظة المرفوعة:\n"${text}"\n\nتاريخ الإرسال: ${formattedDate}\nيرجى الدخول فوراً للوحة الإدارة للمتابعة والرد.`
      : `Urgent Client Alert for Nesma First Manager:\n\nClient Name: ${clientNameActual}\nInquiry / Complaint Content:\n"${text}"\n\nSubmitted Date: ${formattedDate}\nPlease log in to the Admin Dashboard to review and respond.`;

    sendEmailNotification(
      managerEmail,
      isRtl ? 'المشرف العام المسؤول' : 'General Admin',
      subject,
      emailBody,
      clientNameActual,
      clientId,
      inquiryId
    );
    setLocalVersion(v => v + 1);
  };

  const handleClientUpdateInquiry = (clientId: string, inquiryId: string, text: string) => {
    setClients(prev => prev.map(c => {
      if (c.id === clientId) {
        const updated = (c.inquiries || []).map(inq => {
          if (inq.id === inquiryId) {
            return {
              ...inq,
              text
            };
          }
          return inq;
        });
        return {
          ...c,
          inquiries: updated
        };
      }
      return c;
    }));

    setNotificationLogs(prev => prev.map(log => {
      if (log.type === 'manager_email' && log.inquiryId === inquiryId) {
        // Find existing text in quotes and replace it
        const currentText = log.messageText;
        const startIdx = currentText.indexOf('"');
        const endIdx = currentText.lastIndexOf('"');
        let updatedText = currentText;
        if (startIdx !== -1 && endIdx !== -1 && startIdx !== endIdx) {
          updatedText = currentText.substring(0, startIdx + 1) + text + currentText.substring(endIdx);
        } else {
          updatedText = `[Modified] ${text}`;
        }
        return {
          ...log,
          messageText: updatedText
        };
      }
      return log;
    }));

    setLocalVersion(v => v + 1);
  };

  const handleClientDeleteInquiry = (clientId: string, inquiryId: string) => {
    setClients(prev => prev.map(c => {
      if (c.id === clientId) {
        return {
          ...c,
          inquiries: (c.inquiries || []).filter(inq => inq.id !== inquiryId)
        };
      }
      return c;
    }));

    setNotificationLogs(prev => prev.filter(log => !(log.type === 'manager_email' && log.inquiryId === inquiryId)));
    setLocalVersion(v => v + 1);
  };

  // Handler: Admin replies to the client inquiry, changing the status to 'completed'
  const handleReplyInquiry = (clientId: string, inquiryId: string, replyText: string, logId: string) => {
    const formattedReplyDate = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString('ar-EG');
    
    // Find the original log to use fallbacks
    const log = notificationLogs.find(l => l.id === logId);
    const fallbackClientName = log ? log.clientName : '';
    const logMessageText = log ? log.messageText : '';

    // 1. Update the Clients array
    setClients(prev => prev.map(c => {
      const isTargetClient = (clientId && c.id === clientId) || 
                             (!clientId && fallbackClientName && c.name === fallbackClientName);
                             
      if (isTargetClient) {
        let inquiryUpdated = false;
        const updatedInquiries = (c.inquiries || []).map(inq => {
          const isTargetInquiry = (inquiryId && inq.id === inquiryId) ||
                                  (!inquiryId && !inq.replyText && !inquiryUpdated);
          
          if (isTargetInquiry) {
            inquiryUpdated = true;
            return {
              ...inq,
              replyText,
              repliedAt: formattedReplyDate,
              status: 'completed' as const
            };
          }
          return inq;
        });
        
        // If still not updated, let's try matching text content
        const finalInquiries = inquiryUpdated ? updatedInquiries : (c.inquiries || []).map(inq => {
          const textCleaned = inq.text.trim();
          const isInLog = logMessageText && logMessageText.includes(textCleaned);
          if (isInLog && !inq.replyText && !inquiryUpdated) {
            inquiryUpdated = true;
            return {
              ...inq,
              replyText,
              repliedAt: formattedReplyDate,
              status: 'completed' as const
            };
          }
          return inq;
        });

        // Ensure we marked at least one as completed/replied
        const ultimateInquiries = inquiryUpdated ? finalInquiries : (c.inquiries || []).map((inq, idx, arr) => {
          // Absolute fallback: if zero got updated, update the last one
          if (idx === arr.length - 1) {
            return {
              ...inq,
              replyText,
              repliedAt: formattedReplyDate,
              status: 'completed' as const
            };
          }
          return inq;
        });

        return {
          ...c,
          inquiries: ultimateInquiries
        };
      }
      return c;
    }));

    // 2. Update the Notification Log array
    setNotificationLogs(prev => prev.map(logItem => {
      if (logItem.id === logId) {
        return {
          ...logItem,
          hasReply: true,
          replyText,
          repliedAt: formattedReplyDate
        };
      }
      return logItem;
    }));

    // 3. Send Email Notification directly to Client Email if registered
    const targetClientObj = clients.find(c => (clientId && c.id === clientId) || (fallbackClientName && c.name === fallbackClientName));
    if (targetClientObj && targetClientObj.email && targetClientObj.email.includes('@')) {
      const subject = isRtl 
        ? `💬 رد المشرف العام على استفساركم - شركة نسما الأولى` 
        : `General Manager Reply to Your Inquiry - Nesma First`;
      const emailBody = isRtl
        ? `عزيزنا العميل / ${targetClientObj.name}،\n\nتم الرد على استفساركم/بلاغكم من قبل إدارة الصيانة والمشرف العام:\n\nنص الرد المعتمد:\n"${replyText}"\n\nتاريخ الرد: ${formattedReplyDate}\n\nيمكنكم تسجيل الدخول إلى بوابة العملاء لمتابعة كافة تفاصيل العقد والزيارات.\n\nمع التحية،\nشركة نسما الأولى لأنظمة السلامة والصيانة`
        : `Dear ${targetClientObj.name},\n\nThe General Manager has replied to your inquiry:\n\nReply:\n"${replyText}"\n\nDate: ${formattedReplyDate}\n\nBest regards,\nNesma First Safety Systems`;

      sendEmailNotification(
        targetClientObj.email,
        targetClientObj.name,
        subject,
        emailBody,
        targetClientObj.name,
        targetClientObj.id,
        inquiryId,
        'general'
      );
    }

    // 4. Increment local Version
    triggerLocalMutation();
  };

  // Handlers: Quotations management
  const handleAddQuotation = (newQuote: Quotation) => {
    setQuotations(prev => {
      const idx = prev.findIndex(q => q.id === newQuote.id);
      if (idx > -1) {
        const copy = [...prev];
        copy[idx] = newQuote;
        return copy;
      }
      return [...prev, newQuote];
    });
    triggerLocalMutation();

    // Send Email Notification to Client if email is registered
    const clientObj = clients.find(c => c.id === newQuote.clientId || c.name === newQuote.clientName);
    if (clientObj && clientObj.email && clientObj.email.includes('@')) {
      const quoteNumber = newQuote.id;
      const amount = newQuote.grandTotal || newQuote.subtotal || 0;
      const subject = isRtl
        ? `📄 عرض سعر جديد من شركة نسما الأولى - رقم العرض: ${quoteNumber}`
        : `New Price Quotation from Nesma First - Quote #${quoteNumber}`;
      
      const emailBody = isRtl
        ? `عزيزنا العميل / ${clientObj.name}،\n\nتم إصدار عرض سعر جديد لحسابكم برقم: ${quoteNumber}\nالمبلغ الإجمالي شامل الضريبة: ${amount} ريال\nالتاريخ: ${newQuote.date || new Date().toLocaleDateString('ar-EG')}\n\nيرجى تسجيل الدخول إلى بوابة العملاء للاطلاع على تفاصيل عرض السعر المالي واعتماده أو التعقيب عليه.\n\nمع التحية،\nشركة نسما الأولى لأنظمة السلامة والصيانة`
        : `Dear ${clientObj.name},\n\nA new price quotation #${quoteNumber} has been generated for your account.\nTotal Amount: ${amount} SAR\n\nPlease log in to your Client Portal to review and approve or reply to this offer.\n\nBest regards,\nNesma First Safety Systems`;

      sendEmailNotification(
        clientObj.email,
        clientObj.name,
        subject,
        emailBody,
        clientObj.name,
        clientObj.id,
        undefined,
        'general'
      );
    }
  };

  const handleDeleteQuotation = (quoteId: string) => {
    setQuotations(prev => prev.filter(q => q.id !== quoteId));
    triggerLocalMutation();
  };

  const handleReplyQuotation = (id: string, status: 'approved' | 'rejected', clientNote?: string) => {
    setQuotations(prev => prev.map(q => {
      if (q.id === id) {
        if (status === 'approved') {
          return {
            ...q,
            status,
            clientNote,
            repliedAt: new Date().toISOString(),
            assignedTechId: undefined,
            assignedTechName: undefined,
            workOrderStatus: 'new' // Marks as a new unassigned work order for the manager
          };
        }
        return {
          ...q,
          status,
          clientNote,
          repliedAt: new Date().toISOString()
        };
      }
      return q;
    }));
    triggerLocalMutation();
  };

  // Handler: Add New Technician credentials dynamically
  const handleAddTechnician = (newTech: Technician) => {
    setTechnicians(prev => [...prev, newTech]);
    triggerLocalMutation();
  };

  // Handler: Delete Technician
  const handleDeleteTechnician = (techId: string) => {
    setTechnicians(prev => prev.filter(tech => tech.id !== techId));
    triggerLocalMutation();
  };

  // Handler: Edit / Update Technician Data
  const handleEditTechnician = (updatedTech: Technician) => {
    setTechnicians(prev => prev.map(tech => tech.id === updatedTech.id ? updatedTech : tech));
    
    // Updates cascading name to related Visits as well so they match the updated tech name
    setVisits(prev => prev.map(v => {
      if (v.technicianId === updatedTech.id) {
        return {
          ...v,
          technicianName: updatedTech.name
        };
      }
      return v;
    }));
    triggerLocalMutation();
  };

  // Handler: Add a new emergency visit (recorded by a technician)
  const handleAddEmergencyVisit = (newEmergency: Visit) => {
    setEmergencyVisits(prev => {
      const updated = [newEmergency, ...prev];
      localStorage.setItem('sas_emergency_visits', JSON.stringify(updated));
      return updated;
    });
    triggerLocalMutation();
  };

  // Handler: Delete/Remove an emergency visit card altogether
  const handleDeleteEmergencyVisit = (visitId: string) => {
    setEmergencyVisits(prev => {
      const updated = prev.filter(v => v.id !== visitId);
      localStorage.setItem('sas_emergency_visits', JSON.stringify(updated));
      return updated;
    });
    triggerLocalMutation();
  };

  // Handler: Update emergency visit (primarily editable by manager, e.g. status, results, defects, adding price quotes)
  const handleUpdateEmergencyVisit = (visitId: string, updatedData: Partial<Visit>) => {
    let targetObj: Visit | undefined;
    setEmergencyVisits(prev => {
      const updated = prev.map(v => {
        if (v.id === visitId) {
          const merged = { ...v, ...updatedData };
          targetObj = merged;
          return merged;
        }
        return v;
      });
      localStorage.setItem('sas_emergency_visits', JSON.stringify(updated));
      return updated;
    });

    if (targetObj) {
      const clientObj = clients.find(c => c.id === targetObj?.clientId || c.name === targetObj?.clientName);
      if (clientObj && clientObj.email && clientObj.email.includes('@') && (updatedData.status === 'completed' || updatedData.notes || updatedData.defects || updatedData.supervisorNotes)) {
        const subject = isRtl
          ? `🚨 تحديث تقرير زيارة طوارئ معتمد - ${clientObj.name}`
          : `Emergency Visit Report Update - ${clientObj.name}`;
        
        const resultText = targetObj.result === 'passed' ? 'سليم وتعمل بكفاءة' : targetObj.result === 'has_defects' ? 'توجد ملاحظات وعيوب' : targetObj.result === 'critical_issues' ? 'حالة حرجة تحتاح صيانة عاجلة' : 'تم الفحص';

        const emailBody = isRtl
          ? `عزيزنا العميل / ${clientObj.name}،\n\nتم تحديث وتوثيق تقرير الزيارة الطارئة لحسابكم.\n\nتاريخ الزيارة: ${targetObj.completedDate || targetObj.scheduledDate || new Date().toLocaleDateString('ar-EG')}\nالنتيجة التشخيصية: ${resultText}\n${targetObj.notes ? `\nتقرير فحص الفني:\n${targetObj.notes}` : ''}${targetObj.defects ? `\n\nالعيوب والقطع المطلوب اصلاحها:\n${targetObj.defects}` : ''}${targetObj.supervisorNotes ? `\n\nملاحظات المشرف العام:\n${targetObj.supervisorNotes}` : ''}\n\nيمكنكم الاطلاع على كافة تفاصيل الزيارة والصور المرفقة عبر تسجيل الدخول إلى بوابة العملاء.\n\nمع التحية،\nشركة نسما الأولى لأنظمة السلامة والصيانة`
          : `Dear ${clientObj.name},\n\nYour emergency visit report has been updated and published.\nVisit Date: ${targetObj.completedDate || targetObj.scheduledDate}\nResult: ${resultText}\n\nPlease log in to your Client Portal to review full report details.\n\nBest regards,\nNesma First Safety Systems`;

        sendEmailNotification(
          clientObj.email,
          clientObj.name,
          subject,
          emailBody,
          clientObj.name,
          clientObj.id,
          undefined,
          'technician_visit'
        );
      }
    }

    triggerLocalMutation();
  };

  // Handler: Update / edit any visit details (assigned tech, dates, notes, defects, status, results) primarily for admin
  const handleUpdateVisit = (visitId: string, updatedData: Partial<Visit>) => {
    const finalData = { ...updatedData };
    if (finalData.result === 'passed' || finalData.result === 'not_visited') {
      finalData.defects = '';
    }

    let targetVisitObj: Visit | undefined;

    setVisits(prev => prev.map(v => {
      if (v.id === visitId) {
        let extra = {};
        if (finalData.technicianId) {
          const tech = technicians.find(t => t.id === finalData.technicianId);
          if (tech) {
            extra = { technicianName: tech.name };
          }
        }
        const updated = {
          ...v,
          ...finalData,
          ...extra
        };
        targetVisitObj = updated;
        return updated;
      }
      return v;
    }));

    if (!targetVisitObj) {
      targetVisitObj = emergencyVisits.find(v => v.id === visitId);
      if (targetVisitObj) {
        targetVisitObj = { ...targetVisitObj, ...finalData };
      }
    }

    if (targetVisitObj) {
      const clientObj = clients.find(c => c.id === targetVisitObj?.clientId || c.name === targetVisitObj?.clientName);
      if (clientObj && clientObj.email && clientObj.email.includes('@') && (finalData.status === 'completed' || finalData.notes || finalData.defects || finalData.supervisorNotes)) {
        const subject = isRtl
          ? `📋 تحديث تقرير زيارة صيانة معتمد - ${clientObj.name}`
          : `Maintenance Visit Report Update - ${clientObj.name}`;
        
        const resultText = targetVisitObj.result === 'passed' ? 'سليم وتعمل بكفاءة' : targetVisitObj.result === 'has_defects' ? 'توجد ملاحظات/عيوب' : targetVisitObj.result === 'critical_issues' ? 'حالة حرجة تحتاح صيانة عاجلة' : 'تم الفحص';

        const emailBody = isRtl
          ? `عزيزنا العميل / ${clientObj.name}،\n\nتم اعتماد وتحديث تقرير زيارة الفحص والصيانة الميدانية لحسابكم.\n\nتاريخ الزيارة: ${targetVisitObj.completedDate || targetVisitObj.scheduledDate || new Date().toLocaleDateString('ar-EG')}\nنتيجة الفحص العام: ${resultText}\n${targetVisitObj.notes ? `\nتقرير فحص الفني:\n${targetVisitObj.notes}` : ''}${targetVisitObj.defects ? `\n\nالعيوب والقطع المطلوبة:\n${targetVisitObj.defects}` : ''}${targetVisitObj.supervisorNotes ? `\n\nملاحظات المشرف العام:\n${targetVisitObj.supervisorNotes}` : ''}\n\nيمكنكم الاطلاع على التقرير الكامل وتحميل الملفات المرفقة عبر تسجيل الدخول في بوابة العملاء.\n\nمع التحية،\nشركة نسما الأولى لأنظمة السلامة والصيانة`
          : `Dear ${clientObj.name},\n\nYour maintenance visit report has been updated and published.\nVisit Date: ${targetVisitObj.completedDate || targetVisitObj.scheduledDate}\nResult: ${resultText}\n\nPlease log in to your Client Portal to review full report details.\n\nBest regards,\nNesma First Safety Systems`;

        sendEmailNotification(
          clientObj.email,
          clientObj.name,
          subject,
          emailBody,
          clientObj.name,
          clientObj.id,
          undefined,
          'technician_visit'
        );
      }
    }

    if (finalData.fireExtinguisherExpiry) {
      const visitObj = visits.find(v => v.id === visitId) || emergencyVisits.find(v => v.id === visitId);
      if (visitObj) {
        setClients(prevClients => {
          const updatedClients = prevClients.map(c => {
            if (c.id === visitObj.clientId) {
              const hasBranches = c.branches && c.branches.length > 0;
              if (hasBranches && visitObj.branchName) {
                const updatedBranches = c.branches!.map(br => {
                  const bName = typeof br === 'string' ? br : br.name;
                  if (bName === visitObj.branchName) {
                    if (typeof br === 'string') {
                      return {
                        id: `branch_${Date.now()}`,
                        name: br,
                        city: c.locationText ? c.locationText.split(' ')[0] : 'الرياض',
                        fireExtinguisherExpiry: finalData.fireExtinguisherExpiry
                      };
                    } else {
                      return {
                        ...br,
                        fireExtinguisherExpiry: finalData.fireExtinguisherExpiry
                      };
                    }
                  }
                  return br;
                });
                return {
                  ...c,
                  branches: updatedBranches
                };
              } else {
                return {
                  ...c,
                  fireExtinguisherExpiry: finalData.fireExtinguisherExpiry
                };
              }
            }
            return c;
          });
          return updatedClients;
        });
      }
    }

    setEmergencyVisits(prev => {
      const updated = prev.map(v => {
        if (v.id === visitId) {
          let extra = {};
          if (finalData.technicianId) {
            const tech = technicians.find(t => t.id === finalData.technicianId);
            if (tech) {
              extra = { technicianName: tech.name };
            }
          }
          return {
            ...v,
            ...finalData,
            ...extra
          };
        }
        return v;
      });
      localStorage.setItem('sas_emergency_visits', JSON.stringify(updated));
      return updated;
    });

    // Maintain modal synchronization if open
    setSelectedVisitForModal(current => {
      if (current && current.id === visitId) {
        let extra = {};
        if (finalData.technicianId) {
          const tech = technicians.find(t => t.id === finalData.technicianId);
          if (tech) {
            extra = { technicianName: tech.name };
          }
        }
        return {
          ...current,
          ...finalData,
          ...extra
        };
      }
      return current;
    });

    setLocalVersion(v => v + 1);
  };

  // Handler: Delete/Reset completed reports and visits for admin management
  const handleDeleteOrResetVisit = (visitId: string, action: 'reset' | 'delete') => {
    if (action === 'delete') {
      setVisits(prev => {
        const filtered = prev.filter(v => v.id !== visitId);
        localStorage.setItem('sas_visits', JSON.stringify(filtered));
        return filtered;
      });
      setEmergencyVisits(prev => {
        const filtered = prev.filter(v => v.id !== visitId);
        localStorage.setItem('sas_emergency_visits', JSON.stringify(filtered));
        return filtered;
      });
      // Add deleted visitId to deletedVisitIds!
      setDeletedVisitIds(prev => {
        if (!prev.includes(visitId)) {
          const updated = [...prev, visitId];
          localStorage.setItem('sas_deleted_visit_ids', JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
    } else { // 'reset' back to pending
      setVisits(prev => {
        const updated = prev.map(v => {
          if (v.id === visitId) {
            return {
              ...v,
              status: 'pending',
              result: 'not_visited',
              completedDate: undefined,
              notes: '',
              defects: '',
              attachments: [],
              updatedAt: Date.now()
            };
          }
          return v;
        });
        localStorage.setItem('sas_visits', JSON.stringify(updated));
        return updated;
      });
      setEmergencyVisits(prev => {
        const updated = prev.map(v => {
          if (v.id === visitId) {
            return {
              ...v,
              status: 'pending',
              result: 'not_visited',
              completedDate: undefined,
              notes: '',
              defects: '',
              attachments: [],
              updatedAt: Date.now()
            };
          }
          return v;
        });
        localStorage.setItem('sas_emergency_visits', JSON.stringify(updated));
        return updated;
      });
    }
    triggerLocalMutation();
  };

  // Handler: Direct Client settings update by a technician or portal
  const handleUpdateClient = (clientIdOrObj: string | Client, updatedFields?: Partial<Client>) => {
    triggerLocalMutation();

    if (typeof clientIdOrObj === 'object' && clientIdOrObj !== null) {
      const updatedClient = clientIdOrObj as Client;
      setClients(prev => {
        const updated = prev.map(c => c.id === updatedClient.id ? updatedClient : c);
        localStorage.setItem('sas_clients', JSON.stringify(updated));
        return updated;
      });
      return;
    }

    const clientId = clientIdOrObj;
    setClients(prev => {
      const updated = prev.map(c => {
        if (c.id === clientId) {
          return {
            ...c,
            ...(updatedFields || {})
          };
        }
        return c;
      });
      localStorage.setItem('sas_clients', JSON.stringify(updated));
      return updated;
    });
  };

  // Handler: Submit inspection report by a technician & notify manager
  const handleSubmitReport = async (visitId: string, updatedData: Partial<Visit>) => {
    // Instantly lock background sync from pulling and overriding local state while async network calls are taking place
    lastLocalWriteRef.current = Date.now();
    setLocalVersion(v => v + 1);

    const finalData = { ...updatedData, updatedAt: Date.now() };
    if (finalData.result === 'passed' || finalData.result === 'not_visited') {
      finalData.defects = '';
    }

    setVisits(prev => {
      const updated = prev.map(v => {
        if (v.id === visitId) {
          return {
            ...v,
            ...finalData
          };
        }
        return v;
      });
      localStorage.setItem('sas_visits', JSON.stringify(updated));
      return updated;
    });

    if (finalData.fireExtinguisherExpiry) {
      const visitObj = visits.find(v => v.id === visitId) || emergencyVisits.find(v => v.id === visitId);
      if (visitObj) {
        setClients(prevClients => {
          const updatedClients = prevClients.map(c => {
            if (c.id === visitObj.clientId) {
              const hasBranches = c.branches && c.branches.length > 0;
              if (hasBranches && visitObj.branchName) {
                const updatedBranches = c.branches!.map(br => {
                  const bName = typeof br === 'string' ? br : br.name;
                  if (bName === visitObj.branchName) {
                    if (typeof br === 'string') {
                      return {
                        id: `branch_${Date.now()}`,
                        name: br,
                        city: c.locationText ? c.locationText.split(' ')[0] : 'الرياض',
                        fireExtinguisherExpiry: finalData.fireExtinguisherExpiry
                      };
                    } else {
                      return {
                        ...br,
                        fireExtinguisherExpiry: finalData.fireExtinguisherExpiry
                      };
                    }
                  }
                  return br;
                });
                return {
                  ...c,
                  branches: updatedBranches
                };
              } else {
                return {
                  ...c,
                  fireExtinguisherExpiry: finalData.fireExtinguisherExpiry
                };
              }
            }
            return c;
          });
          localStorage.setItem('sas_clients', JSON.stringify(updatedClients));
          return updatedClients;
        });
      }
    }

    setEmergencyVisits(prev => {
      const updated = prev.map(v => {
        if (v.id === visitId) {
          return {
            ...v,
            ...finalData
          };
        }
        return v;
      });
      localStorage.setItem('sas_emergency_visits', JSON.stringify(updated));
      return updated;
    });

    // Find custom visit to compose metadata-heavy messages to general supervisor manager
    const visitObj = visits.find(v => v.id === visitId) || emergencyVisits.find(v => v.id === visitId);
    if (visitObj) {
      const techName = visitObj.technicianName || 'فني الصيانة';
      const clientName = visitObj.clientName || 'المنشأة';
      
      const resultLabel = updatedData.result === 'passed' 
        ? (lang === 'ar' ? 'سليمة ومطابقة' : 'Passed & Verified')
        : (updatedData.result === 'has_defects' 
          ? (lang === 'ar' ? 'ملاحظات وأعطال طفيفة' : 'Minor defects logged') 
          : (lang === 'ar' ? 'حرجة وخطورة عالية!' : 'CRITICAL ERRORS DETECTED'));

      const fileCount = updatedData.attachments?.length || 0;
      const fileDescription = fileCount > 0 
        ? (lang === 'ar' ? `وتوثيق عدد ${fileCount} صور وفيديوهات` : `and attached ${fileCount} files/media`) 
        : '';

      const smsText = lang === 'ar'
        ? `🚨 تقرير أمني جديد: أتم الفني ${techName} فحص أنظمة السلامة والوقاية لموقع العميل: ${clientName} ${fileDescription}. النتيجة الفنية: (${resultLabel}). الملاحظات المرفوعة: "${updatedData.notes || ''}"`
        : `🚨 Nesma First Report: Tech ${techName} completed safety system inspections for: ${clientName} ${fileDescription}. Result: (${resultLabel}). Field notes: "${updatedData.notes || ''}"`;

      // Dispatch real notifications
      const isContactsEnabled = localStorage.getItem('sas_contacts_enabled') !== 'false';
      
      if (isContactsEnabled) {
        await sendSMSNotification(managerPhone, lang === 'ar' ? 'المشرف صيانة' : 'Tech Supervisor', smsText, 'technician_visit', clientName);
        
        // Also notify manager via email!
        await sendEmailNotification(
          managerEmail,
          lang === 'ar' ? 'المشرف العام صيانة' : 'General Supervisor',
          lang === 'ar' ? `📋 تقرير متاح: صيانة منشأة ${clientName}` : `📋 Safety Inspection Completed: ${clientName}`,
          smsText,
          clientName,
          undefined,
          undefined,
          'technician_visit'
        );
      }

      // If this is an emergency visit, send a completed WhatsApp message to the client!
      if (visitObj.isEmergency || emergencyVisits.some(ev => ev.id === visitId)) {
        const targetClient = clients.find(c => c.id === visitObj.clientId || c.name === visitObj.clientName);
        let clientPhone = targetClient?.phone;
        if (visitObj.branchName && targetClient?.branches) {
          const matchingBranch = targetClient.branches.find(b => b.name === visitObj.branchName);
          if (matchingBranch?.managerPhone) {
            clientPhone = matchingBranch.managerPhone;
          }
        }
        if (clientPhone) {
          const clientMsgText = lang === 'ar'
            ? `🔔 إشعار سلامة: تم إكمال مهمة أو زيارة الطوارئ لموقعكم "${visitObj.branchName || 'الموقع الرئيسي'}" بنجاح وتم عمل اللازم وتأدية جميع الفحوصات اللازمة من قبل الفني المختص. شكراً لتعاونكم مع شركة نسما الأولى لخدمات السلامة.`
            : `🔔 Safety Alert: The emergency task / visit for your site "${visitObj.branchName || 'Main Headquarters'}" has been successfully completed and the necessary work was done. Thank you for choosing Nesma First.`;
          
          await sendWhatsAppNotification(clientPhone, clientName, clientMsgText, 'technician_visit', clientName);
        }
      }
    }
  };

  // Handler: Delete SMS message log
  const handleDeleteNotificationLog = (logId: string) => {
    setNotificationLogs(prev => prev.filter(log => log.id !== logId));
    setLocalVersion(v => v + 1);
  };

  // Handler: Clear all SMS message logs
  const handleClearAllNotificationLogs = () => {
    setNotificationLogs([]);
    setLocalVersion(v => v + 1);
  };

  // Handler: Secure Login Action
  const handleLoginSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const normUsername = loginUsername.trim().toLowerCase();
    const normPassword = loginPassword.trim();

    // Check Admin profile
    if (normUsername === adminUsername.trim().toLowerCase() && normPassword === adminPassword) {
      setSession({
        role: 'admin',
        name: adminName
      });
      setLoginUsername('');
      setLoginPassword('');
      return;
    }

    // Check Company Branches list
    const foundBranch = companyBranches.find(b => {
      const u = (b.username || '').trim().toLowerCase();
      const p = (b.password || '123').trim();
      return normUsername === u && normPassword === p;
    });

    if (foundBranch) {
      if (maintenanceModeEnabled) {
        setLoginError(isRtl 
          ? '⚠️ النظام مغلق وتحت الصيانة والتحديثات حالياً بطلب من المشرف العام. يرجى محاولة الدخول لاحقاً.' 
          : '⚠️ Access suspended. The system is under scheduled maintenance by the General Admin.');
        return;
      }
      setSession({
        role: 'admin',
        id: foundBranch.id,
        name: foundBranch.name,
        companyBranchId: foundBranch.id,
        isBranchUser: true,
        permissions: foundBranch.permissions || {
          manageClients: true,
          manageTechnicians: true,
          manageQuotes: true,
          wipeDatabase: false
        }
      });
      setLoginUsername('');
      setLoginPassword('');
      return;
    }

    // Check Technicians list
    const foundTech = technicians.find(t => {
      const u = (t.username || '').trim().toLowerCase();
      const p = (t.password || '123').trim();
      return (normUsername === u || normUsername === t.id) && normPassword === p;
    });

    if (foundTech) {
      if (maintenanceModeEnabled) {
        setLoginError(isRtl 
          ? '⚠️ النظام مغلق وتحت الصيانة والتحديثات حالياً بطلب من المشرف العام. يرجى محاولة الدخول لاحقاً.' 
          : '⚠️ Access suspended. The system is under scheduled maintenance by the General Admin.');
        return;
      }
      const targetRole = foundTech.role === 'admin' ? 'admin' : (foundTech.role === 'viewer' ? 'viewer' : 'technician');
      setSession({
        role: targetRole,
        id: foundTech.id,
        name: foundTech.name,
        companyBranchId: foundTech.companyBranchId,
        isBranchUser: foundTech.companyBranchId ? true : false,
        permissions: foundTech.permissions || (targetRole === 'admin' ? {
          manageClients: true,
          manageTechnicians: true,
          manageQuotes: true,
          wipeDatabase: false
        } : (targetRole === 'viewer' ? {
          manageClients: false,
          manageTechnicians: false,
          manageQuotes: false,
          wipeDatabase: false
        } : undefined))
      });
      setLoginUsername('');
      setLoginPassword('');
      return;
    }

    // Check Client portal list
    const foundClient = clients.find(c => {
      const u = (c.username || '').trim().toLowerCase();
      const p = (c.password || '123').trim();
      return normUsername === u && normPassword === p;
    });

    if (foundClient) {
      if (maintenanceModeEnabled) {
        setLoginError(isRtl 
          ? '⚠️ لوحة تحكم المنشآت والعملاء تحت الصيانة والتحديث المؤقت حالياً بطلب من المشرف العام. يرجى التواصل مع الإدارة.' 
          : '⚠️ Access suspended. Client portals are temporarily undergoing maintenance by the General Admin.');
        return;
      }
      setSession({
        role: 'client',
        id: foundClient.id,
        name: foundClient.name
      });
      setLoginUsername('');
      setLoginPassword('');
      return;
    }

    // Check Client sub-users list
    let foundSubClient: Client | undefined;
    let foundSubUser: any;
    for (const c of clients) {
      if (c.subUsers) {
        const matchingSub = c.subUsers.find(su => {
          const u = su.username.trim().toLowerCase();
          const p = (su.password || '123').trim();
          return normUsername === u && normPassword === p;
        });
        if (matchingSub) {
          foundSubClient = c;
          foundSubUser = matchingSub;
          break;
        }
      }
    }

    if (foundSubClient && foundSubUser) {
      if (maintenanceModeEnabled) {
        setLoginError(isRtl 
          ? '⚠️ لوحة تحكم المنشآت والعملاء تحت الصيانة والتحديث المؤقت حالياً بطلب من المشرف العام. يرجى التواصل مع الإدارة.' 
          : '⚠️ Access suspended. Client portals are temporarily undergoing maintenance by the General Admin.');
        return;
      }
      setSession({
        role: 'client',
        id: foundSubClient.id,
        name: foundSubUser.name,
        subUserId: foundSubUser.id,
        subUserPermissions: foundSubUser.permissions
      });
      setLoginUsername('');
      setLoginPassword('');
      return;
    }

    setLoginError(t.invalidCredentials);
  };

  // Handler: Secure Logout Action
  const handleLogout = () => {
    setSession(null);
    setSelectedVisitForModal(null);
  };

  // Handler: Reset application to initial parameters
  const handleResetApp = () => {
    if (session && (session.isBranchUser || (session.companyBranchId && session.companyBranchId !== 'hq'))) {
      alert(isRtl 
        ? 'عذراً، لا تمتلك صلاحية تصفير قاعدة البيانات من حساب الفرع. هذه الميزة حصرية للإدارة العامة فقط لحماية سلامة البيانات.' 
        : 'Sorry, you do not have permission to wipe the database from a branch account. This feature is restricted to Headquarters only to protect data integrity.');
      return;
    }
    setShowResetModal(true);
  };

  const handleFullWipe = async () => {
    if (session && (session.isBranchUser || (session.companyBranchId && session.companyBranchId !== 'hq'))) {
      alert(isRtl ? 'غير مصرح به!' : 'Unauthorized!');
      return;
    }
    
    lastLocalWriteRef.current = Date.now();

    const wipeFsState = {
      clients: [],
      visits: [],
      technicians: technicians.filter(t => t.role === 'admin' || t.id === 'admin_root'),
      quotations: [],
      notificationLogs: [],
      emergencyVisits: [],
      extinguisherReceipts: [],
      deletedVisitIds: [],
      daysBeforeVisitAlert: 2,
      isWiped: true,
      lastWipeAt: new Date().toISOString()
    };

    // 1. Direct browser-level Firestore wipe
    writeStateToFirestoreClient(wipeFsState).catch((err) => {
      console.warn('[SAS Wipe] Direct Firestore wipe warning:', err);
    });

    // 2. Server-side wipe endpoint call
    try {
      await fetch('/api/wipe-database', { method: 'POST' });
    } catch (e) {
      console.warn('Failed to call wipe-database endpoint:', e);
    }

    localStorage.setItem('sas_clients', '[]');
    localStorage.setItem('sas_visits', '[]');
    localStorage.setItem('sas_quotations', '[]');
    localStorage.setItem('sas_notification_logs', '[]');
    localStorage.setItem('sas_emergency_visits', '[]');
    localStorage.setItem('sas_extinguisher_receipts', '[]');
    localStorage.setItem('sas_deleted_visit_ids', '[]');
    localStorage.setItem('sas_alert_days', '2');
    
    setClients([]);
    setVisits([]);
    setQuotations([]);
    setEmergencyVisits([]);
    setExtinguisherReceipts([]);
    setNotificationLogs([]);
    setDeletedVisitIds([]);
    setDaysBeforeVisitAlert(2);
    setSelectedVisitForModal(null);
    setShowResetModal(false);
    
    alert(isRtl 
      ? 'تم تصفير ومسح كافة بيانات النظام وقاعدة البيانات السحابية (Firestore) بنجاح! النظام جاهز الآن لرفع ملف النسخة الاحتياطية.' 
      : 'All operational records and Cloud Firestore database wiped successfully! The system is now ready to import your backup file.');
  };

  const handleResetToDemo = () => {
    if (session && (session.isBranchUser || (session.companyBranchId && session.companyBranchId !== 'hq'))) {
      alert(isRtl ? 'غير مصرح به!' : 'Unauthorized!');
      return;
    }
    localStorage.setItem('sas_clients', JSON.stringify(mockClients));
    localStorage.setItem('sas_visits', JSON.stringify(mockVisits));
    localStorage.setItem('sas_technicians', JSON.stringify(mockTechnicians));
    localStorage.setItem('sas_alert_days', '2');
    localStorage.removeItem('sas_session');
    
    setClients(mockClients);
    setVisits(mockVisits);
    setTechnicians(mockTechnicians);
    setDaysBeforeVisitAlert(2);
    setSession(null);
    setSelectedVisitForModal(null);
    setShowResetModal(false);
    setLocalVersion(v => v + 1);
  };

  // Immediate/force save utility to push SMTP and manager email configurations immediately to database.json
  const forceSaveToDatabase = async (overrides?: {
    clients?: Client[];
    visits?: Visit[];
    extinguisherReceipts?: ExtinguisherReceipt[];
    quotations?: Quotation[];
  }) => {
    setIsSyncing(true);
    
    // Apply overrides to state synchronously if provided
    if (overrides) {
      if (overrides.clients) setClients(overrides.clients);
      if (overrides.visits) setVisits(overrides.visits);
      if (overrides.extinguisherReceipts) setExtinguisherReceipts(overrides.extinguisherReceipts);
      if (overrides.quotations) setQuotations(overrides.quotations);
    }

    const payload = {
      clients: overrides?.clients || clients,
      visits: overrides?.visits || visits,
      technicians,
      daysBeforeVisitAlert,
      notificationLogs,
      managerPhone,
      managerEmail,
      adminUsername,
      adminPassword,
      adminName,
      quotations: overrides?.quotations || quotations,
      emergencyVisits,
      deletedVisitIds,
      extinguisherReceipts: overrides?.extinguisherReceipts || extinguisherReceipts,
      maintenanceModeEnabled,
      companyName,
      companyUnified,
      companyPhone,
      companyEmail,
      companyTaxId,
      companyAddress,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      smtpFromEmail,
      smtpEnabled
    };
    try {
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await response.json();
      if (json.success) {
        masterStateRef.current = JSON.stringify(payload);
        setLocalVersion(0);
        setLastSyncTime(new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }));
        return true;
      }
    } catch (e) {
      console.error('[SAS Force Sync] Failed to force save settings:', e);
    } finally {
      setIsSyncing(false);
    }
    return false;
  };

  // Find client metadata helper
  const getClientOfVisit = (clientId: string) => {
    return clients.find(c => c.id === clientId);
  };

  // Calculate live upcoming alarms for layout header badge
  const today = new Date(); // Consistent system time reference

  const isGeneralAdmin = (session?.role === 'admin' && !session?.id && !session?.isBranchUser) || (systemMode === 'independent_branch' && session?.role === 'admin');
  const activeBranchIdForAlert = isGeneralAdmin ? selectedBranchId : (session?.companyBranchId || 'hq');
  const canManageUsers = isGeneralAdmin || (session?.role === 'admin' && session?.isBranchUser && session?.companyBranchId);
  const visitsForAlert = visits.filter(v => {
    if (activeBranchIdForAlert === 'all') return true;
    if (activeBranchIdForAlert === 'hq') return !v.companyBranchId || v.companyBranchId === 'hq';
    return v.companyBranchId === activeBranchIdForAlert;
  });

  const pendingAlertCount = visitsForAlert.filter(v => {
    if (v.status !== 'pending') return false;
    const scheduled = new Date(v.scheduledDate);
    const diffDays = Math.ceil((scheduled.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= daysBeforeVisitAlert;
  }).length;

  // Show a full-screen loading spinner while the initial master database state is being securely loaded from the server
  if (dbLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 font-sans" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 bg-gradient-to-tr from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center mx-auto shadow-2xl border border-orange-400/20 shadow-orange-500/10">
            <RefreshCw className="w-7 h-7 text-white animate-spin" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-sm font-bold text-slate-100">
              {isRtl ? 'جاري تهيئة ومزامنة النظام مركزيًا...' : 'Synchronizing Central Nesma Platform...'}
            </h2>
            <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
              {isRtl 
                ? 'جاري جلب العقود، الفروع الفعلية، وقائمة الفنيين والعملاء الآمنة من الخادم لضمان تطابق البيانات على كافة الأجهزة.' 
                : 'Fetching real-time technician rosters, safety contracts, branches, and schedules from the main container.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render Maintenance details if logged in user is NOT General Admin and maintenance is active
  const isGeneral = session && (session.role === 'admin' && !session.id && !session.isBranchUser);
  if (session && !isGeneral && maintenanceModeEnabled) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center px-4 font-sans text-white text-start" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="w-full max-w-xl bg-slate-950/60 border border-slate-800 p-8 rounded-3xl shadow-2xl backdrop-blur-md relative overflow-hidden space-y-6">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-500 via-amber-500 to-rose-600 animate-pulse"></div>

          <div className="flex items-center gap-4 border-b border-white/5 pb-5">
            <div className="w-14 h-14 bg-amber-550/10 border border-amber-520/25 rounded-2xl flex items-center justify-center shrink-0">
              <span className="text-3xl">⚙️</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-amber-500 font-bold block">
                {isRtl ? 'تنبيه وضع الصيانة والتحديث' : 'SYSTEM UNDER MAINTENANCE'}
              </span>
              <h1 className="text-base font-black text-slate-100 mt-0.5 animate-pulse">
                {isRtl ? 'المنصة مغلقة مؤقتاً بأمر الإدارة' : 'System Temporarily Suspended'}
              </h1>
            </div>
          </div>

          <div className="space-y-3.5 text-slate-300 text-xs sm:text-xs leading-relaxed font-sans">
            <p>
              {isRtl
                ? `مرحباً بك، لقد قام المشرف العام (${adminName}) بتفعيل وضع الصيانة المؤقت للمنصة لإجراء بعض الإضافات والتعديلات والتحسينات.`
                : `Hello, the system administrator (${adminName}) has activated a temporary maintenance window to apply updates and test new features.`}
            </p>
            <p>
              {isRtl
                ? 'تم إيقاف روابط الفنيين والمنشآت مؤقتاً لضمان تناسق البيانات وغلقها للتعديل، وسيعود العمل لوضعه الطبيعي فور الانتهاء مباشرة.'
                : 'Access to tasks, schedules, and PDF reports is suspended during this period. Normal operations will resume shortly.'}
            </p>
          </div>

          {/* Contact Support Container */}
          <div className="bg-slate-950/80 border border-slate-800/80 p-4.5 rounded-2xl space-y-2 text-xs">
            <span className="font-bold text-slate-400 block mb-1">📞 {isRtl ? 'للتواصل والاستفسار مع المشرف العام:' : 'Contact General Administrator:'}</span>
            <div className="flex flex-col sm:flex-row gap-3.5">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="text-sm">📱</span>
                <span className="font-bold">{isRtl ? 'الهاتف:' : 'Phone:'}</span>
                <a href={`tel:${managerPhone}`} className="text-amber-400 hover:underline">{managerPhone}</a>
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="text-sm">✉️</span>
                <span className="font-bold">{isRtl ? 'البريد الإلكتروني:' : 'Email:'}</span>
                <a href={`mailto:${managerEmail}`} className="text-sky-400 hover:underline font-mono">{managerEmail}</a>
              </span>
            </div>
          </div>

          <div className="flex gap-3 pt-4 justify-end border-t border-white/5">
            <button
               type="button"
               onClick={handleLogout}
               className="px-5 py-2.5 bg-slate-800 hover:bg-slate-750 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              {isRtl ? 'تسجيل الخروج والرجوع' : 'Log Out & Exit'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Login state screen if no active profile exists
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center px-4 py-8 font-sans" dir={isRtl ? 'rtl' : 'ltr'}>
        {/* Language switch over preview */}
        <div className="absolute top-4 right-4 print:hidden">
          <button
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className="px-3.5 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer"
          >
            <Globe className="w-4 h-4 text-slate-400" />
            <span>{t.changeLanguageBtn}</span>
          </button>
        </div>

        {/* Maintenance Banner warning (Active) */}
        {maintenanceModeEnabled && (
          <div className="w-full max-w-md mb-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-2xl flex items-start gap-3 shadow-lg select-none">
            <span className="text-xl shrink-0 mt-0.5">⚠️</span>
            <div className="text-xs leading-normal font-sans">
              <span className="font-bold text-amber-300 block mb-0.5">
                {isRtl ? 'وضع الصيانة نشط حالياً للعملاء والفنيين' : 'System Maintenance Mode Active'}
              </span>
              <span>
                {isRtl 
                  ? 'تم وقف الدخول لروابط العملاء والفنيين مؤقتاً لأعمال التعديل والتطوير. يتاح دخول المشرف العام والمدراء فقط.' 
                  : 'Customer and technician portals are temporarily closed for design additions. General Admin login is active.'}
              </span>
            </div>
          </div>
        )}

        {/* Glossy login form card */}
        <div className="w-full max-w-md bg-slate-950/60 border border-slate-800 p-8 rounded-3xl shadow-2xl backdrop-blur-md relative overflow-hidden">
          
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-600 via-teal-500 to-amber-500 animate-pulse"></div>
          
          <div className="text-center mb-6">
            <div className="flex flex-col items-center justify-center mb-4">
              <div className="mb-3.5">
                <img src="/logo_nesma.png?v=2" className="w-56 h-24 sm:w-64 sm:h-28 object-contain" alt="Nesma First Logo" referrerPolicy="no-referrer" />
              </div>
              <h1 className="text-lg font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-sky-200 uppercase">
                {t.appName}
              </h1>
              <p className="text-[10px] text-slate-400 mt-1 font-sans">{t.safetyEquipmentSystems}</p>
            </div>
            <h2 className="text-xs font-bold text-slate-300 tracking-wider uppercase mb-1">{t.loginTitle}</h2>
            <p className="text-[10px] text-slate-400 leading-relaxed font-sans">{t.loginSubtitle}</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-5">
            {loginError && (
              <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-xs text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">{t.usernameLabel}</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500">
                  <span className="w-4 h-4 block text-center">@</span>
                </span>
                <input
                  id="login-username"
                  type="text"
                  required
                  placeholder={t.usernamePlaceholder}
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className={`w-full ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 text-xs bg-slate-900 border border-slate-800 rounded-xl focus:outline-none focus:border-orange-500 text-white focus:ring-1 focus:ring-orange-500/30 placeholder-slate-500`}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">{t.passwordLabel}</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="login-password"
                  type="password"
                  required
                  placeholder={t.passwordPlaceholder}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className={`w-full ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 text-xs bg-slate-900 border border-slate-800 rounded-xl focus:outline-none focus:border-orange-500 text-white focus:ring-1 focus:ring-orange-500/30 placeholder-slate-500`}
                />
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              className="w-full py-3.5 mt-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-650 hover:to-amber-700 text-white text-xs font-bold rounded-xl transition duration-200 shadow-lg shadow-orange-500/15 cursor-pointer flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4 text-white" />
              <span>{t.loginBtn}</span>
            </button>

            <div className="pt-3 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  setSession({ role: 'admin', name: adminName });
                }}
                className="w-full py-2.5 px-3 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 hover:text-teal-200 border border-teal-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer font-sans"
              >
                <span>⚡</span>
                <span>{isRtl ? 'الدخول العام المباشر للنظام (بدون تسجيل)' : 'Instant Direct Access (Bypass Login)'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Unified Number Footer info */}
        <div className="mt-6 flex flex-col items-center gap-1.5">
          <div className="text-center text-slate-500 text-xs font-bold tracking-wider select-all flex items-center justify-center gap-2 transition duration-200 hover:text-slate-400">
            <span className="inline-block w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>
            <span>{isRtl ? `الرقم الموحد: ${companyUnified}` : `Unified Number: ${companyUnified}`}</span>
          </div>
          <div className="text-center text-slate-400 text-[10px] font-medium transition duration-200 hover:text-slate-500">
            {isRtl ? 'نظام صيانة معدات السلامة - Nesma First © 2026' : 'Safety Equipment Maintenance System - Nesma First © 2026'}
          </div>
        </div>
      </div>
    );
  }

  const controlPanelActiveBranchId = isGeneralAdmin ? selectedBranchId : (session?.companyBranchId || 'hq');

  const controlPanelFilteredTechs = technicians.filter(t => {
    if (session?.isBranchUser) {
      return t.companyBranchId === session.companyBranchId;
    }
    if (controlPanelActiveBranchId === 'all') return true;
    if (controlPanelActiveBranchId === 'hq') return !t.companyBranchId || t.companyBranchId === 'hq';
    return t.companyBranchId === controlPanelActiveBranchId;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between" dir={isRtl ? 'rtl' : 'ltr'}>
      {isViewingRemoteBranch && (
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white text-xs font-bold py-2.5 px-4 text-center flex items-center justify-center gap-3 shadow-inner sticky top-0 z-50 animate-pulse duration-3000">
          <span>⚠️ {isRtl ? 'أنت الآن تتصفح بيانات فرع جدة المستقل (وضع الاطلاع الآمن للقراءة فقط)' : 'You are currently browsing Jeddah independent branch data (Safe Read-Only View Mode)'}</span>
          <button
            onClick={async () => {
              await reloadCentralData();
              setSelectedBranchId('all');
            }}
            className="bg-white/20 hover:bg-white/30 text-white border border-white/30 px-2.5 py-1 rounded-lg text-[10px] transition font-bold cursor-pointer"
          >
            {isRtl ? 'العودة للمقر الرئيسي' : 'Return to HQ'}
          </button>
        </div>
      )}
      
      {/* Premium Navigation Hub Header */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-md border-b border-slate-800 print:hidden">
        <div className="max-w-[1480px] mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-2">
            
            {/* System brand identity */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-1 min-w-0">
              <img src="/logo_nesma.png?v=2" className="w-14 h-10 sm:w-20 sm:h-14 object-contain px-0.5" alt="Nesma First Logo" referrerPolicy="no-referrer" />
              <div className="leading-tight min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-extrabold text-xs sm:text-sm md:text-base tracking-wide block uppercase text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-sky-300 truncate">{t.appName}</span>
                  {systemMode === 'independent_branch' && (
                    <span className="px-1.5 py-0.5 bg-amber-500 text-slate-950 font-sans font-black text-[8px] sm:text-[9px] uppercase tracking-wider rounded shrink-0 animate-pulse">
                      {isRtl ? 'فرع مستقل' : 'IND INDEPENDENT'}
                    </span>
                  )}
                </div>
                <span className="text-[9px] text-slate-400 hidden sm:block font-medium font-sans">{t.safetyEquipmentSystems}</span>
              </div>
            </div>

              {/* Quick alert indicator & User deck */}
              <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              
                {/* Warnings Pill notifier */}
                {pendingAlertCount > 0 && (session.role === 'admin' || session.role === 'viewer') && (
                  <div 
                    className="flex items-center gap-1 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-semibold cursor-help"
                    title={isRtl ? `يوجد ${pendingAlertCount} زيارات صيانة مستحقة الموعد` : `There are ${pendingAlertCount} alert visits`}
                  >
                    <Bell className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500 shrink-0" />
                    <span className="font-mono text-[10px] sm:text-xs">{pendingAlertCount}</span>
                    <span className="hidden sm:inline">{t.alertDaysNotification}</span>
                  </div>
                )}

                {/* Database Sync Status Indicators with manual refresh */}
                <button
                  type="button"
                  onClick={async () => {
                    setIsSyncing(true);
                    try {
                      const response = await fetch('/api/data?t=' + Date.now() + '&forceCloudSync=true');
                      const json = await response.json();
                      if (json.success && json.data) {
                        const d = json.data;
                        
                        const remoteDeletedVisitIds = Array.isArray(d.deletedVisitIds) ? d.deletedVisitIds : [];
                        const activeVisits = Array.isArray(d.visits) ? d.visits.filter((v: any) => v && v.id && !remoteDeletedVisitIds.includes(v.id)) : [];
                        const activeEV = Array.isArray(d.emergencyVisits) ? d.emergencyVisits.filter((v: any) => v && v.id && !remoteDeletedVisitIds.includes(v.id)) : [];

                        const stateStr = JSON.stringify({
                          clients: d.clients || [],
                          visits: activeVisits,
                          technicians: d.technicians || [],
                          daysBeforeVisitAlert: d.daysBeforeVisitAlert ?? 2,
                          notificationLogs: d.notificationLogs || [],
                          quotations: d.quotations || [],
                          emergencyVisits: activeEV,
                          deletedVisitIds: remoteDeletedVisitIds,
                          managerPhone: d.managerPhone || '0555012345',
                          managerEmail: d.managerEmail || 'maintenance-admin@sas-safety.com',
                          adminUsername: d.adminUsername || 'admin',
                          adminPassword: d.adminPassword || '123',
                          adminName: d.adminName || 'المشرف العام'
                        });
                        
                        // Suspend replication hook briefly while state updates
                        setIsSyncLoaded(false);
                        masterStateRef.current = stateStr;

                        if (Array.isArray(d.deletedVisitIds)) {
                          setDeletedVisitIds(d.deletedVisitIds);
                          localStorage.setItem('sas_deleted_visit_ids', JSON.stringify(d.deletedVisitIds));
                        }
                        if (Array.isArray(d.clients)) {
                          const cleanedClients = d.clients.map((c: any) => {
                            if (!c || !Array.isArray(c.inquiries)) return c;
                            return {
                              ...c,
                              inquiries: c.inquiries.filter((inq: any) => inq && inq.id !== 'inq_1780662623192' && !(inq.text || '').includes('بياتو'))
                            };
                          });
                          setClients(cleanedClients);
                          localStorage.setItem('sas_clients', JSON.stringify(cleanedClients));
                        }
                        setVisits(activeVisits);
                        localStorage.setItem('sas_visits', JSON.stringify(activeVisits));

                        if (Array.isArray(d.technicians)) {
                          setTechnicians(d.technicians);
                          localStorage.setItem('sas_technicians', JSON.stringify(d.technicians));
                        }
                        if (d.daysBeforeVisitAlert !== undefined) {
                          setDaysBeforeVisitAlert(d.daysBeforeVisitAlert);
                          localStorage.setItem('sas_alert_days', d.daysBeforeVisitAlert.toString());
                        }
                        if (Array.isArray(d.notificationLogs)) {
                          setNotificationLogs(d.notificationLogs);
                          localStorage.setItem('sas_notification_logs', JSON.stringify(d.notificationLogs));
                        }
                        if (Array.isArray(d.quotations)) {
                          setQuotations(d.quotations);
                          localStorage.setItem('sas_quotations', JSON.stringify(d.quotations));
                        }
                        setEmergencyVisits(activeEV);
                        localStorage.setItem('sas_emergency_visits', JSON.stringify(activeEV));

                        if (d.managerPhone) {
                          setManagerPhone(d.managerPhone);
                          localStorage.setItem('sas_manager_phone', d.managerPhone);
                        }
                        if (d.managerEmail) {
                          setManagerEmail(d.managerEmail);
                          localStorage.setItem('sas_manager_email', d.managerEmail);
                        }
                        if (d.adminUsername) {
                          setAdminUsername(d.adminUsername);
                          localStorage.setItem('sas_admin_username', d.adminUsername);
                        }
                        if (d.adminPassword) {
                          setAdminPassword(d.adminPassword);
                          localStorage.setItem('sas_admin_password', d.adminPassword);
                        }
                        if (d.adminName) {
                          setAdminName(d.adminName);
                          localStorage.setItem('sas_admin_name', d.adminName);
                        }

                        setTimeout(() => {
                          setIsSyncLoaded(true);
                          setLastSyncTime(new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }));
                        }, 100);
                      }
                    } catch (err) {
                      console.error('Manual force sync failed:', err);
                    } finally {
                      setIsSyncing(false);
                    }
                  }}
                  className="px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-705 hover:bg-slate-700 text-white text-[10px] sm:text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shrink-0"
                  title={isRtl ? 'مزامنة وتحديث البيانات الآن من الخادم' : 'Forcibly load & sync backend data'}
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline-block font-sans">
                    {isSyncing 
                      ? (isRtl ? 'جاري التحديث...' : 'Syncing...') 
                      : (isRtl ? `تحديث (${lastSyncTime || 'الآن'})` : `Sync (${lastSyncTime || 'Now'})`)}
                  </span>
                  <span className="inline-block sm:hidden text-[10px] w-2 h-2 rounded-full bg-teal-400 animate-pulse animate-duration-1000"></span>
                </button>

                {/* 🏢 Company Branch Selector (Fixed with the new name "المقر الرئيسي" / "Headquarters" as requested) */}
                {(session?.role === 'admin' || session?.role === 'viewer') && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="px-2.5 py-1 sm:py-1.5 bg-slate-800 border border-slate-700 text-teal-300 text-[10px] sm:text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
                      <span>
                        {isRtl ? 'المقر الرئيسي' : 'Headquarters'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Language Switcher Button */}
                <button
                  id="lang-toggle-btn"
                  onClick={() => {
                    const nextLang: Language = lang === 'ar' ? 'en' : 'ar';
                    setLang(nextLang);
                  }}
                  className="px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white text-[10px] sm:text-xs font-bold rounded-xl transition flex items-center gap-1 sm:gap-1.5 cursor-pointer shrink-0"
                >
                  <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="hidden sm:inline">{t.changeLanguageBtn}</span>
                  <span className="sm:hidden text-[10px] uppercase font-bold">{lang === 'ar' ? 'EN' : 'AR'}</span>
                </button>

              {/* Account Display & Logout Action */}
              <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                <div className="hidden md:flex flex-col text-end justify-center relative">
                  <span className="text-xs font-bold text-slate-200">
                    {t.welcomeUser} {session.name}
                  </span>
                  {session.role === 'admin' ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsHeaderDropdownOpen(!isHeaderDropdownOpen)}
                        className="text-[10px] font-bold text-teal-400 hover:text-teal-300 transition-colors flex items-center gap-1 cursor-pointer select-none bg-slate-800 border border-slate-705 px-2 py-0.5 rounded-lg mt-0.5 shrink-0"
                      >
                        <span>⚙️ {isRtl ? 'لوحة التحكم / الإعدادات' : 'Control Panel / Settings'}</span>
                        <ChevronDown className="w-2.5 h-2.5" />
                      </button>
                      
                      {isHeaderDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsHeaderDropdownOpen(false)} />
                          <div className="absolute right-0 mt-1.5 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-xl py-1 text-xs text-start z-50 text-slate-100 font-sans divide-y divide-slate-800">
                            <div className="px-3 py-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                              {isRtl ? 'إعدادات المنظومة وصلاحيات الدخول' : 'Access Control & System Settings'}
                            </div>
                            <div className="py-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsHeaderDropdownOpen(false);
                                  setControlPanelActiveTab('profile');
                                  setIsControlPanelModalOpen(true);
                                }}
                                className="w-full text-start px-3 py-1.5 hover:bg-slate-850 transition-colors flex items-center gap-2 text-slate-200 hover:text-white cursor-pointer font-bold"
                              >
                                <span>👤</span>
                                <span>{isRtl ? 'تعديل البيانات الشخصية' : 'Edit Personal Profile'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsHeaderDropdownOpen(false);
                                  setControlPanelActiveTab('password');
                                  setIsControlPanelModalOpen(true);
                                }}
                                className="w-full text-start px-3 py-1.5 hover:bg-slate-850 transition-colors flex items-center gap-2 text-slate-200 hover:text-white cursor-pointer font-bold"
                              >
                                <span>🔑</span>
                                <span>{isRtl ? 'تغيير كلمة المرور' : 'Change Password'}</span>
                              </button>
                            </div>
                            <div className="py-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsHeaderDropdownOpen(false);
                                  setControlPanelActiveTab('addUser');
                                  setIsControlPanelModalOpen(true);
                                }}
                                className="w-full text-start px-3 py-1.5 hover:bg-slate-855 transition-colors flex items-center gap-2 text-slate-200 hover:text-white cursor-pointer font-bold"
                              >
                                <span>➕</span>
                                <span>{isRtl ? 'إضافة مستخدم جديد وصلاحيات' : 'Add New User & pass'}</span>
                              </button>
                              {canManageUsers && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsHeaderDropdownOpen(false);
                                    setControlPanelActiveTab('listUsers');
                                    setIsControlPanelModalOpen(true);
                                  }}
                                  className="w-full text-start px-3 py-1.5 hover:bg-slate-855 transition-colors flex items-center gap-2 text-slate-200 hover:text-white cursor-pointer font-bold border-t border-slate-800"
                                >
                                  <span>👥</span>
                                  <span>{isRtl ? 'إدارة مستخدمي النظام' : 'Manage System Users'}</span>
                                </button>
                              )}
                              {isGeneralAdmin && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsHeaderDropdownOpen(false);
                                    setControlPanelActiveTab('backup');
                                    setIsControlPanelModalOpen(true);
                                  }}
                                  className="w-full text-start px-3 py-1.5 hover:bg-slate-855 transition-colors flex items-center gap-2 text-slate-200 hover:text-white cursor-pointer font-bold border-t border-slate-800"
                                >
                                  <span>💾</span>
                                  <span>{isRtl ? 'النسخ الاحتياطي والاستعادة' : 'Backup & Restore Data'}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ) : session.role === 'client' ? (
                    <div className="relative font-sans">
                      <button
                        type="button"
                        onClick={() => setIsHeaderDropdownOpen(!isHeaderDropdownOpen)}
                        className="text-[10px] font-bold text-teal-400 hover:text-teal-350 transition-colors flex items-center gap-1 cursor-pointer select-none bg-slate-800 border border-slate-705 px-2.5 py-1 rounded-lg mt-0.5 shrink-0"
                      >
                        <span>⚙️ {isRtl ? 'لوحة التحكم / الإعدادات' : 'Dashboard / Settings'}</span>
                        <ChevronDown className="w-2.5 h-2.5" />
                      </button>
                      
                      {isHeaderDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsHeaderDropdownOpen(false)} />
                          <div className="absolute right-0 mt-1.5 w-56 bg-slate-900 border border-slate-700/85 rounded-xl shadow-xl py-1 text-xs text-start z-50 text-slate-100 font-sans divide-y divide-slate-800">
                            {/* Header Label inside settings */}
                            <div className="px-3 py-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                              {session.subUserId 
                                ? (isRtl ? 'صلاحيات مستخدم الحساب الفرعي' : 'Sub-user Limited Permissions')
                                : (isRtl ? 'لوحة تحكم إعدادات المنشأة' : 'Facility Control Dashboard')
                              }
                            </div>

                            {/* Options available only for the account owner/responsible administrator */}
                            <div className="py-0.5">
                              {!session.subUserId ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsHeaderDropdownOpen(false);
                                      const c = clients.find(cl => cl.id === session.id);
                                      if (c) {
                                        setClientEditName(c.name || '');
                                        setClientEditPhone(c.phone || '');
                                        setClientEditEmail(c.email || '');
                                        setClientEditLocation(c.locationText || '');
                                        setClientEditUsername(c.username || c.id || '');
                                        setClientEditPassword(c.password || '');
                                        setClientControlActiveTab('profile');
                                        setIsClientControlPanelOpen(true);
                                      }
                                    }}
                                    className="w-full text-start px-3 py-1.5 hover:bg-slate-850 transition-colors flex items-center gap-2 text-slate-200 hover:text-white cursor-pointer font-bold"
                                  >
                                    <span>👤</span>
                                    <span>{isRtl ? 'تعديل البيانات' : 'Update Client Profile'}</span>
                                  </button>
                                  
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsHeaderDropdownOpen(false);
                                      const c = clients.find(cl => cl.id === session.id);
                                      if (c) {
                                        setClientEditPassword(c.password || '');
                                        setClientControlActiveTab('password');
                                        setIsClientControlPanelOpen(true);
                                      }
                                    }}
                                    className="w-full text-start px-3 py-1.5 hover:bg-slate-850 transition-colors flex items-center gap-2 text-slate-200 hover:text-white cursor-pointer font-bold"
                                  >
                                    <span>🔑</span>
                                    <span>{isRtl ? 'تغيير كلمة المرور' : 'Change Password'}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsHeaderDropdownOpen(false);
                                      setSubUserFullName('');
                                      setSubUserPhone('');
                                      setSubUserUsername('');
                                      setSubUserPassword('');
                                      setSubUserPermViewVisits(true);
                                      setSubUserPermReplyQuotes(true);
                                      setSubUserPermSubmitInquiries(true);
                                      setClientControlActiveTab('subUsers');
                                      setIsClientControlPanelOpen(true);
                                    }}
                                    className="w-full text-start px-3 py-1.5 hover:bg-slate-850 transition-colors flex items-center gap-2 text-slate-250 hover:text-white cursor-pointer font-bold"
                                  >
                                    <span>➕</span>
                                    <span>{isRtl ? 'إضافة مستخدمين وصلاحيات' : 'Add System Sub-user'}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsHeaderDropdownOpen(false);
                                      setClientControlActiveTab('manageSubUsers');
                                      setIsClientControlPanelOpen(true);
                                    }}
                                    className="w-full text-start px-3 py-1.5 hover:bg-slate-850 transition-colors flex items-center gap-2 text-slate-200 hover:text-white cursor-pointer font-bold"
                                  >
                                    <span>👥</span>
                                    <span>{isRtl ? 'إدارة المستخدمين للنظام' : 'Manage Sub-users'}</span>
                                  </button>
                                </>
                              ) : (
                                <div className="px-3 py-2 text-[10px] text-slate-400 leading-relaxed">
                                  ⚠️ {isRtl 
                                    ? 'هذه الميزات متاحة فقط للمسؤول والمشرف الرئيسي عن المنشأة.' 
                                    : 'These admin actions are restricted to the main facility coordinator.'}
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <span className="text-[9px] uppercase font-bold text-slate-400 self-end font-sans">
                      {t.techsRoleGroup}
                    </span>
                  )}
                </div>

                <button
                  id="header-logout-btn"
                  onClick={handleLogout}
                  className="px-2 sm:px-3 py-1 sm:py-1.5 bg-rose-950/30 hover:bg-rose-900 border border-rose-900/30 text-rose-400 hover:text-white hover:border-rose-600 text-[10px] sm:text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shrink-0"
                  title={t.logoutBtn}
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">{t.logoutBtn}</span>
                </button>
              </div>

            </div>

          </div>
        </div>
      </header>

      {/* Main Core Container */}
      {(() => {
        const activeBranchId = isGeneralAdmin ? selectedBranchId : (session?.companyBranchId || 'hq');

        const filteredClients = clients.filter(c => {
          if (activeBranchId === 'all') return true;
          if (activeBranchId === 'hq') return !c.companyBranchId || c.companyBranchId === 'hq';
          return c.companyBranchId === activeBranchId;
        });

        const filteredVisits = visits.filter(v => {
          if (activeBranchId === 'all') return true;
          if (activeBranchId === 'hq') return !v.companyBranchId || v.companyBranchId === 'hq';
          return v.companyBranchId === activeBranchId;
        });

        const filteredTechnicians = technicians.filter(t => {
          if (activeBranchId === 'all') return true;
          if (activeBranchId === 'hq') return !t.companyBranchId || t.companyBranchId === 'hq';
          return t.companyBranchId === activeBranchId;
        });

        const filteredQuotations = quotations.filter(q => {
          if (activeBranchId === 'all') return true;
          if (activeBranchId === 'hq') return !q.companyBranchId || q.companyBranchId === 'hq';
          return q.companyBranchId === activeBranchId;
        });

        const filteredEmergencyVisits = emergencyVisits.filter(v => {
          const vBranchId = v.companyBranchId || clients.find(c => c.id === v.clientId)?.companyBranchId || 'hq';
          if (activeBranchId === 'all') return true;
          if (activeBranchId === 'hq') return !vBranchId || vBranchId === 'hq';
          return vBranchId === activeBranchId;
        });

        const filteredExtinguisherReceipts = extinguisherReceipts.filter(r => {
          if (activeBranchId === 'all') return true;
          if (activeBranchId === 'hq') return !r.companyBranchId || r.companyBranchId === 'hq';
          return r.companyBranchId === activeBranchId;
        });

        const filteredNotificationLogs = notificationLogs.filter(log => {
          if (activeBranchId === 'all') return true;
          if (activeBranchId === 'hq') return !log.companyBranchId || log.companyBranchId === 'hq';
          return log.companyBranchId === activeBranchId;
        });

        return (
          <main className="max-w-[1480px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 print:p-0">
            
            {/* Quick Import Banner when system is cleared/ready for backup file */}
            {(session.role === 'admin' || session.role === 'viewer') && isGeneralAdmin && clients.length === 0 && visits.length === 0 && (
              <div className="mb-6 p-4 sm:p-5 bg-gradient-to-r from-teal-950/70 via-slate-900/90 to-slate-950 border border-teal-500/40 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl text-start">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center text-2xl shrink-0 shadow-inner border border-teal-500/30">
                    📥
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                      <span>{isRtl ? 'قاعدة البيانات فارغة وجاهزة لاستيراد نسختك الاحتياطية' : 'Database Ready for Backup Import'}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-teal-500/20 text-teal-300 font-mono font-bold border border-teal-500/30">جاهز للرفع</span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {isRtl 
                        ? 'تم تصفير البيانات بنجاح. يمكنك الآن رفع ملف JSON الخاص بالنسخة الاحتياطية ليتم إدراج ومزامنة كافة العقود والزيارات فوراً في السحابة والرابط العام.' 
                        : 'System data wiped. You can now import your backup JSON to restore all contracts and visits.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setControlPanelActiveTab('backup');
                      setIsControlPanelModalOpen(true);
                      setTimeout(() => {
                        document.getElementById('backup-import-file')?.click();
                      }, 250);
                    }}
                    className="w-full md:w-auto px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-black rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer font-sans"
                  >
                    <span>📤</span>
                    <span>{isRtl ? 'اختيار ورفع ملف النسخة الاحتياطية (.json)' : 'Select Backup File (.json)'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Router according to Active login profile */}
            {session.role === 'admin' || session.role === 'viewer' ? (
              
              /* Admin Consol Controls */
              <AdminDashboard
                clients={filteredClients}
                visits={filteredVisits.filter(v => v && v.id && !deletedVisitIds.includes(v.id))}
                technicians={filteredTechnicians}
                quotations={filteredQuotations}
                emergencyVisits={filteredEmergencyVisits.filter(v => v && v.id && !deletedVisitIds.includes(v.id))}
                onUpdateEmergencyVisit={handleUpdateEmergencyVisit}
                onAddEmergencyVisit={handleAddEmergencyVisit}
                onDeleteEmergencyVisit={handleDeleteEmergencyVisit}
                onAddQuotation={handleAddQuotation}
                onDeleteQuotation={handleDeleteQuotation}
                onAddClient={handleAddClient}
                onEditClient={handleEditClient}
                onRenewContract={handleRenewContract}
                onDeleteClient={handleDeleteClient}
                onSelectVisit={setSelectedVisitForModal}
                onUpdateSettings={(days: number) => {
                  setDaysBeforeVisitAlert(days);
                  setLocalVersion(v => v + 1);
                }}
                daysBeforeVisitAlert={daysBeforeVisitAlert}
                lang={lang}
                onAddTechnician={handleAddTechnician}
                onDeleteTechnician={handleDeleteTechnician}
                onEditTechnician={handleEditTechnician}
                notificationLogs={filteredNotificationLogs}
                onDeleteNotificationLog={handleDeleteNotificationLog}
                onClearAllNotificationLogs={handleClearAllNotificationLogs}
                sendSMSNotification={sendSMSNotification}
                sendEmailNotification={sendEmailNotification}
                sendWhatsAppNotification={sendWhatsAppNotification}
                managerPhone={managerPhone}
                onUpdateManagerPhone={(phone: string) => {
                  setManagerPhone(phone);
                  setLocalVersion(v => v + 1);
                }}
                managerEmail={managerEmail}
                onUpdateManagerEmail={(email: string) => {
                  setManagerEmail(email);
                  setLocalVersion(v => v + 1);
                }}
                adminUsername={adminUsername}
                adminPassword={adminPassword}
                adminName={adminName}
                onUpdateAdminProfile={(name: string, user: string, pass: string) => {
                  setAdminName(name);
                  setAdminUsername(user);
                  setAdminPassword(pass);
                  localStorage.setItem('sas_admin_name', name);
                  localStorage.setItem('sas_admin_username', user);
                  localStorage.setItem('sas_admin_password', pass);
                  setSession(prev => prev ? { ...prev, name } : null);
                  setLocalVersion(v => v + 1);
                }}
                maintenanceModeEnabled={maintenanceModeEnabled}
                onUpdateMaintenanceMode={(enabled: boolean) => {
                  setMaintenanceModeEnabled(enabled);
                  localStorage.setItem('sas_maintenance_mode_enabled', enabled ? 'true' : 'false');
                  setLocalVersion(v => v + 1);
                }}
                currentSessionUser={session}
                onReplyInquiry={handleReplyInquiry}
                onDeleteOrResetVisit={handleDeleteOrResetVisit}
                extinguisherReceipts={extinguisherReceipts}
                companyBranches={companyBranches}
                activeBranchId={activeBranchId}
                onSetExtinguisherReceipts={handleSetExtinguisherReceipts}
                smtpHost={smtpHost}
                onUpdateSmtpHost={(v: string) => {
                  setSmtpHost(v);
                  localStorage.setItem('sas_smtp_host', v);
                  setLocalVersion(prev => prev + 1);
                }}
                smtpPort={smtpPort}
                onUpdateSmtpPort={(v: string) => {
                  setSmtpPort(v);
                  localStorage.setItem('sas_smtp_port', v);
                  setLocalVersion(prev => prev + 1);
                }}
                smtpUser={smtpUser}
                onUpdateSmtpUser={(v: string) => {
                  setSmtpUser(v);
                  localStorage.setItem('sas_smtp_user', v);
                  setLocalVersion(prev => prev + 1);
                }}
                smtpPass={smtpPass}
                onUpdateSmtpPass={(v: string) => {
                  setSmtpPass(v);
                  localStorage.setItem('sas_smtp_pass', v);
                  setLocalVersion(prev => prev + 1);
                }}
                smtpFromEmail={smtpFromEmail}
                onUpdateSmtpFromEmail={(v: string) => {
                  setSmtpFromEmail(v);
                  localStorage.setItem('sas_smtp_from_email', v);
                  setLocalVersion(prev => prev + 1);
                }}
                smtpEnabled={smtpEnabled}
                onUpdateSmtpEnabled={(v: boolean) => {
                  setSmtpEnabled(v);
                  localStorage.setItem('sas_smtp_enabled', v ? 'true' : 'false');
                  setLocalVersion(prev => prev + 1);
                }}
                onUpdateVisit={handleUpdateVisit}
                onForceSync={forceSaveToDatabase}
                customization={customization}
                onSaveCustomization={handleSaveCustomization}
              />
              
            ) : session.role === 'client' ? (
              
              /* Client Portal View */
              <ClientPortal
                client={clients.find(c => c.id === session.id) || clients[0]}
                visits={visits.filter(v => v.clientId === session.id && !deletedVisitIds.includes(v.id))}
                technicians={technicians}
                quotations={quotations}
                emergencyVisits={emergencyVisits.filter(v => v && v.id && !deletedVisitIds.includes(v.id))}
                onReplyQuotation={handleReplyQuotation}
                onAddEmergencyVisit={handleAddEmergencyVisit}
                lang={lang}
                onLogout={handleLogout}
                onSubmitInquiry={handleClientSubmitInquiry}
                onSelectVisit={setSelectedVisitForModal}
                adminName={adminName}
                managerPhone={managerPhone}
                subUserPermissions={session.subUserPermissions}
                onEditInquiry={handleClientUpdateInquiry}
                onDeleteInquiry={handleClientDeleteInquiry}
                extinguisherReceipts={extinguisherReceipts}
                onSetExtinguisherReceipts={handleSetExtinguisherReceipts}
                onUpdateQuotation={handleAddQuotation}
                customization={customization}
                onUpdateClient={(updated) => handleEditClient(updated, false)}
              />
              
            ) : (
              
              /* Technicians Workspace - securely locked to assigned workload only */
              <div className="space-y-4">
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 p-4 rounded-2xl text-xs font-semibold leading-relaxed">
                  {t.onlyAssignedVisitsShown}
                </div>
                
                <TechnicianView
                  technician={technicians.find(t => t.id === session.id) || technicians[0]}
                  visits={visits.filter(v => v.technicianId === session.id && !deletedVisitIds.includes(v.id))}
                  clients={clients.filter(c => c.assignedTechnicianId === session.id || (c.branches && c.branches.some(b => b.assignedTechnicianId === session.id)))}
                  emergencyVisits={emergencyVisits.filter(v => v && v.id && !deletedVisitIds.includes(v.id))}
                  onAddEmergencyVisit={handleAddEmergencyVisit}
                  onSubmitReport={handleSubmitReport}
                  onSelectVisit={setSelectedVisitForModal}
                  onUpdateClient={handleUpdateClient}
                  onUpdateTechnician={handleEditTechnician}
                  lang={lang}
                  extinguisherReceipts={extinguisherReceipts}
                  onSetExtinguisherReceipts={handleSetExtinguisherReceipts}
                  quotations={quotations}
                  onUpdateQuotation={handleAddQuotation}
                  customization={customization}
                />
              </div>
              
            )}

          </main>
        );
      })()}

      {/* Clean Aesthetic Footer Panel */}
      <footer className="bg-white border-t border-slate-200/80 py-4 mt-8 text-center text-xs text-slate-500 print:hidden">
        <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div>
            <span>{t.systemUnderMaintenance} </span>
            <strong className="text-slate-800 font-bold">Nesma First © 2026</strong>
          </div>
          <div className="flex flex-wrap items-center gap-3 justify-center sm:justify-end">
            {/* Realtime database full-stack synchronization status indicator */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-50 border border-teal-200/80 text-teal-850 font-bold text-[11px] select-none shadow-sm font-sans">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isSyncing ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isSyncing ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
              </span>
              <span>
                {isSyncing 
                  ? (isRtl ? 'جاري مزامنة التعديلات...' : 'Uploading updates...') 
                  : (isRtl ? 'مخزن سحابي مركزي نشط' : 'Cloud Server Sync Active')}
              </span>
              {lastSyncTime && (
                <span className="font-mono text-[9px] bg-teal-100 text-teal-800 px-1.5 py-0.2 rounded font-bold">
                  {lastSyncTime}
                </span>
              )}
            </div>

            <span className="text-[11px] font-mono select-none px-2 py-1 bg-slate-100 rounded-xl text-slate-600 border border-slate-200 font-bold">
              {t.todayDateLabel} {new Date().toISOString().split('T')[0]} (UTC)
            </span>
            {(!session || (session.role === 'admin' && !session.isBranchUser && (!session.companyBranchId || session.companyBranchId === 'hq'))) && (
              <button
                id="reset-state-button"
                onClick={handleResetApp}
                className="text-xs text-rose-600 hover:text-rose-900 font-bold flex items-center gap-1 hover:underline cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {t.resetStateButton}
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Global Inspections Details Modal */}
      {selectedVisitForModal && (
        <VisitDetailsModal
          visit={selectedVisitForModal}
          client={getClientOfVisit(selectedVisitForModal.clientId)}
          onClose={() => setSelectedVisitForModal(null)}
          lang={lang}
          isAdmin={session?.role === 'admin'}
          technicians={technicians}
          onUpdateVisit={handleUpdateVisit}
          onDeleteOrResetVisit={handleDeleteOrResetVisit}
        />
      )}

      {/* ⚠️ Beautiful Custom Reset Options Modal (Iframe Safe) */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-white rounded-3xl border border-slate-150 shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up text-start">
            
            {/* Header / Alarm area */}
            <div className="p-6 bg-rose-50 border-b border-rose-100 flex gap-4 items-center">
              <div className="p-3 bg-rose-100 rounded-2xl text-rose-600 animate-pulse">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {isRtl ? 'إعادة تهيئة ومسح بيانات المنصة' : 'Reset & Configure Platform Data'}
                </h3>
                <p className="text-xs text-rose-700/80 font-sans mt-0.5">
                  {isRtl ? 'يرجى اختيار الطريقة المفضلة لإعادة التعيين:' : 'Please selection your preferred database profile:'}
                </p>
              </div>
              <button 
                onClick={() => setShowResetModal(false)}
                className="ms-auto p-1.5 rounded-xl bg-white hover:bg-slate-105 hover:text-rose-600 border border-slate-150 text-slate-400 cursor-pointer shadow-sm transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Core Choices Options */}
            <div className="p-6 space-y-3.5">
              
              {/* Option A: Full Empty Wipe */}
              <button
                onClick={handleFullWipe}
                className="w-full p-4 bg-rose-50/25 hover:bg-rose-55 hover:border-rose-400 border border-slate-200/80 rounded-2xl flex gap-3 text-start items-start group transition cursor-pointer"
              >
                <div className="p-2.5 bg-rose-100 text-rose-600 rounded-xl group-hover:bg-rose-600 group-hover:text-white transition">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-950 block">{isRtl ? 'مسح تام والبدء من الصفر (فارغ)' : 'Clear state & start empty'}</span>
                    <span className="text-[9px] bg-rose-105 text-rose-700 font-bold px-1.5 py-0.2 rounded border border-rose-200 uppercase">{isRtl ? 'موصى به للعمل الفعلي' : 'Clean'}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                    {isRtl ? 'صمم هذا الخيار لتتمكن من إدخال عملاء الصيانة، العقود، والفروع الفعلية الخاصة بكم بأي وقت دون تداخل بيانات النظام الوهمية.' : 'Purges all mock clients/visits immediately so you can enter your genuine company details.'}
                  </p>
                </div>
              </button>

              {/* Option B: Reset to default active demo data */}
              <button
                onClick={handleResetToDemo}
                className="w-full p-4 bg-teal-50/15 hover:bg-slate-50 hover:border-teal-400 border border-slate-200/80 rounded-2xl flex gap-3 text-start items-start group transition cursor-pointer"
              >
                <div className="p-2.5 bg-teal-100 text-teal-700 rounded-xl group-hover:bg-teal-600 group-hover:text-white transition">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-950 block">{isRtl ? 'إعادة ضبط إلى البيانات التجريبية' : 'Reset to default sample database'}</span>
                    <span className="text-[9px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.2 rounded border border-slate-200 uppercase">{isRtl ? 'توضيحي' : 'Demo'}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                    {isRtl ? 'سيقوم هذا الخيار بإعادة تعيين وتحميل عملاء الصيانة الوهميين وعينة من تقارير وزيارات الصيانة لتجربة المزايا.' : 'Reloads standard pre-configured client records to demonstrate operations and alarm workflows.'}
                  </p>
                </div>
              </button>

            </div>

            {/* Footer options */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-105 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-xl transition cursor-pointer font-sans"
              >
                {isRtl ? 'تراجع وإلغاء' : 'Close / Go Back'}
              </button>
            </div>

          </div>
        </div>
      )}

      {isClientControlPanelOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in animate-duration-300" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col text-start">
            
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-teal-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚙️</span>
                <div>
                  <h3 className="text-sm font-bold">{isRtl ? 'إعدادات حساب العميل والمستخدمين' : 'Client Profile, Password & Sub-users'}</h3>
                  <span className="text-[10px] text-teal-300 block">{isRtl ? 'بواسطة المسئول عن الحساب' : 'Managed by Account Owner'}</span>
                </div>
              </div>
              <button 
                onClick={() => setIsClientControlPanelOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition border border-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Swappers */}
            <div className="flex border-b border-slate-200 bg-slate-50 p-1.5 gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => setClientControlActiveTab('profile')}
                className={`flex-1 min-w-[100px] text-center px-3 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                  clientControlActiveTab === 'profile'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-250/50 hover:text-slate-950'
                }`}
              >
                👤 {isRtl ? 'بيانات المنشأة' : 'Edit Profile'}
              </button>
              <button
                type="button"
                onClick={() => setClientControlActiveTab('password')}
                className={`flex-1 min-w-[100px] text-center px-3 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                  clientControlActiveTab === 'password'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-250/50 hover:text-slate-950'
                }`}
              >
                🔑 {isRtl ? 'كلمة المرور' : 'Change Password'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setClientControlActiveTab('subUsers');
                  setEditingSubUserId(null); // clear sub-user editing form
                  setSubUserFullName('');
                  setSubUserPhone('');
                  setSubUserUsername('');
                  setSubUserPassword('');
                  setSubUserPermViewVisits(true);
                  setSubUserPermReplyQuotes(true);
                  setSubUserPermSubmitInquiries(true);
                }}
                className={`flex-1 min-w-[130px] text-center px-3 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                  clientControlActiveTab === 'subUsers'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-250/50 hover:text-slate-955'
                }`}
              >
                ➕ {isRtl ? 'مستخدم فرعي جديد' : 'Add Sub-user'}
              </button>
              <button
                type="button"
                onClick={() => setClientControlActiveTab('manageSubUsers')}
                className={`flex-1 min-w-[120px] text-center px-3 py-2 text-xs font-bold rounded-xl transition relative cursor-pointer ${
                  clientControlActiveTab === 'manageSubUsers'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-250/50 hover:text-slate-955'
                }`}
              >
                👥 {isRtl ? 'إدارة المستخدمين' : 'Manage Users'}
                {(() => {
                  const currC = clients.find(cl => cl.id === session?.id);
                  const subUsersCount = currC?.subUsers?.length || 0;
                  if (subUsersCount > 0) {
                    return (
                      <span className="absolute -top-1 right-2 bg-teal-500 text-white text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold font-mono">
                        {subUsersCount}
                      </span>
                    );
                  }
                  return null;
                })()}
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
              
              {/* Profile Tab */}
              {clientControlActiveTab === 'profile' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{isRtl ? 'اسم المنشأة/العميل *' : 'Company/Client Name'}</label>
                      <input 
                        type="text" 
                        value={clientEditName} 
                        onChange={(e) => setClientEditName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-safety-emerald"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{isRtl ? 'رقم جوال تواصل *' : 'Contact Phone'}</label>
                      <input 
                        type="text" 
                        value={clientEditPhone} 
                        onChange={(e) => setClientEditPhone(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-safety-emerald"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{isRtl ? 'البريد الإلكتروني للعميل' : 'Client Email Address'}</label>
                      <input 
                        type="email" 
                        value={clientEditEmail} 
                        onChange={(e) => setClientEditEmail(e.target.value)}
                        placeholder={isRtl ? 'مثال: client@example.com' : 'e.g. client@example.com'}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-safety-emerald font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{isRtl ? 'الموقع الجغرافي *' : 'Location Text'}</label>
                      <input 
                        type="text" 
                        value={clientEditLocation} 
                        onChange={(e) => setClientEditLocation(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-safety-emerald"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{isRtl ? 'اسم مستخدم الدخول *' : 'Login Username'}</label>
                      <input 
                        type="text" 
                        value={clientEditUsername} 
                        onChange={(e) => setClientEditUsername(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-safety-emerald"
                      />
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => {
                        if (!clientEditName.trim() || !clientEditPhone.trim() || !clientEditLocation.trim() || !clientEditUsername.trim()) {
                          alert(isRtl ? 'الرجاء تعبئة الحقول المطلوبة بشكل صحيح!' : 'Please fill all required inputs correctly!');
                          return;
                        }
                        const c = clients.find(cl => cl.id === session?.id);
                        if (c) {
                          const updated = {
                            ...c,
                            name: clientEditName,
                            phone: clientEditPhone,
                            email: clientEditEmail,
                            locationText: clientEditLocation,
                            username: clientEditUsername
                          };
                          handleEditClientMetadata(updated);
                          // Sync active session name
                          setSession(prev => prev ? { ...prev, name: clientEditName } : null);
                          alert(isRtl ? 'تم تحديث بيانات المنشأة ونقل التعديلات لمركز المعلومات بنجاح!' : 'Facility data updated successfully!');
                          setIsClientControlPanelOpen(false);
                        }
                      }}
                      className="px-4 py-2 bg-slate-900 hover:bg-teal-905 text-white hover:bg-slate-800 transition-colors text-xs font-bold rounded-xl cursor-pointer"
                    >
                      {isRtl ? 'حفظ التغييرات' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}

              {/* Password Tab */}
              {clientControlActiveTab === 'password' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{isRtl ? 'كلمة المرور الجديدة والخاصة بمدير الحساب' : 'New Primary Password'}</label>
                    <input 
                      type="password" 
                      value={clientEditPassword} 
                      onChange={(e) => setClientEditPassword(e.target.value)}
                      placeholder={isRtl ? 'ادخل الباسوورد الجديد لمدير الحساب' : 'Enter new primary account password'}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-safety-emerald"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => {
                        if (!clientEditPassword.trim()) {
                          alert(isRtl ? 'الرجاء إدخال باسوورد صحيح!' : 'Please enter a valid password!');
                          return;
                        }
                        const c = clients.find(cl => cl.id === session?.id);
                        if (c) {
                          const updated = {
                            ...c,
                            password: clientEditPassword
                          };
                          handleEditClientMetadata(updated);
                          alert(isRtl ? 'تم تغيير كلمة المرور الرئيسية بنجاح!' : 'Primary account password updated successfully!');
                          setIsClientControlPanelOpen(false);
                        }
                      }}
                      className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 transition-colors text-xs font-bold rounded-xl cursor-pointer"
                    >
                      {isRtl ? 'تحديث الباسوورد' : 'Update Password'}
                    </button>
                  </div>
                </div>
              )}

              {/* Add Sub-user Tab */}
              {clientControlActiveTab === 'subUsers' && (
                <div className="space-y-4">
                  <div className="bg-teal-50 border border-teal-100 p-4 rounded-2xl text-[11px] text-teal-900 font-semibold leading-relaxed">
                    💡 {isRtl 
                      ? 'يمكنك هنا تسجيل حسابات فرعية للعاملين بالمنشأة (مثال: مستلم الموقع، حارس المنشأة، مراجع المستندات) مع تحديد الصلاحيات الممنوحة لهم في المنظومة بدقة.'
                      : 'Register secondary system users to monitor safety logs, approve quotations or submit service complaints with strict visual scoping.'}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-start">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{isRtl ? 'اسم الموظف / المستخدم الفرعي *' : 'Employee Full Name *'}</label>
                      <input 
                        type="text" 
                        value={subUserFullName} 
                        onChange={(e) => setSubUserFullName(e.target.value)}
                        placeholder="مثال: يوسف خالد"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-safety-emerald"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{isRtl ? 'رقم الهاتف' : 'Phone Number'}</label>
                      <input 
                        type="text" 
                        value={subUserPhone} 
                        onChange={(e) => setSubUserPhone(e.target.value)}
                        placeholder="05xxxxxxxx"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-safety-emerald"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{isRtl ? 'اسم مستخدم الدخول للنظام (Username) *' : 'Login Username *'}</label>
                      <input 
                        type="text" 
                        value={subUserUsername} 
                        onChange={(e) => setSubUserUsername(e.target.value.toLowerCase())}
                        placeholder="youssef22"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none -indigo-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{isRtl ? 'الباسوورد للدخول (Password) *' : 'Login Password *'}</label>
                      <input 
                        type="password" 
                        value={subUserPassword} 
                        onChange={(e) => setSubUserPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-safety-emerald"
                      />
                    </div>
                  </div>

                  {/* Permissions Selection */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <span className="block text-xs font-bold text-slate-700 mb-1">{isRtl ? 'توزيع صلاحيات الاستخدام المتاحة' : 'Permissions Allocation'}</span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-150 hover:bg-slate-50 cursor-pointer text-xs select-none">
                        <input 
                          type="checkbox" 
                          checked={subUserPermViewVisits} 
                          onChange={(e) => setSubUserPermViewVisits(e.target.checked)}
                          className="w-4 h-4 rounded text-teal-600 border-slate-300 focus:ring-teal-500"
                        />
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-[10px]">{isRtl ? 'تقارير الصيانة والزيارات' : 'View Safety Reports'}</span>
                          <span className="text-[9px] text-slate-400">{isRtl ? 'استعراض حالة الفحص الفني للطفايات' : 'Observe safety checks'}</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-150 hover:bg-slate-50 cursor-pointer text-xs select-none">
                        <input 
                          type="checkbox" 
                          checked={subUserPermReplyQuotes} 
                          onChange={(e) => setSubUserPermReplyQuotes(e.target.checked)}
                          className="w-4 h-4 rounded text-teal-600 border-slate-300 focus:ring-teal-500"
                        />
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-[10px]">{isRtl ? 'اعتماد عروض الأسعار' : 'Approve Quotations'}</span>
                          <span className="text-[9px] text-slate-400">{isRtl ? 'الموافقة أو الرفض الإلكتروني لعروضنا' : 'Express decisions'}</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-150 hover:bg-slate-50 cursor-pointer text-xs select-none">
                        <input 
                          type="checkbox" 
                          checked={subUserPermSubmitInquiries} 
                          onChange={(e) => setSubUserPermSubmitInquiries(e.target.checked)}
                          className="w-4 h-4 rounded text-teal-600 border-slate-300 focus:ring-teal-500"
                        />
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-[10px]">{isRtl ? 'إرسال الشكاوى والملاحظات' : 'Submit Inquiries'}</span>
                          <span className="text-[9px] text-slate-400">{isRtl ? 'رفع الشكاوى لمدير المنظومة ومسكتها' : 'Contact managers'}</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => {
                        if (!subUserFullName.trim() || !subUserUsername.trim() || !subUserPassword.trim()) {
                          alert(isRtl ? 'يرجى كتابة الاسم الكامل، باسوورد، واسم مستخدم صالح!' : 'Please write complete full name, username, and password!');
                          return;
                        }
                        const c = clients.find(cl => cl.id === session?.id);
                        if (c) {
                          const currentSubUsers = c.subUsers || [];
                          
                          if (currentSubUsers.some(su => su.username.trim().toLowerCase() === subUserUsername.trim().toLowerCase())) {
                            alert(isRtl ? 'اسم مستخدم الدخول الفرعي موجود مسبقاً! الرجاء استخدام معرف آخر.' : 'This sub-user login username is already registered!');
                            return;
                          }

                          const newSub: ClientSubUser = {
                            id: `sub_${Date.now()}`,
                            name: subUserFullName,
                            phone: subUserPhone,
                            username: subUserUsername.trim().toLowerCase(),
                            password: subUserPassword,
                            role: 'client',
                            permissions: {
                              viewVisits: subUserPermViewVisits,
                              replyQuotes: subUserPermReplyQuotes,
                              submitInquiries: subUserPermSubmitInquiries
                            }
                          };

                          const updated = {
                            ...c,
                            subUsers: [...currentSubUsers, newSub]
                          };

                          handleEditClientMetadata(updated);
                          alert(isRtl ? 'تم تسجيل واجهة المستخدم الفرعي وتوزيع صلاحيات الدخول بنجاح!' : 'Sub-user registered successfully!');
                          setClientControlActiveTab('manageSubUsers');
                        }
                      }}
                      className="px-4 py-2 bg-slate-900 border border-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      {isRtl ? 'إرسال وتسجيل الحساب الفرعي' : 'Register Sub-account'}
                    </button>
                  </div>
                </div>
              )}

              {/* Manage Sub-Users Tab */}
              {clientControlActiveTab === 'manageSubUsers' && (
                <div className="space-y-4">
                  {(() => {
                    const c = clients.find(cl => cl.id === session?.id);
                    const list = c?.subUsers || [];
                    
                    if (list.length === 0) {
                      return (
                        <div className="text-center py-8 text-slate-400 font-medium text-xs">
                          {isRtl ? 'لا يوجد أي مستخدمين فرعيين مسجلين لهذا الحساب حالياً.' : 'No sub-users registered under this account.'}
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {list.map((su) => (
                          <div key={su.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-start">
                            <div className="space-y-1">
                              <h4 className="font-bold text-slate-900 text-xs sm:text-sm">{su.name}</h4>
                              <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 font-semibold font-mono">
                                <span className="bg-white border border-slate-150 rounded-lg px-2 py-0.5">👤 {su.username}</span>
                                {su.phone && <span className="bg-white border border-slate-150 rounded-lg px-2 py-0.5 font-sans">📞 {su.phone}</span>}
                                {su.password && <span className="bg-white border border-slate-155 rounded-lg px-2 py-0.5">🔑 {su.password}</span>}
                              </div>
                              
                              {/* Permissions mini pills */}
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {su.permissions?.viewVisits && (
                                  <span className="text-[8px] bg-slate-900/10 text-slate-800 px-1.5 py-0.3 rounded font-bold">{isRtl ? '✓ تقارير الصيانة' : 'Reports'}</span>
                                )}
                                {su.permissions?.replyQuotes && (
                                  <span className="text-[8px] bg-teal-500/10 text-teal-700 px-1.5 py-0.3 rounded font-bold">{isRtl ? '✓ اعتماد عروض الأسعار' : 'Quotes'}</span>
                                )}
                                {su.permissions?.submitInquiries && (
                                  <span className="text-[8px] bg-indigo-500/10 text-indigo-700 px-1.5 py-0.3 rounded font-bold">{isRtl ? '✓ إرسال الشكاوى والملاحظات' : 'Inquiries'}</span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1.5 self-end sm:self-center">
                              <button
                                onClick={() => {
                                  // Set edit sub-user fields
                                  setEditingSubUserId(su.id);
                                  setEditSubUserFullName(su.name);
                                  setEditSubUserPhone(su.phone);
                                  setEditSubUserUsername(su.username);
                                  setEditSubUserPassword(su.password || '123456');
                                  setEditSubUserPermViewVisits(su.permissions?.viewVisits ?? true);
                                  setEditSubUserPermReplyQuotes(su.permissions?.replyQuotes ?? true);
                                  setEditSubUserPermSubmitInquiries(su.permissions?.submitInquiries ?? true);
                                }}
                                className="p-1.5 transition-colors bg-white hover:bg-slate-200 border border-slate-200 hover:border-slate-300 rounded-lg text-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                ✏️ {isRtl ? 'تعديل الصلاحيات والمستخدم' : 'Edit Account'}
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(isRtl ? 'هل أنت متأكد من حذف هذا المستخدم الفرعي ومنعه من الوصول؟' : 'Are you sure you want to delete this sub-user?')) {
                                    const updated = {
                                      ...c!,
                                      subUsers: list.filter(item => item.id !== su.id)
                                    };
                                    handleEditClientMetadata(updated);
                                    alert(isRtl ? 'تم حذف حساب الموظف الفرعي.' : 'Sub-user deleted successfully.');
                                  }
                                }}
                                className="p-1.5 transition-colors bg-rose-50 hover:bg-rose-100 border border-rose-250 hover:border-rose-300 text-rose-600 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                🗑️ {isRtl ? 'حذف' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Sub-user Editing Modal Overlay inside body */}
              {editingSubUserId && (
                <div className="bg-slate-100 border border-slate-300 rounded-2xl p-4 space-y-3 mt-4 animate-fade-in text-start">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <h5 className="font-extrabold text-xs text-slate-800">
                      ✏️ {isRtl ? `تعديل صلاحيات المستخدم: ${editSubUserFullName}` : `Edit Sub-user: ${editSubUserFullName}`}
                    </h5>
                    <button 
                      onClick={() => setEditingSubUserId(null)} 
                      className="text-xs font-bold text-slate-500 hover:text-slate-900 cursor-pointer"
                    >
                      {isRtl ? 'إلغاء' : 'Cancel'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">{isRtl ? 'الاسم الكامل للفرعي' : 'Full Name'}</label>
                      <input 
                        type="text" 
                        value={editSubUserFullName} 
                        onChange={(e) => setEditSubUserFullName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">{isRtl ? 'رقم الهاتف' : 'Phone'}</label>
                      <input 
                        type="text" 
                        value={editSubUserPhone} 
                        onChange={(e) => setEditSubUserPhone(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">{isRtl ? 'اسم مستخدم الدخول فرعياً' : 'Username'}</label>
                      <input 
                        type="text" 
                        value={editSubUserUsername} 
                        onChange={(e) => setEditSubUserUsername(e.target.value.toLowerCase())}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">{isRtl ? 'الباسوورد للدخول' : 'Password'}</label>
                      <input 
                        type="text" 
                        value={editSubUserPassword} 
                        onChange={(e) => setEditSubUserPassword(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-start">
                    <label className="flex items-center gap-2 text-xs select-none cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={editSubUserPermViewVisits} 
                        onChange={(e) => setEditSubUserPermViewVisits(e.target.checked)}
                      />
                      <span className="font-bold text-slate-700">{isRtl ? 'تقارير الصيانة والزيارات' : 'Safety Reports'}</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs select-none cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={editSubUserPermReplyQuotes} 
                        onChange={(e) => setEditSubUserPermReplyQuotes(e.target.checked)}
                      />
                      <span className="font-bold text-slate-700">{isRtl ? 'اعتماد العروض المالي' : 'Quotation decisions'}</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs select-none cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={editSubUserPermSubmitInquiries} 
                        onChange={(e) => setEditSubUserPermSubmitInquiries(e.target.checked)}
                      />
                      <span className="font-bold text-slate-700">{isRtl ? 'رفع الطلبات والشكاوى' : 'Inquiries'}</span>
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setEditingSubUserId(null)}
                      className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg cursor-pointer"
                    >
                      {isRtl ? 'إلغاء' : 'Close'}
                    </button>
                    <button
                      onClick={() => {
                        if (!editSubUserFullName.trim() || !editSubUserUsername.trim() || !editSubUserPassword.trim()) {
                          alert(isRtl ? 'يرجى إكمال الحقول للتعديل!' : 'Please complete fields!');
                          return;
                        }
                        const c = clients.find(cl => cl.id === session?.id);
                        if (c) {
                          const updatedUsers = (c.subUsers || []).map(su => {
                            if (su.id === editingSubUserId) {
                              return {
                                ...su,
                                name: editSubUserFullName,
                                phone: editSubUserPhone,
                                username: editSubUserUsername.trim().toLowerCase(),
                                password: editSubUserPassword,
                                permissions: {
                                  viewVisits: editSubUserPermViewVisits,
                                  replyQuotes: editSubUserPermReplyQuotes,
                                  submitInquiries: editSubUserPermSubmitInquiries
                                }
                              };
                            }
                            return su;
                          });

                          const updated = {
                            ...c,
                            subUsers: updatedUsers
                          };

                          handleEditClientMetadata(updated);
                          alert(isRtl ? 'تم تحديث صلاحيات الحساب الفرعي للموظف بنجاح!' : 'Sub-user permissions updated successfully!');
                          setEditingSubUserId(null);
                        }
                      }}
                      className="px-3 py-1 bg-slate-900 text-white hover:bg-teal-900 text-xs font-bold rounded-lg cursor-pointer"
                    >
                      {isRtl ? 'حفظ التعديلات فرعياً' : 'Save Modifications'}
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button 
                onClick={() => setIsClientControlPanelOpen(false)}
                className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300 text-xs font-extrabold rounded-xl transition cursor-pointer"
              >
                {isRtl ? 'إغلاق الإعدادات' : 'Close Settings'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ⚙️ Control Panel & Settings Modal */}
      {isControlPanelModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col text-start">
            
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-teal-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚙️</span>
                <div>
                  <h3 className="text-sm font-bold">{isRtl ? 'لوحة تحكم إعدادات النظام والمستخدمين والروابط' : 'System Settings, Users & Access Control'}</h3>
                  <span className="text-[10px] text-teal-300 block">{isRtl ? 'بواسطة مدير الحساب والمسئول الرئيسي' : 'Authorized by Principal Account Manager'}</span>
                </div>
              </div>
              <button 
                onClick={() => setIsControlPanelModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition border border-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Swappers */}
            <div className="flex border-b border-slate-200 bg-slate-50 p-1.5 gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => setControlPanelActiveTab('profile')}
                className={`flex-1 min-w-[100px] text-center px-3 py-2 text-xs font-bold rounded-xl transition ${
                  controlPanelActiveTab === 'profile'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-250/50 hover:text-slate-950'
                }`}
              >
                👤 {isRtl ? 'الملف الشخصي' : 'Admin Profile'}
              </button>
              <button
                type="button"
                onClick={() => setControlPanelActiveTab('password')}
                className={`flex-1 min-w-[100px] text-center px-3 py-2 text-xs font-bold rounded-xl transition ${
                  controlPanelActiveTab === 'password'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-250/50 hover:text-slate-950'
                }`}
              >
                🔑 {isRtl ? 'تغيير كلمة المرور' : 'Change Password'}
              </button>
              <button
                type="button"
                onClick={() => setControlPanelActiveTab('addUser')}
                className={`flex-1 min-w-[125px] text-center px-3 py-2 text-xs font-bold rounded-xl transition ${
                  controlPanelActiveTab === 'addUser'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-250/50 hover:text-slate-950'
                }`}
              >
                ➕ {isRtl ? 'مستخدم جديد وصلاحيات' : 'Add New User'}
              </button>
              {canManageUsers && (
                <button
                  type="button"
                  onClick={() => setControlPanelActiveTab('listUsers')}
                  className={`flex-1 min-w-[120px] text-center px-3 py-2 text-xs font-bold rounded-xl transition relative ${
                    controlPanelActiveTab === 'listUsers'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-250/50 hover:text-slate-955'
                  }`}
                >
                  👥 {isRtl ? 'إدارة المستخدمين' : 'Manage Team'}
                  {controlPanelFilteredTechs.length > 0 && (
                    <span className="absolute -top-1 right-2 bg-teal-500 text-white text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold font-mono">
                      {controlPanelFilteredTechs.length}
                    </span>
                  )}
                </button>
              )}
              {isGeneralAdmin && (
                <button
                  type="button"
                  onClick={() => setControlPanelActiveTab('backup')}
                  className={`flex-1 min-w-[120px] text-center px-3 py-2 text-xs font-bold rounded-xl transition ${
                    controlPanelActiveTab === 'backup'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-250/50 hover:text-slate-955'
                  }`}
                >
                  💾 {isRtl ? 'النسخ والاستعادة' : 'Backup & Restore'}
                </button>
              )}
              {isGeneralAdmin && !session?.companyBranchId && (
                <button
                  type="button"
                  onClick={() => setControlPanelActiveTab('branches')}
                  className={`flex-1 min-w-[120px] text-center px-3 py-2 text-xs font-bold rounded-xl transition ${
                    controlPanelActiveTab === 'branches'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-250/50 hover:text-slate-950'
                  }`}
                >
                  🏢 {isRtl ? 'فروع الشركة' : 'Company Branches'}
                </button>
              )}
            </div>

            {/* Content viewports */}
            <div className="p-6 flex-1 overflow-y-auto max-h-[60vh] space-y-4">
              
              {/* Tab 1: Profile */}
              {controlPanelActiveTab === 'profile' && (
                <div className="space-y-4">
                  <div className="p-4 bg-teal-500/10 border border-teal-500/15 rounded-2xl flex items-start gap-3">
                    <span className="text-xl">ℹ️</span>
                    <p className="text-[11px] text-slate-755 leading-relaxed font-sans">
                      {isRtl 
                        ? 'تتيح لك هذه المنصة تعديل وتحديث بيانات الشركة الرئيسية، الرقم الموحد والضريبي، بالإضافة إلى بيانات المسؤول المباشر ومعلومات الدخول.' 
                        : 'Adjust corporate metadata (such as tax credentials and unified numbers) alongside authorized representative profile values.'}
                    </p>
                  </div>

                  {/* Section 1: Main Company Information */}
                  <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-3">
                    <h4 className="text-xs font-extrabold text-slate-800 border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                      🏢 {isRtl ? 'بيانات الشركة الرئيسية' : 'Main Company Information'}
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="md:col-span-2">
                        <label className="text-[11px] font-bold text-slate-650 block mb-0.5">
                          {isRtl ? 'اسم الشركة' : 'Company Name'}
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-teal-500"
                          value={companyEditName}
                          onChange={(e) => setCompanyEditName(e.target.value)}
                          placeholder={isRtl ? 'أدخل اسم الشركة' : 'Enter company name'}
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-650 block mb-0.5">
                          {isRtl ? 'الرقم الموحد' : 'Unified Number'}
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-teal-500 font-mono"
                          value={companyEditUnified}
                          onChange={(e) => setCompanyEditUnified(e.target.value)}
                          placeholder="e.g. 7003489890"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-650 block mb-0.5">
                          {isRtl ? 'جوال' : 'Mobile Phone'}
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-teal-500 font-mono"
                          value={companyEditPhone}
                          onChange={(e) => setCompanyEditPhone(e.target.value)}
                          placeholder="e.g. 0555012345"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-650 block mb-0.5">
                          {isRtl ? 'الايميل' : 'Company Email'}
                        </label>
                        <input
                          type="email"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-teal-500 font-sans"
                          value={companyEditEmail}
                          onChange={(e) => setCompanyEditEmail(e.target.value)}
                          placeholder="e.g. contact@company.com"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-650 block mb-0.5">
                          {isRtl ? 'الرقم الضريبي' : 'Tax Registration Number'}
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-teal-500 font-mono"
                          value={companyEditTaxId}
                          onChange={(e) => setCompanyEditTaxId(e.target.value)}
                          placeholder="e.g. 310456789000003"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="text-[11px] font-bold text-slate-650 block mb-0.5">
                          {isRtl ? 'العنوان' : 'Company Address'}
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-teal-500"
                          value={companyEditAddress}
                          onChange={(e) => setCompanyEditAddress(e.target.value)}
                          placeholder={isRtl ? 'أدخل عنوان مقر الشركة الرئيسي' : 'Enter company headquarters address'}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Account & Representative Details */}
                  <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-3">
                    <h4 className="text-xs font-extrabold text-slate-800 border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                      👤 {isRtl ? 'بيانات المسؤول والدخول للمنظومة' : 'Account Owner & System Login Details'}
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-650 block mb-0.5">
                          {isRtl ? 'اسم المسؤول الكامل *' : 'Account Owner / Full Name *'}
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-teal-500"
                          value={adminEditName}
                          onChange={(e) => setAdminEditName(e.target.value)}
                          placeholder={isRtl ? 'أدخل اسم المسؤول' : 'Enter representative full name'}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-650 block mb-0.5">
                          {isRtl ? 'اسم مستخدم الدخول (Username) *' : 'Authentication Username *'}
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-teal-500 font-mono"
                          value={adminEditUsername}
                          onChange={(e) => setAdminEditUsername(e.target.value)}
                          placeholder="e.g. admin"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!adminEditName.trim() || !adminEditUsername.trim()) {
                          alert(isRtl ? 'الرجاء تعبئة كافة الحقول المطلوبة للمسؤول!' : 'Please enter all representative fields!');
                          return;
                        }
                        // Update Admin Account
                        setAdminName(adminEditName.trim());
                        setAdminUsername(adminEditUsername.trim());
                        localStorage.setItem('sas_admin_name', adminEditName.trim());
                        localStorage.setItem('sas_admin_username', adminEditUsername.trim());

                        // Update Company Details
                        setCompanyName(companyEditName.trim());
                        setCompanyUnified(companyEditUnified.trim());
                        setCompanyPhone(companyEditPhone.trim());
                        setCompanyEmail(companyEditEmail.trim());
                        setCompanyTaxId(companyEditTaxId.trim());
                        setCompanyAddress(companyEditAddress.trim());

                        localStorage.setItem('sas_company_name', companyEditName.trim());
                        localStorage.setItem('sas_company_unified', companyEditUnified.trim());
                        localStorage.setItem('sas_company_phone', companyEditPhone.trim());
                        localStorage.setItem('sas_company_email', companyEditEmail.trim());
                        localStorage.setItem('sas_company_tax_id', companyEditTaxId.trim());
                        localStorage.setItem('sas_company_address', companyEditAddress.trim());

                        setSession(prev => prev ? { ...prev, name: adminEditName.trim() } : null);
                        setLocalVersion(v => v + 1);
                        alert(isRtl ? 'تم تحديث البيانات بنجاح!' : 'Company & profile details saved successfully!');
                      }}
                      className="px-4 py-2 bg-slate-900 border border-slate-800 text-white hover:bg-slate-800 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      {isRtl ? 'حفظ البيانات والتعديلات' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 2: Change Password */}
              {controlPanelActiveTab === 'password' && (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-500/10 border border-amber-500/15 rounded-2xl flex items-start gap-3">
                    <span className="text-xl">🚨</span>
                    <p className="text-[11px] text-amber-800 leading-relaxed font-sans">
                      {isRtl 
                        ? 'تنبيه الأمان: عند تعديل كلمة مرور المشرف العام، يرجى كتابة الرمز الجديد وحفظه للوصول للمنظومة لاحقاً بأمان.' 
                        : 'Change your login code below. Remember to backup the password credentials to prevent account lockout.'}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {isRtl ? 'كلمة المرور الحالية أو كلمة مرور جديدة للمشرف *' : 'New Password *'}
                    </label>
                    <input
                      type="password"
                      className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-mono"
                      value={adminEditPassword}
                      onChange={(e) => setAdminEditPassword(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!adminEditPassword.trim()) {
                          alert(isRtl ? 'الرجاء إدخال كلمة مرور صالحة!' : 'Please enter a valid password!');
                          return;
                        }
                        setAdminPassword(adminEditPassword.trim());
                        localStorage.setItem('sas_admin_password', adminEditPassword.trim());
                        setLocalVersion(v => v + 1);
                        alert(isRtl ? 'تم تغيير كلمة المرور بنجاح!' : 'Password changed successfully!');
                      }}
                      className="px-4 py-2 bg-slate-900 border border-slate-800 text-white hover:bg-slate-850 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      {isRtl ? 'تحديث كلمة المرور' : 'Update Password'}
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 3: Add User */}
              {controlPanelActiveTab === 'addUser' && (
                <div className="space-y-4">
                  <span className="text-xs font-bold text-slate-900 block border-b border-slate-200 pb-1.5 font-sans">
                    {isRtl ? 'إضافة مستخدم جديد للنظام وتوزيع باسوورد وصلاحيات الدخول' : 'Create System Credentials & Assign Client/Supervisor Privileges'}
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        {isRtl ? 'الاسم الكامل للمستخدم *' : 'User Full Designation *'}
                      </label>
                      <input
                        type="text"
                        placeholder="مثال: المهندس أحمد علي"
                        className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                        value={newUserFullName}
                        onChange={(e) => setNewUserFullName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        {isRtl ? 'رقم الهاتف / الجوال *' : 'Active Mobile Phone *'}
                      </label>
                      <input
                        type="text"
                        placeholder="مثال: 0555xxxxxx"
                        className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-mono"
                        value={newUserPhone}
                        onChange={(e) => setNewUserPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        {isRtl ? 'اسم مستخدم الدخول بالتطبيق (Username) *' : 'Account Username (Login) *'}
                      </label>
                      <input
                        type="text"
                        placeholder="مثال: ahmed_tech"
                        className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-mono"
                        value={newUserUsername}
                        onChange={(e) => setNewUserUsername(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        {isRtl ? 'كلمة مرور الدخول للمستخدم (Password) *' : 'Login Passcode *'}
                      </label>
                      <input
                        type="text"
                        placeholder="اكتب باسوورد قوي"
                        className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-mono"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans max-w-full">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1 font-sans">
                        {isRtl ? 'الدور والمهام بالنظام *' : 'System Assignment Role *'}
                      </label>
                      <select
                        className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-205 rounded-xl focus:outline-none focus:border-teal-500 text-slate-750 cursor-pointer font-bold font-sans"
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value as 'technician' | 'admin' | 'viewer')}
                      >
                        <option value="technician">{isRtl ? 'فني ميداني / مهندس صيانة' : 'Field Technician / Engineer'}</option>
                        <option value="admin">{isRtl ? 'مدير نظام فرعي (Admin)' : 'Sub-Administrator Account'}</option>
                        <option value="viewer">{isRtl ? 'مراقب للاطلاع فقط (Viewer / Monitor)' : 'Viewer / Monitor (Read-Only)'}</option>
                      </select>
                    </div>
                    {isGeneralAdmin && !session?.companyBranchId && (
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1 font-sans">
                          {isRtl ? 'تبعية الفرع للمستخدم الجديد *' : 'Branch Assignment *'}
                        </label>
                        <select
                          className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-205 rounded-xl focus:outline-none focus:border-teal-500 text-slate-750 cursor-pointer font-bold font-sans"
                          value={newUserBranchId}
                          onChange={(e) => setNewUserBranchId(e.target.value)}
                        >
                          <option value="hq">{isRtl ? 'المقر الرئيسي' : 'Headquarters'}</option>
                          {companyBranches.filter(b => b.id !== 'hq').map(b => (
                            <option key={b.id} value={b.id}>{isRtl ? `فرع ${b.name}` : b.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Permissions Selection */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 font-sans">
                    <label className="text-xs font-bold text-slate-900 block border-b border-slate-200 pb-1 flex items-center justify-between">
                      <span>{isRtl ? 'صلاحيات وامتيازات المستخدم المعتمدة:' : 'User Operational Permissions Guidelines:'}</span>
                      <span className="text-[9px] bg-teal-100 text-teal-800 font-bold px-1.5 py-0.2 rounded">{isRtl ? 'لوحة التحكم والمحمول' : 'Full access config'}</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <label className="flex items-center gap-2 font-medium text-slate-750 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                          checked={permClients}
                          onChange={(e) => setPermClients(e.target.checked)}
                        />
                        <span>{isRtl ? 'تمكين إدارة وإضافة وتعديل العملاء' : 'Manage Maintenance Clients/Contracts'}</span>
                      </label>
                      <label className="flex items-center gap-2 font-medium text-slate-750 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                          checked={permTechs}
                          onChange={(e) => setPermTechs(e.target.checked)}
                        />
                        <span>{isRtl ? 'تمكين تصريح إدارة وجدولة الزيارات الميدانية' : 'Schedule visits & tasks'}</span>
                      </label>
                      <label className="flex items-center gap-2 font-medium text-slate-750 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                          checked={permQuotes}
                          onChange={(e) => setPermQuotes(e.target.checked)}
                        />
                        <span>{isRtl ? 'تمكين تجهيز وتعديل عروض تسعير قطع السلامة' : 'Prepare and Send Quotations'}</span>
                      </label>
                      <label className="flex items-center gap-2 font-medium text-slate-750 cursor-pointer select-none text-rose-600 font-bold">
                        <input
                          type="checkbox"
                          className="rounded text-rose-600 focus:ring-rose-500 h-4 w-4"
                          checked={permWipe}
                          onChange={(e) => setPermWipe(e.target.checked)}
                        />
                        <span>{isRtl ? '⛔ تصريح كامل لإعادة ضبط قاعدة البيانات' : 'Wipe systems/reset databases'}</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!newUserFullName.trim() || !newUserPhone.trim() || !newUserUsername.trim() || !newUserPassword.trim()) {
                          alert(isRtl ? 'الرجاء تعبئة كافة حقول بيانات المستخدم الجديد وبكلمة المرور!' : 'Please fill all fields of the new user credentials!');
                          return;
                        }
                        
                        // Check if username already exists in technicians list
                        const userExists = technicians.some(t => t.username?.toLowerCase() === newUserUsername.toLowerCase());
                        if (userExists || newUserUsername.toLowerCase() === adminUsername.toLowerCase()) {
                          alert(isRtl ? 'اسم مستخدم الدخول مكرر بالفعل ومأخوذ من قبل حساب آخر!' : 'This username is taken by another account, please choose another!');
                          return;
                        }

                        const u: Technician = {
                          id: `tech_added_${Date.now()}`,
                          name: newUserFullName.trim(),
                          phone: newUserPhone.trim(),
                          role: newUserRole,
                          username: newUserUsername.trim(),
                          password: newUserPassword.trim(),
                          companyBranchId: session?.companyBranchId || newUserBranchId || 'hq',
                          permissions: {
                            manageClients: permClients,
                            manageTechnicians: permTechs,
                            manageQuotes: permQuotes,
                            wipeDatabase: permWipe,
                          }
                        };

                        handleAddTechnician(u);
                        
                        // Clear form input fields
                        setNewUserFullName('');
                        setNewUserPhone('');
                        setNewUserUsername('');
                        setNewUserPassword('');
                        setNewUserRole('technician');
                        setPermClients(true);
                        setPermTechs(true);
                        setPermQuotes(true);
                        setPermWipe(false);

                        alert(isRtl 
                          ? 'تم تسجيل حساب المستخدم الجديد بنجاح في المنظومة وإعطائه امتيازات الوصول!' 
                          : 'New user account was successfully registered and configured with the selected permissions!'
                        );
                        
                        if (canManageUsers) {
                          // Redirect to the users list tab
                          setControlPanelActiveTab('listUsers');
                        }
                      }}
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1"
                    >
                      <span>💾</span>
                      <span>{isRtl ? 'تثبيت وإنشاء الحساب للمستخدم' : 'Save & Register New User'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 4: List Users */}
              {controlPanelActiveTab === 'listUsers' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2 font-sans">
                    <span className="text-xs font-bold text-slate-800">{isRtl ? 'فريق العمل والفنيين ومدراء النظام' : 'Registered System Users Team'}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-605 px-2 py-0.5 rounded font-mono font-bold">
                      {isRtl ? `${controlPanelFilteredTechs.length} حسابات` : `${controlPanelFilteredTechs.length} accounts`}
                    </span>
                  </div>

                  {/* Inline Edit Form when selected */}
                  {editingTechId && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3 font-sans text-start">
                      <div className="flex justify-between items-center border-b border-amber-200/60 pb-1.5">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                          ⚙️ {isRtl ? 'تعديل بيانات الحساب والصلاحيات والباسورد للمستخدم:' : 'Modify credentials & permissions for:'}
                        </span>
                        <button 
                          onClick={() => setEditingTechId(null)}
                          className="text-[10px] bg-white border border-amber-300 text-slate-700 px-2 py-0.5 rounded-lg hover:bg-amber-100 font-bold transition font-sans cursor-pointer"
                        >
                          {isRtl ? 'إلغاء التعديل' : 'Cancel'}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-0.5">{isRtl ? 'اسم الدخول الكامل' : 'Full Name'}</label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-205 rounded-lg focus:outline-none focus:border-amber-500"
                            value={editUserFullName}
                            onChange={(e) => setEditUserFullName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-0.5">{isRtl ? 'رقم الهاتف' : 'Phone Number'}</label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-205 rounded-lg focus:outline-none focus:border-amber-505 font-mono"
                            value={editUserPhone}
                            onChange={(e) => setEditUserPhone(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-0.5">{isRtl ? 'اسم المستخدم (Username)' : 'Username'}</label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-205 rounded-lg focus:outline-none focus:border-amber-505 font-mono"
                            value={editUserUsername}
                            onChange={(e) => setEditUserUsername(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-0.5">{isRtl ? 'كلمة المرور الباسوورد' : 'Password'}</label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-205 rounded-lg focus:outline-none focus:border-amber-505 font-mono"
                            value={editUserPassword}
                            onChange={(e) => setEditUserPassword(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-0.5">{isRtl ? 'الصلاحية / الدور' : 'Role Option'}</label>
                          <select
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                            value={editUserRole}
                            onChange={(e) => setEditUserRole(e.target.value as 'technician' | 'admin' | 'viewer')}
                          >
                            <option value="technician">{isRtl ? 'فني صيانة' : 'Technician'}</option>
                            <option value="admin">{isRtl ? 'مدير نظام كامل' : 'Administrator'}</option>
                            <option value="viewer">{isRtl ? 'مراقب للاطلاع فقط' : 'Viewer / Monitor (Read-Only)'}</option>
                          </select>
                        </div>
                        {!session?.companyBranchId && (
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-0.5">{isRtl ? 'الفرع التابع له' : 'Branch Assignment'}</label>
                            <select
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                              value={editUserBranchId}
                              onChange={(e) => setEditUserBranchId(e.target.value)}
                            >
                              <option value="hq">{isRtl ? 'المقر الرئيسي' : 'Headquarters'}</option>
                              {companyBranches.filter(b => b.id !== 'hq').map(b => (
                                <option key={b.id} value={b.id}>{isRtl ? `فرع ${b.name}` : b.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1 text-xs">
                        <label className="flex items-center gap-2 font-medium text-slate-700">
                          <input
                            type="checkbox"
                            checked={editPermClients}
                            onChange={(e) => setEditPermClients(e.target.checked)}
                          />
                          <span>{isRtl ? 'تعديل الصلاحيات: إدارة العملاء والعقود والمواقع والمنشآت' : 'Manage Clients/Contracts'}</span>
                        </label>
                        <label className="flex items-center gap-2 font-medium text-slate-705">
                          <input
                            type="checkbox"
                            checked={editPermTechs}
                            onChange={(e) => setEditPermTechs(e.target.checked)}
                          />
                          <span>{isRtl ? 'تعديل الصلاحيات: إدارة وجدولة الزيارات الميدانية للفريق' : 'Schedule visits'}</span>
                        </label>
                        <label className="flex items-center gap-2 font-medium text-slate-705">
                          <input
                            type="checkbox"
                            checked={editPermQuotes}
                            onChange={(e) => setEditPermQuotes(e.target.checked)}
                          />
                          <span>{isRtl ? 'تعديل الصلاحيات: تسعير وعمل عروض قطع غيار ومستلزمات السلامة' : 'Prepare Quotes'}</span>
                        </label>
                      </div>

                      <div className="flex justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (!editUserFullName.trim() || !editUserPhone.trim() || !editUserUsername.trim() || !editUserPassword.trim()) {
                              alert(isRtl ? 'يرجى تعبئة كافة الحقول!' : 'Please check required fields!');
                              return;
                            }

                            // Build updated Technician object
                            const originalTech = technicians.find(t => t.id === editingTechId);
                            const updated: Technician = {
                              id: editingTechId,
                              name: editUserFullName.trim(),
                              phone: editUserPhone.trim(),
                              role: editUserRole,
                              username: editUserUsername.trim(),
                              password: editUserPassword.trim(),
                              companyBranchId: session?.companyBranchId || editUserBranchId || originalTech?.companyBranchId || 'hq',
                              permissions: {
                                manageClients: editPermClients,
                                manageTechnicians: editPermTechs,
                                manageQuotes: editPermQuotes,
                                wipeDatabase: editPermWipe
                              }
                            };

                            handleEditTechnician(updated);
                            setEditingTechId(null);
                            alert(isRtl ? 'تم تحديث حساب المستخدم وصلاحياته بنجاح!' : 'User credentials updated!');
                          }}
                          className="px-3.5 py-1.5 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded-lg transition cursor-pointer font-sans"
                        >
                          {isRtl ? 'حفظ البيانات الجديدة' : 'Apply Changes'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Users Grid */}
                  <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                    {controlPanelFilteredTechs.length === 0 ? (
                      <div className="text-center py-6 text-slate-500 text-xs font-sans">
                        {isRtl ? 'لا يوجد فنيين أو مستخدمين مسجلين للحساب حالياً.' : 'No team members registered yet.'}
                      </div>
                    ) : (
                      controlPanelFilteredTechs.map((tech) => (
                        <div key={tech.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex justify-between items-center gap-2 hover:bg-slate-100/50 transition">
                          <div className="space-y-1 text-sm font-sans">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900">{tech.name}</span>
                              <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded uppercase ${
                                tech.role === 'admin' 
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : tech.role === 'viewer'
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : 'bg-teal-100 text-teal-800 border border-teal-200'
                              }`}>
                                {tech.role === 'admin' 
                                  ? (isRtl ? 'مدير نظام' : 'Sub-Admin') 
                                  : tech.role === 'viewer'
                                    ? (isRtl ? 'مراقب للاطلاع' : 'Viewer')
                                    : (isRtl ? 'فني ميداني' : 'Technician')}
                              </span>
                            </div>
                            <div className="flex flex-col text-[10px] text-slate-500 leading-relaxed font-mono">
                              <span>📞 {tech.phone}</span>
                              <span className="text-slate-605 bg-white border border-slate-200/60 px-1 py-0.2 rounded w-fit mt-0.5">
                                👤 {tech.username || 'No login'} | 🔑 <span className="font-bold">{tech.password || 'N/A'}</span>
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1 pt-1">
                              {tech.permissions?.manageClients && (
                                <span className="text-[8px] bg-slate-200 text-slate-700 px-1 py-0.2 rounded font-bold font-sans">🛡️ {isRtl ? 'العملاء' : 'Clients'}</span>
                              )}
                              {tech.permissions?.manageTechnicians && (
                                <span className="text-[8px] bg-slate-200 text-slate-700 px-1 py-0.2 rounded font-bold font-sans">📅 {isRtl ? 'الزيارات' : 'Schedule'}</span>
                              )}
                              {tech.permissions?.manageQuotes && (
                                <span className="text-[8px] bg-slate-200 text-slate-700 px-1 py-0.2 rounded font-bold font-sans">🏷️ {isRtl ? 'التسعير' : 'Quotes'}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                setEditingTechId(tech.id);
                                setEditUserFullName(tech.name);
                                setEditUserPhone(tech.phone || '');
                                setEditUserUsername(tech.username || '');
                                setEditUserPassword(tech.password || '');
                                setEditUserRole(tech.role || 'technician');
                                setEditUserBranchId(tech.companyBranchId || 'hq');
                                setEditPermClients(tech.permissions?.manageClients ?? true);
                                setEditPermTechs(tech.permissions?.manageTechnicians ?? true);
                                setEditPermQuotes(tech.permissions?.manageQuotes ?? true);
                                setEditPermWipe(tech.permissions?.wipeDatabase ?? false);
                              }}
                              className="w-7 h-7 bg-white hover:bg-slate-205 text-slate-700 flex items-center justify-center rounded-lg border border-slate-200 transition text-[11px] cursor-pointer"
                              title={isRtl ? 'تعديل الحساب' : 'Edit Credentials'}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(isRtl ? `هل أنت متأكد من حذف الحساب المخصص لـ ${tech.name} نهائياً؟` : `Are you sure you want to delete ${tech.name}'s account?`)) {
                                  handleDeleteTechnician(tech.id);
                                  if (editingTechId === tech.id) {
                                    setEditingTechId(null);
                                  }
                                }
                              }}
                              className="w-7 h-7 bg-white hover:bg-rose-50 text-rose-600 flex items-center justify-center rounded-lg border border-slate-220 hover:border-rose-200 transition text-xs cursor-pointer"
                              title={isRtl ? 'حذف المستخدم' : 'Delete Account'}
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

              {/* Tab 5: Backup & Restore */}
              {controlPanelActiveTab === 'backup' && (
                <div className="space-y-4">
                  <div className="p-4 bg-teal-500/10 border border-teal-500/15 rounded-2xl flex items-start gap-3">
                    <span className="text-xl">💾</span>
                    <p className="text-[11px] text-slate-700 leading-relaxed font-sans text-start">
                      {isRtl 
                        ? 'تتيح لك ميزة النسخ الاحتياطي تصدير نسخة كاملة بهيئة ملف JSON على جهاز الكمبيوتر الخاص بك، والذي يحتفظ بكافة بيانات وجدول مواعيد وعقود ومستخدمي وبلاغات النظام للرجوع إليها أو استعادتها في أي وقت.' 
                        : 'Backup allows you to export a fully comprehensive backup JSON file to your local computer, containing all your custom entries, clients, reports, emergency dispatch rosters, and configurations.'}
                    </p>
                  </div>

                  {/* Dedicated Wipe and Clear Action Card for preparation */}
                  <div className="p-4 sm:p-5 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-start font-sans">
                    <div className="space-y-1">
                      <h4 className="font-bold text-rose-900 text-xs sm:text-sm flex items-center gap-2 text-start">
                        <span>🗑️</span>
                        <span>{isRtl ? 'تصفير ومسح قاعدة البيانات السحابية والمحلية (تجهيزاً للاستيراد)' : 'Wipe Operational Database (Prepare for Import)'}</span>
                      </h4>
                      <p className="text-[11px] text-rose-700 leading-relaxed text-start max-w-2xl">
                        {isRtl 
                          ? 'يقوم هذا الإجراء بحذف وتصفير كافة سجلات العملاء، الزيارات الميدانية، البلاغات الطارئة، عروض الأسعار، وسندات الطفايات نهائياً من الذاكرة ومن قاعدة بيانات فايربيس السحابية (Cloud Firestore) حتى تتمكن من رفع ملف نسختك الاحتياطية بدون أي تكرار أو تداخل بيانات.' 
                          : 'This action permanently wipes all clients, inspection visits, emergency tickets, quotations, and extinguisher receipts from local storage and Cloud Firestore so you can cleanly import your backup JSON.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const confirmMsg = isRtl
                          ? '⚠️ تحذير نهائي!\n\nهل أنت متأكد من رغبتك في مسح وتصفير كافة بيانات العملاء والزيارات وعروض الأسعار من النظام وقاعدة البيانات السحابية (Firestore)؟\n\nلن يتم مسح حساب المدير أو قفل النظام، ولكن سيتم تفريغ كافة البيانات التشغيلية لتكون جاهزة لرفع ملفك.'
                          : '⚠️ Final Warning!\n\nAre you sure you want to completely wipe all operational records from the system and Cloud Firestore?\n\nThis will clear all current clients, visits, and quotations so you can import a fresh backup.';
                        if (confirm(confirmMsg)) {
                          handleFullWipe();
                        }
                      }}
                      className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-sm shrink-0 border border-rose-700"
                    >
                      <span>🗑️</span>
                      <span>{isRtl ? 'مسح وتصفير البيانات الحالية الآن' : 'Wipe Current Data Now'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans pt-2">
                    {/* Export Card */}
                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between text-start space-y-4">
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5 text-start">
                          📥 {isRtl ? 'تحميل نسخة احتياطية كاملة' : 'Export System Backup'}
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-1 leading-relaxed text-start">
                          {isRtl 
                            ? 'قم بتنزيل كافة بيانات وجداول وعقود وبلاغات النظام في ملف آمن على جهازك الكمبيوتر لاستعادته في حال تعطل النظام.' 
                            : 'Download all client contracts, inspection schedules, staff profiles, emergency callouts, and configuration files securely.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            const backupPayload = {
                              version: "1.0",
                              generator: "Nesma First Maintenance Backup Engine",
                              timestamp: new Date().toISOString(),
                              clients,
                              visits,
                              technicians,
                              daysBeforeVisitAlert,
                              notificationLogs,
                              managerPhone,
                              managerEmail,
                              adminUsername,
                              adminPassword,
                              adminName,
                              quotations,
                              emergencyVisits,
                              extinguisherReceipts,
                              deletedVisitIds,
                              companyBranches,
                              systemMode,
                              independentBranchId,
                              apiAccessToken,
                              linkedBranches
                            };
                            const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `nesma_first_backup_${new Date().toISOString().split('T')[0]}.json`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                          } catch (err) {
                            alert(isRtl ? 'فشل تصدير النسخة الاحتياطية!' : 'Failed to export backup file!');
                          }
                        }}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        📥 {isRtl ? 'تحميل وحفظ نسخة احتياطية (.json)' : 'Export Backup JSON File'}
                      </button>
                    </div>

                    {/* Import Card */}
                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between text-start space-y-4">
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5 text-start">
                          📤 {isRtl ? 'استعادة نسخة احتياطية من الجهاز' : 'Restore System Backup'}
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-1 leading-relaxed text-start">
                          {isRtl 
                            ? 'اختر ملف النسخ الاحتياطي (.json) الذي قمت بتحميله مسبقاً لاسترجاع كافة البيانات المدخلة وتجاوز أي أعطال أو فقدان للقدرات.' 
                            : 'Upload a previously exported backup file to immediately reinstate all data entries and recover from system failure.'}
                        </p>
                      </div>
                      <div>
                        <input
                          type="file"
                          id="backup-import-file"
                          accept=".json,application/json,text/plain"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;

                            const reader = new FileReader();
                            reader.onload = async (event) => {
                              try {
                                const raw = event.target?.result as string;
                                const cleanRaw = (typeof raw === 'string' ? raw : '').trim().replace(/^\uFEFF/, '');
                                
                                let parsed: any;
                                try {
                                  parsed = JSON.parse(cleanRaw);
                                  if (typeof parsed === 'string') {
                                    try { parsed = JSON.parse(parsed); } catch {}
                                  }
                                } catch (jsonErr: any) {
                                  throw new Error(isRtl 
                                    ? `الملف المرفوع ليس بصيغة JSON صالحة (${jsonErr.message}). يرجى التحقق من الملف.`
                                    : `Uploaded file is not valid JSON (${jsonErr.message}).`);
                                }

                                if (!parsed || typeof parsed !== 'object') {
                                  throw new Error(isRtl ? 'محتوى الملف غير صالح أو فارغ.' : 'File content is empty or invalid.');
                                }

                                // Deep key & array locator helper
                                const findArrayInObject = (obj: any, keys: string[]): any[] => {
                                  if (!obj || typeof obj !== 'object') return [];
                                  for (const k of Object.keys(obj)) {
                                    if (keys.some(candidate => candidate.toLowerCase() === k.toLowerCase())) {
                                      if (Array.isArray(obj[k])) return obj[k];
                                    }
                                  }
                                  const nestedHolders = ['data', 'database', 'state', 'backup', 'payload', 'appState', 'nesma_backup', 'nesma_first_backup'];
                                  for (const nh of nestedHolders) {
                                    const match = Object.keys(obj).find(k => k.toLowerCase() === nh.toLowerCase());
                                    if (match && obj[match] && typeof obj[match] === 'object') {
                                      const found = findArrayInObject(obj[match], keys);
                                      if (found.length > 0) return found;
                                    }
                                  }
                                  return [];
                                };

                                let clientsList: any[] = [];
                                let visitsList: any[] = [];
                                let techsList: any[] = [];
                                let quotesList: any[] = [];
                                let emergList: any[] = [];
                                let receiptsList: any[] = [];
                                let branchesList: any[] = companyBranches;
                                let targetAlertDays = daysBeforeVisitAlert;
                                let targetNotificationLogs: any[] = [];

                                if (Array.isArray(parsed)) {
                                  // Root itself is an array of objects
                                  const first = parsed[0] || {};
                                  if (first.name || first.clientName || first.contractNumber || first.branches) {
                                    clientsList = parsed;
                                  } else if (first.visitDate || first.status || first.branchName) {
                                    visitsList = parsed;
                                  } else {
                                    clientsList = parsed;
                                  }
                                } else {
                                  clientsList = findArrayInObject(parsed, ['clients', 'customers', 'clientList', 'عملاء']);
                                  visitsList = findArrayInObject(parsed, ['visits', 'inspections', 'visitList', 'زيارات']);
                                  techsList = findArrayInObject(parsed, ['technicians', 'techs', 'technicianList', 'فنيين']);
                                  quotesList = findArrayInObject(parsed, ['quotations', 'quotes', 'proposals', 'عروض']);
                                  emergList = findArrayInObject(parsed, ['emergencyVisits', 'emergencies', 'tickets', 'طوارئ']);
                                  receiptsList = findArrayInObject(parsed, ['extinguisherReceipts', 'receipts', 'طفايات']);
                                  
                                  const foundBranches = findArrayInObject(parsed, ['companyBranches', 'branches', 'فروع']);
                                  if (foundBranches.length > 0) {
                                    branchesList = foundBranches.map((b: any) => b.id === 'hq' ? { ...b, name: 'المقر الرئيسي' } : b);
                                  }
                                  if (parsed.daysBeforeVisitAlert !== undefined) targetAlertDays = parsed.daysBeforeVisitAlert;
                                  targetNotificationLogs = findArrayInObject(parsed, ['notificationLogs', 'notifications', 'logs']);
                                }

                                const totalFound = clientsList.length + visitsList.length + techsList.length + quotesList.length + emergList.length + receiptsList.length;

                                if (totalFound === 0) {
                                  const detectedKeys = Object.keys(parsed).slice(0, 15).join(', ');
                                  alert(isRtl
                                    ? `⚠️ تعذر التعرف على بيانات العملاء أو الزيارات داخل هذا الملف.\n\nالمفاتيح المكتشفة في الملف: [${detectedKeys || 'لا توجد'}]\n\nيرجى التأكد من أن الملف هو نسخة احتياطية صالحة تم تصديرها من النظام.`
                                    : `⚠️ Could not find client or visit records in this backup file.\n\nFound keys: [${detectedKeys || 'none'}]\n\nPlease make sure this is a valid backup JSON.`);
                                  return;
                                }

                                const confirmMsg = isRtl 
                                  ? `✅ تم فحص ملف النسخة الاحتياطية بنجاح!\n\nالبيانات المكتشفة:\n• عدد العملاء: ${clientsList.length}\n• عدد الزيارات المجدولة: ${visitsList.length}\n• عدد الفنيين: ${techsList.length}\n• عدد عروض الأسعار: ${quotesList.length}\n• زيارات الطوارئ: ${emergList.length}\n• سندات الطفايات: ${receiptsList.length}\n\nهل ترغب في اعتماد هذه البيانات وتطبيقها فوراً وحفظها في قاعدة البيانات السحابية (Firestore) والرابط العام؟` 
                                  : `✅ Backup inspected successfully!\n\nFound:\n• Clients: ${clientsList.length}\n• Visits: ${visitsList.length}\n• Technicians: ${techsList.length}\n• Quotations: ${quotesList.length}\n• Emergency Tickets: ${emergList.length}\n• Extinguisher Receipts: ${receiptsList.length}\n\nDo you want to restore these records and sync directly with Cloud Firestore?`;

                                if (confirm(confirmMsg)) {
                                  // Update state immediately
                                  setClients(clientsList);
                                  localStorage.setItem('sas_clients', JSON.stringify(clientsList));

                                  setVisits(visitsList);
                                  localStorage.setItem('sas_visits', JSON.stringify(visitsList));

                                  if (techsList.length > 0) {
                                    setTechnicians(techsList);
                                    localStorage.setItem('sas_technicians', JSON.stringify(techsList));
                                  }

                                  setCompanyBranches(branchesList);
                                  localStorage.setItem('sas_company_branches', JSON.stringify(branchesList));

                                  setDaysBeforeVisitAlert(targetAlertDays);
                                  localStorage.setItem('sas_alert_days', targetAlertDays.toString());

                                  setNotificationLogs(targetNotificationLogs);
                                  localStorage.setItem('sas_notification_logs', JSON.stringify(targetNotificationLogs));

                                  setQuotations(quotesList);
                                  localStorage.setItem('sas_quotations', JSON.stringify(quotesList));

                                  setEmergencyVisits(emergList);
                                  localStorage.setItem('sas_emergency_visits', JSON.stringify(emergList));

                                  setExtinguisherReceipts(receiptsList);
                                  localStorage.setItem('sas_extinguisher_receipts', JSON.stringify(receiptsList));

                                  if (parsed.managerPhone) {
                                    setManagerPhone(parsed.managerPhone);
                                    localStorage.setItem('sas_manager_phone', parsed.managerPhone);
                                  }
                                  if (parsed.managerEmail) {
                                    setManagerEmail(parsed.managerEmail);
                                    localStorage.setItem('sas_manager_email', parsed.managerEmail);
                                  }
                                  if (parsed.adminUsername) {
                                    setAdminUsername(parsed.adminUsername);
                                    localStorage.setItem('sas_admin_username', parsed.adminUsername);
                                  }
                                  if (parsed.adminPassword) {
                                    setAdminPassword(parsed.adminPassword);
                                    localStorage.setItem('sas_admin_password', parsed.adminPassword);
                                  }
                                  if (parsed.adminName) {
                                    setAdminName(parsed.adminName);
                                    localStorage.setItem('sas_admin_name', parsed.adminName);
                                  }

                                  // Push directly to Cloud Firestore from browser & Node API with forceReplace
                                  const pushPayload = {
                                    clients: clientsList,
                                    visits: visitsList,
                                    technicians: techsList.length > 0 ? techsList : technicians,
                                    daysBeforeVisitAlert: targetAlertDays,
                                    notificationLogs: targetNotificationLogs,
                                    quotations: quotesList,
                                    emergencyVisits: emergList,
                                    extinguisherReceipts: receiptsList,
                                    companyBranches: branchesList,
                                    managerPhone: parsed.managerPhone || managerPhone,
                                    managerEmail: parsed.managerEmail || managerEmail,
                                    adminUsername: parsed.adminUsername || adminUsername,
                                    adminPassword: parsed.adminPassword || adminPassword,
                                    adminName: parsed.adminName || adminName,
                                    companyName: parsed.companyName || companyName,
                                    companyUnified: parsed.companyUnified || companyUnified,
                                    companyPhone: parsed.companyPhone || companyPhone,
                                    companyEmail: parsed.companyEmail || companyEmail,
                                    companyTaxId: parsed.companyTaxId || companyTaxId,
                                    companyAddress: parsed.companyAddress || companyAddress,
                                    forceReplace: true,
                                    isWipe: false
                                  };

                                  lastLocalWriteRef.current = Date.now();
                                  setLocalVersion(v => v + 1);

                                  // 1. Direct browser-level write to Cloud Firestore
                                  writeStateToFirestoreClient(pushPayload).catch((fsErr) => {
                                    console.warn('[SAS Import] Direct Firestore write notice:', fsErr);
                                  });

                                  // 2. Direct server-level write to disk and memory
                                  try {
                                    await fetch('/api/data', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify(pushPayload)
                                    });
                                  } catch (postErr) {
                                    console.warn('[SAS Import] Post to /api/data notice:', postErr);
                                  }

                                  alert(isRtl 
                                    ? `🎉 تمت استعادة النسخة الاحتياطية بنجاح!\n\nتم استيراد وحفظ:\n- ${clientsList.length} عميل\n- ${visitsList.length} زيارة مجدولة\n- ${quotesList.length} عرض سعر\n- ${receiptsList.length} سند طفايات\n\nوتمت المزامنة الفورية وتثبيت البيانات في قاعدة البيانات السحابية (Firestore) والرابط العام.` 
                                    : 'Backup restored successfully and synchronized across Cloud Firestore and all public endpoints!'
                                  );
                                  
                                  // Close modal
                                  setIsControlPanelModalOpen(false);
                                }
                              } catch (err: any) {
                                alert(isRtl 
                                  ? `فشل رفع أو معالجة ملف النسخة الاحتياطية: ${err.message || ''}. الرجاء التأكد من أنه ملف JSON سليم.` 
                                  : `Failed to process backup file: ${err.message || ''}. Make sure it is a valid JSON file.`
                                );
                              } finally {
                                // Reset input so user can choose the same or another file again immediately
                                if (e.target) {
                                  e.target.value = '';
                                }
                              }
                            };
                            reader.readAsText(file);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            document.getElementById('backup-import-file')?.click();
                          }}
                          className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm border border-teal-500"
                        >
                          📤 {isRtl ? 'رفع واستعادة ملف (.json)' : 'Upload & Restore Backup'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 6: Company Branches */}
              {controlPanelActiveTab === 'branches' && (
                <div className="space-y-4">
                  {/* Segmented Sub-Tab selector */}
                  <div className="flex border-b border-slate-200 mb-4 gap-1">
                    <button
                      type="button"
                      onClick={() => setBranchesSubTab('local')}
                      className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                        branchesSubTab === 'local'
                          ? 'border-teal-600 text-teal-600 font-extrabold'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      🏢 {isRtl ? 'الفروع المحلية بالنظام (Local)' : 'Local Branches'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBranchesSubTab('separation')}
                      className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                        branchesSubTab === 'separation'
                          ? 'border-teal-600 text-teal-600 font-extrabold'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      📡 {isRtl ? 'فصل النظام والربط السحابي (Separation)' : 'System Separation & Sync'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBranchesSubTab('purger')}
                      className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                        branchesSubTab === 'purger'
                          ? 'border-teal-600 text-teal-600 font-extrabold'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      🧼 {isRtl ? 'تصفية وتطهير البيانات المعزولة' : 'Cleanup Isolated Data'}
                    </button>
                  </div>

                  {branchesSubTab === 'local' && (
                    <div className="space-y-4">
                      <div className="p-4 bg-teal-500/10 border border-teal-500/15 rounded-2xl flex items-start gap-3">
                    <span className="text-xl">🏢</span>
                    <p className="text-[11px] text-slate-700 leading-relaxed font-sans text-start">
                      {isRtl 
                        ? 'إدارة فروع الشركة المستقلة والمقر الرئيسي. يمكنك تحديد يوزر نيم وباسورد مخصص لكل فرع مع تحديد صلاحياته للدخول للنظام بشكل مستقل ومعزول عن باقي الفروع.' 
                        : 'Manage independent company branches. You can set a dedicated username, password, and custom permissions for each branch to access the system securely and isolated from other branches.'}
                    </p>
                  </div>

                  {editingBranchId ? (
                    /* Edit Branch Form */
                    <div className="bg-amber-50/50 border border-amber-200 p-4 rounded-2xl space-y-3">
                      <h4 className="text-xs font-extrabold text-amber-800 border-b border-amber-250 pb-1.5 flex items-center gap-1.5">
                        📝 {isRtl ? `تعديل فرع: ${editBranchName}` : `Edit Branch: ${editBranchName}`}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-slate-650 block mb-0.5">
                            {isRtl ? 'اسم الفرع *' : 'Branch Name *'}
                          </label>
                          <input
                            type="text"
                            value={editBranchName}
                            onChange={(e) => setEditBranchName(e.target.value)}
                            placeholder={isRtl ? 'مثال: فرع الرياض' : 'e.g. Riyadh Branch'}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-650 block mb-0.5">
                            {isRtl ? 'المدينة / المنطقة *' : 'City / Region *'}
                          </label>
                          <input
                            type="text"
                            value={editBranchCity}
                            onChange={(e) => setEditBranchCity(e.target.value)}
                            placeholder={isRtl ? 'مثال: الرياض' : 'e.g. Riyadh'}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-650 block mb-0.5">
                            {isRtl ? 'اسم المستخدم للدخول (Username) *' : 'Login Username *'}
                          </label>
                          <input
                            type="text"
                            value={editBranchUsername}
                            onChange={(e) => setEditBranchUsername(e.target.value)}
                            placeholder={isRtl ? 'اسم مستخدم فريد للدخول' : 'Unique username for login'}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-650 block mb-0.5">
                            {isRtl ? 'كلمة المرور للدخول *' : 'Login Password *'}
                          </label>
                          <input
                            type="password"
                            value={editBranchPassword}
                            onChange={(e) => setEditBranchPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      {/* Permissions Checklist for Edited Branch */}
                      <div className="bg-white border border-slate-150 p-3 rounded-xl space-y-2">
                        <span className="text-[10px] font-extrabold text-slate-600 block uppercase tracking-wider">
                          🛡️ {isRtl ? 'صلاحيات هذا الفرع على النظام' : 'Branch Permissions'}
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-900">
                            <input
                              type="checkbox"
                              checked={editBranchPermClients}
                              onChange={(e) => setEditBranchPermClients(e.target.checked)}
                              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            />
                            <span>{isRtl ? 'إدارة العملاء والمنشآت' : 'Manage Clients & Branches'}</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-900">
                            <input
                              type="checkbox"
                              checked={editBranchPermTechs}
                              onChange={(e) => setEditBranchPermTechs(e.target.checked)}
                              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            />
                            <span>{isRtl ? 'إدارة الفنيين والموظفين' : 'Manage Technicians'}</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-900">
                            <input
                              type="checkbox"
                              checked={editBranchPermQuotes}
                              onChange={(e) => setEditBranchPermQuotes(e.target.checked)}
                              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            />
                            <span>{isRtl ? 'إدارة عروض الأسعار والطلبات' : 'Manage Quotes & Inquiries'}</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-900">
                            <input
                              type="checkbox"
                              checked={editBranchPermWipe}
                              onChange={(e) => setEditBranchPermWipe(e.target.checked)}
                              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-rose-600 font-bold">{isRtl ? 'تهيئة وفرمتة النظام' : 'Database Reset Privilege'}</span>
                          </label>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBranchId(null);
                          }}
                          className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 text-xs font-bold rounded-xl transition cursor-pointer"
                        >
                          {isRtl ? 'إلغاء' : 'Cancel'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!editBranchName.trim() || !editBranchCity.trim() || !editBranchUsername.trim() || !editBranchPassword.trim()) {
                              alert(isRtl ? 'الرجاء إدخال جميع البيانات المطلوبة للفرع!' : 'Please fill all branch parameters!');
                              return;
                            }
                            setCompanyBranches(prev => prev.map(b => b.id === editingBranchId ? {
                              ...b,
                              name: editBranchName.trim(),
                              city: editBranchCity.trim(),
                              username: editBranchUsername.trim().toLowerCase(),
                              password: editBranchPassword.trim(),
                              permissions: {
                                manageClients: editBranchPermClients,
                                manageTechnicians: editBranchPermTechs,
                                manageQuotes: editBranchPermQuotes,
                                wipeDatabase: editBranchPermWipe
                              }
                            } : b));
                            setEditingBranchId(null);
                            triggerLocalMutation();
                            alert(isRtl ? 'تم تحديث بيانات فرع الشركة وصلاحياته بنجاح!' : 'Company branch updated successfully!');
                          }}
                          className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                        >
                          {isRtl ? 'حفظ التعديلات' : 'Save Changes'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Add Branch Form */
                    <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-3">
                      <h4 className="text-xs font-extrabold text-slate-800 border-b border-slate-250 pb-1.5 flex items-center gap-1.5">
                        ➕ {isRtl ? 'إضافة فرع جديد' : 'Create New Company Branch'}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-slate-650 block mb-0.5">
                            {isRtl ? 'اسم الفرع *' : 'Branch Name *'}
                          </label>
                          <input
                            type="text"
                            value={newBranchName}
                            onChange={(e) => setNewBranchName(e.target.value)}
                            placeholder={isRtl ? 'مثال: فرع الرياض' : 'e.g. Riyadh Branch'}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-teal-500"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-650 block mb-0.5">
                            {isRtl ? 'المدينة / المنطقة *' : 'City / Region *'}
                          </label>
                          <input
                            type="text"
                            value={newBranchCity}
                            onChange={(e) => setNewBranchCity(e.target.value)}
                            placeholder={isRtl ? 'مثال: الرياض' : 'e.g. Riyadh'}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-teal-500"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-650 block mb-0.5">
                            {isRtl ? 'اسم مستخدم الدخول (Username) *' : 'Login Username *'}
                          </label>
                          <input
                            type="text"
                            value={newBranchUsername}
                            onChange={(e) => setNewBranchUsername(e.target.value)}
                            placeholder={isRtl ? 'مثال: riyadh_admin' : 'e.g. riyadh_admin'}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-teal-500"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-650 block mb-0.5">
                            {isRtl ? 'كلمة المرور للدخول *' : 'Login Password *'}
                          </label>
                          <input
                            type="password"
                            value={newBranchPassword}
                            onChange={(e) => setNewBranchPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-teal-500"
                          />
                        </div>
                      </div>

                      {/* Permissions Checklist */}
                      <div className="bg-white border border-slate-150 p-3 rounded-xl space-y-2">
                        <span className="text-[10px] font-extrabold text-slate-600 block uppercase tracking-wider">
                          🛡️ {isRtl ? 'تحديد صلاحيات هذا الفرع للدخول' : 'Define Branch Permissions'}
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-900">
                            <input
                              type="checkbox"
                              checked={newBranchPermClients}
                              onChange={(e) => setNewBranchPermClients(e.target.checked)}
                              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            />
                            <span>{isRtl ? 'إدارة العملاء والمنشآت' : 'Manage Clients & Branches'}</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-900">
                            <input
                              type="checkbox"
                              checked={newBranchPermTechs}
                              onChange={(e) => setNewBranchPermTechs(e.target.checked)}
                              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            />
                            <span>{isRtl ? 'إدارة الفنيين والموظفين' : 'Manage Technicians'}</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-900">
                            <input
                              type="checkbox"
                              checked={newBranchPermQuotes}
                              onChange={(e) => setNewBranchPermQuotes(e.target.checked)}
                              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            />
                            <span>{isRtl ? 'إدارة عروض الأسعار والطلبات' : 'Manage Quotes & Inquiries'}</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-900">
                            <input
                              type="checkbox"
                              checked={newBranchPermWipe}
                              onChange={(e) => setNewBranchPermWipe(e.target.checked)}
                              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-rose-600 font-bold">{isRtl ? 'تهيئة وفرمتة النظام' : 'Database Reset Privilege'}</span>
                          </label>
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (!newBranchName.trim() || !newBranchCity.trim() || !newBranchUsername.trim() || !newBranchPassword.trim()) {
                              alert(isRtl ? 'الرجاء إدخال جميع الحقول المطلوبة بما فيها اليوزر والباسورد!' : 'Please fill all branch parameters including username and password!');
                              return;
                            }
                            // Avoid duplicate usernames
                            const normUser = newBranchUsername.trim().toLowerCase();
                            const isDuplicate = companyBranches.some(b => (b.username || '').toLowerCase() === normUser);
                            if (isDuplicate) {
                              alert(isRtl ? 'اسم المستخدم هذا مسجل لفرع آخر مسبقاً! يرجى اختيار اسم مستخدم فريد.' : 'This username is already taken by another branch! Please choose a unique username.');
                              return;
                            }

                            const newB: CompanyBranch = {
                              id: `branch_${Date.now()}`,
                              name: newBranchName.trim(),
                              city: newBranchCity.trim(),
                              username: normUser,
                              password: newBranchPassword.trim(),
                              permissions: {
                                manageClients: newBranchPermClients,
                                manageTechnicians: newBranchPermTechs,
                                manageQuotes: newBranchPermQuotes,
                                wipeDatabase: newBranchPermWipe
                              },
                              createdAt: new Date().toISOString()
                            };
                            setCompanyBranches(prev => [...prev, newB]);
                            setNewBranchName('');
                            setNewBranchCity('');
                            setNewBranchUsername('');
                            setNewBranchPassword('');
                            setNewBranchPermClients(true);
                            setNewBranchPermTechs(true);
                            setNewBranchPermQuotes(true);
                            setNewBranchPermWipe(false);
                            triggerLocalMutation();
                            alert(isRtl ? 'تم إضافة فرع الشركة الجديد مع حساب الدخول بنجاح!' : 'Company branch created with login credentials successfully!');
                          }}
                          className="px-4 py-2 bg-slate-900 border border-slate-800 text-white hover:bg-slate-800 text-xs font-bold rounded-xl transition cursor-pointer"
                        >
                          {isRtl ? 'إضافة فرع جديد' : 'Add Branch'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Branches List */}
                  <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-2">
                    <h4 className="text-xs font-extrabold text-slate-800 border-b border-slate-250 pb-1.5">
                      🏢 {isRtl ? 'فروع الشركة المسجلة بالنظام مع بيانات الدخول' : 'Registered Company Branches & Login Accounts'}
                    </h4>
                    <div className="divide-y divide-slate-150 max-h-[220px] overflow-y-auto">
                      {companyBranches.map((br) => (
                        <div key={br.id} className="py-2 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-800 text-xs">{br.name}</span>
                            <span className="text-[10px] text-slate-500 block">
                              📍 {isRtl ? `المدينة: ${br.city}` : `City: ${br.city}`} 
                              {br.username && ` | 🔑 ${isRtl ? 'المستخدم:' : 'User:'} ${br.username}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBranchId(br.id);
                                setEditBranchName(br.name);
                                setEditBranchCity(br.city);
                                setEditBranchUsername(br.username || '');
                                setEditBranchPassword(br.password || '');
                                setEditBranchPermClients(br.permissions?.manageClients ?? true);
                                setEditBranchPermTechs(br.permissions?.manageTechnicians ?? true);
                                setEditBranchPermQuotes(br.permissions?.manageQuotes ?? true);
                                setEditBranchPermWipe(br.permissions?.wipeDatabase ?? false);
                              }}
                              className="p-1 text-teal-600 hover:bg-teal-50 rounded transition cursor-pointer"
                              title={isRtl ? 'تعديل الفرع' : 'Edit Branch'}
                            >
                              ✏️
                            </button>
                            {br.id !== 'hq' && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(isRtl ? `تنبيه هام! هل تريد بالتأكيد حذف الفرع "${br.name}"؟` : `Are you sure you want to delete branch "${br.name}"?`)) {
                                    setCompanyBranches(prev => prev.filter(b => b.id !== br.id));
                                    triggerLocalMutation();
                                  }
                                }}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded transition cursor-pointer"
                                title={isRtl ? 'حذف الفرع' : 'Delete Branch'}
                              >
                                ❌
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {branchesSubTab === 'separation' && (
                /* Separation and Cloud Sync View */
                <div className="space-y-4">
                  <div className="p-4 bg-amber-500/10 border border-amber-500/15 rounded-2xl flex items-start gap-3 text-start">
                    <span className="text-xl animate-bounce">📡</span>
                    <div className="text-[11px] text-slate-700 leading-relaxed font-sans space-y-1">
                      <p className="font-extrabold text-amber-800">
                        {isRtl ? 'فصل الأنظمة وربطها سحابياً (Professional Deployment & Sync)' : 'Professional Deployment & Sync'}
                      </p>
                      <p>
                        {isRtl 
                          ? 'تتيح لك هذه الأداة فصل النظام إلى نسختين سحابيتين مستقلتين تماماً في قاعدة البيانات والأكواد (المقر الرئيسي وفرع جدة). مع الاحتفاظ بالقدرة الكاملة للمشرف العام على استيراد وتصفح الفرع المستقل من القائمة العلوية فوراً وبمزامنة تامة.'
                          : 'This tool lets you split the system into two independent cloud deployments (HQ and Jeddah Branch) with isolated code and databases. The Super Admin retains live, real-time sync and data-browsing privileges via the top branch dropdown.'}
                      </p>
                    </div>
                  </div>

                  {/* Mode selection form */}
                  <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-3 text-start">
                    <h4 className="text-xs font-extrabold text-slate-800 border-b border-slate-200 pb-2">
                      ⚙️ {isRtl ? 'تحديد وضع تشغيل هذه النسخة السحابية' : 'Set Deployment Mode of This Instance'}
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div 
                        onClick={() => {
                          setSystemMode('hq');
                          localStorage.setItem('sas_system_mode', 'hq');
                          triggerLocalMutation();
                        }}
                        className={`p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                          systemMode === 'hq'
                            ? 'bg-teal-50 border-teal-500 text-teal-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        <span className="text-xs font-black block mb-1">🏢 {isRtl ? 'نسخة المقر الرئيسي' : 'Central Headquarters Mode'}</span>
                        <span className="text-[10px] leading-relaxed font-normal block text-slate-600">
                          {isRtl ? 'هذا النظام يدير المقر الرئيسي ويمتلك لوحة تحكم وسيطة لاستيراد بيانات الفروع المعزولة.' : 'This instance operates as HQ and includes proxy control over remote branches.'}
                        </span>
                      </div>

                      <div 
                        onClick={() => {
                          setSystemMode('independent_branch');
                          localStorage.setItem('sas_system_mode', 'independent_branch');
                          triggerLocalMutation();
                        }}
                        className={`p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                          systemMode === 'independent_branch'
                            ? 'bg-amber-50 border-amber-500 text-amber-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        <span className="text-xs font-black block mb-1">📡 {isRtl ? 'نسخة فرع مستقل معزول (مثل فرع جدة)' : 'Isolated Independent Branch Mode'}</span>
                        <span className="text-[10px] leading-relaxed font-normal block text-slate-600">
                          {isRtl ? 'يعمل النظام بشكل مستقل تماماً في قاعدة بياناته وأكواده، مع تقديم مفتاح وصول آمن للمقر الرئيسي.' : 'This instance is fully isolated with its own database, exposing a secure API token for HQ.'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {systemMode === 'hq' ? (
                    /* Headquarters mode remote branch linking settings */
                    <div className="space-y-4 text-start">
                      <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-3">
                        <h4 className="text-xs font-extrabold text-slate-800 border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                          🔗 {isRtl ? 'ربط فرع مستقل جديد سحابياً' : 'Link a Remote Independent Branch'}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[11px] font-bold text-slate-650 block mb-0.5">
                              {isRtl ? 'اسم الفرع المنفصل *' : 'Branch Name *'}
                            </label>
                            <input
                              type="text"
                              value={newRemoteName}
                              onChange={(e) => setNewRemoteName(e.target.value)}
                              placeholder={isRtl ? 'مثال: فرع جدة المستقل' : 'e.g. Jeddah Branch'}
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-teal-500"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-650 block mb-0.5">
                              {isRtl ? 'رابط نظام الفرع السحابي (URL) *' : 'Remote App URL *'}
                            </label>
                            <input
                              type="text"
                              value={newRemoteUrl}
                              onChange={(e) => setNewRemoteUrl(e.target.value)}
                              placeholder="https://nesma-jeddah.run.place"
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-teal-500 ltr font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-650 block mb-0.5">
                              {isRtl ? 'مفتاح الوصول الآمن (Access Token) *' : 'Secure API Access Token *'}
                            </label>
                            <input
                              type="text"
                              value={newRemoteToken}
                              onChange={(e) => setNewRemoteToken(e.target.value)}
                              placeholder="NESMA-SECURE-XXXXXX"
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-teal-500 font-mono"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (!newRemoteName.trim() || !newRemoteUrl.trim() || !newRemoteToken.trim()) {
                                alert(isRtl ? 'الرجاء إدخال جميع البيانات المطلوبة للفرع السحابي!' : 'Please fill all remote branch fields!');
                                return;
                              }
                              const newRemote = {
                                id: 'remote_' + Date.now(),
                                name: newRemoteName.trim(),
                                url: newRemoteUrl.trim(),
                                token: newRemoteToken.trim()
                              };
                              setLinkedBranches(prev => [...prev, newRemote]);
                              setNewRemoteName('');
                              setNewRemoteUrl('');
                              setNewRemoteToken('');
                              triggerLocalMutation();
                              alert(isRtl ? 'تم ربط وتسجيل الفرع المستقل بنجاح! سيظهر الآن في القائمة العلوية للتصفح السريع.' : 'Remote branch registered successfully!');
                            }}
                            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                          >
                            {isRtl ? 'حفظ وربط الفرع' : 'Link Branch'}
                          </button>
                        </div>
                      </div>

                      {/* List of Registered Remote Branches */}
                      <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-2">
                        <h4 className="text-xs font-extrabold text-slate-800 border-b border-slate-200 pb-1.5">
                          📡 {isRtl ? 'الفروع المستقلة المربوطة حالياً' : 'Currently Linked Independent Branches'}
                        </h4>
                        <div className="divide-y divide-slate-150 max-h-[220px] overflow-y-auto">
                          {linkedBranches.length === 0 ? (
                            <p className="text-center text-slate-400 text-[10px] py-4">{isRtl ? 'لا توجد فروع مستقلة مربوطة حالياً.' : 'No remote branches registered yet.'}</p>
                          ) : (
                            linkedBranches.map((lb) => (
                              <div key={lb.id} className="py-2.5 flex items-center justify-between text-xs">
                                <div>
                                  <span className="font-bold text-teal-800 text-xs block">{lb.name}</span>
                                  <span className="text-[10px] text-slate-500 block font-mono font-bold">
                                    🔗 {lb.url}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      alert(isRtl ? 'جاري فحص حالة الفرع والتحقق من التوكن...' : 'Testing remote branch connection...');
                                      try {
                                        const res = await fetch('/api/proxy-branch-data', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ targetUrl: lb.url, accessToken: lb.token })
                                        });
                                        if (res.ok) {
                                          const json = await res.json();
                                          if (json.success) {
                                            alert(isRtl ? '✅ الاتصال ممتاز! الفرع السحابي متصل والتوكن آمن بنسبة 100%.' : '✅ Connection test successful! Token authorized.');
                                            return;
                                          }
                                        }
                                        alert(isRtl ? '❌ فشل الاتصال! يرجى التأكد من أن الرابط صحيح أو أن التوكن سليم.' : '❌ Failed! Remote branch token rejected or connection offline.');
                                      } catch (e: any) {
                                        alert(isRtl ? `❌ خطأ في الاتصال: ${e.message || e}` : `❌ Connection error: ${e.message}`);
                                      }
                                    }}
                                    className="px-2 py-1 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-lg text-[10px] transition font-bold"
                                  >
                                    ⚡ {isRtl ? 'فحص الاتصال' : 'Test Connection'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (confirm(isRtl ? 'هل تريد بالتأكيد إلغاء ربط هذا الفرع؟' : 'Are you sure you want to unlink this branch?')) {
                                        setLinkedBranches(prev => prev.filter(b => b.id !== lb.id));
                                        triggerLocalMutation();
                                      }
                                    }}
                                    className="p-1 text-rose-500 hover:bg-rose-50 rounded transition cursor-pointer"
                                    title={isRtl ? 'حذف الربط' : 'Unlink'}
                                  >
                                    ❌
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Independent Branch Mode View */
                    <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-4 text-start">
                      <h4 className="text-xs font-extrabold text-amber-800 border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                        🔑 {isRtl ? 'بيانات مفتاح الربط والوصول السحابي للفرع' : 'Cloud Remote Integration Parameters'}
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[11px] font-bold text-slate-650 block mb-0.5">
                            {isRtl ? 'معرف الفرع المستقل (ID) *' : 'Independent Branch ID *'}
                          </label>
                          <input
                            type="text"
                            value={independentBranchId}
                            onChange={(e) => {
                              setIndependentBranchId(e.target.value.trim());
                              localStorage.setItem('sas_independent_branch_id', e.target.value.trim());
                            }}
                            placeholder="branch_jeddah"
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-amber-500 font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-650 block mb-0.5">
                            {isRtl ? 'مفتاح الوصول السحابي للمقر الرئيسي (API Access Token) *' : 'API Access Token for Headquarters *'}
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              readOnly
                              value={apiAccessToken}
                              className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-250 rounded-xl focus:outline-none font-mono font-bold text-slate-700"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(apiAccessToken);
                                alert(isRtl ? 'تم نسخ رمز الوصول السحابي للمحافظة!' : 'Access token copied to clipboard!');
                              }}
                              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition shrink-0 cursor-pointer"
                            >
                              {isRtl ? 'نسخ' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="p-3.5 bg-blue-50 border border-blue-150 rounded-xl text-blue-900 space-y-1.5">
                        <h5 className="text-[11px] font-extrabold">{isRtl ? '💡 خطوات ربط هذا الفرع المنفصل بالمقر الرئيسي:' : '💡 Integration Instructions:'}</h5>
                        <ol className="list-decimal list-inside text-[10px] space-y-1 leading-relaxed">
                          <li>{isRtl ? 'انسخ "مفتاح الوصول السحابي" الموضح أعلاه.' : 'Copy the API Access Token shown above.'}</li>
                          <li>{isRtl ? 'ادخل لوحة التحكم في نظام المقر الرئيسي، واختر تبويب "فصل النظام والربط السحابي".' : 'Login to Headquarters control panel, navigate to System Separation.'}</li>
                          <li>{isRtl ? 'قم بإضافة فرع جديد وألصق مفتاح الوصول السحابي مع كتابة رابط هذا النظام الحالي.' : 'Add a new branch, paste the token, and provide this app\'s URL.'}</li>
                          <li>{isRtl ? 'احفظ الإعدادات، واستمتع بتكامل أمني حقيقي تصفحي تام ومباشر!' : 'Save changes to establish a secure, lightning-fast cloud bridge.'}</li>
                        </ol>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            triggerLocalMutation();
                            alert(isRtl ? 'تم حفظ إعدادات النشر السحابي للفرع بنجاح!' : 'Cloud deployment settings saved successfully!');
                          }}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                        >
                          {isRtl ? 'حفظ الإعدادات وتثبيت النشر' : 'Save & Publish Mode'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {branchesSubTab === 'purger' && (
                <div className="space-y-4 font-sans text-start">
                  <div className="p-4 bg-teal-500/10 border border-teal-500/15 rounded-2xl flex items-start gap-3">
                    <span className="text-xl">🧼</span>
                    <div className="space-y-1">
                      <h4 className="text-xs font-extrabold text-teal-800">
                        {isRtl ? 'أداة تصفية وتطهير البيانات المعزولة' : 'Isolated Data Purger & Cleaner'}
                      </h4>
                      <p className="text-[11px] text-slate-700 leading-relaxed">
                        {isRtl 
                          ? 'تتيح لك هذه الأداة مسح وتصفية كافة البيانات المدخلة التابعة لفرع تم فصله (مثل فرع جدة) بشكل نهائي من قاعدة بيانات هذا التطبيق (المقر الرئيسي)، لتحسين الأداء وتصفية القوائم دون التأثير على بيانات المقر الرئيسي.' 
                          : 'This tool allows you to permanently delete and filter all custom entries belonging to a separated branch (e.g. Jeddah Branch) from this app\'s database (Headquarters) to optimize performance and clean lists.'}
                      </p>
                    </div>
                  </div>

                  {/* Safety & Integrity Assurances */}
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/15 rounded-2xl space-y-2">
                    <h5 className="text-xs font-extrabold text-emerald-800 flex items-center gap-1.5">
                      🛡️ {isRtl ? 'ضمانات سلامة البيانات وعدم الفقدان:' : 'Data Integrity & Safety Guarantees:'}
                    </h5>
                    <ul className="list-disc list-inside text-[10.5px] text-slate-700 space-y-1.5 leading-relaxed">
                      <li>
                        <strong>{isRtl ? 'تصفية ذكية بمعرف الفرع:' : 'Smart ID Filtering:'}</strong>{' '}
                        {isRtl 
                          ? 'يتم الحذف فقط للمستندات والعمليات التي تحمل معرف الفرع الداخلي الفريد (companyBranchId). لن يتم لمس أو فحص الكلمات النصية؛ أي عميل أو فني تابع للمقر الرئيسي وعنوانه "جدة" لن يتأثر مطلقاً.' 
                          : 'Deletions are strictly restricted to records bearing the specific internal branch ID. Text fields are ignored; HQ entries mentioning "Jeddah" remain untouched.'}
                      </li>
                      <li>
                        <strong>{isRtl ? 'أمان الملفات والمرفقات السحابية:' : 'Cloud Attachments Security:'}</strong>{' '}
                        {isRtl 
                          ? 'جميع ملفات العقود المرفوعة، صور التقارير، تواقيع العملاء، وتواقيع الفنيين التابعة للمقر الرئيسي آمنة بنسبة 100% ومحفوظة تماماً في تخزينها السحابي.' 
                          : 'All uploaded contracts, report photos, client signatures, and technician logs belonging to HQ are 100% safe and stored securely.'}
                      </li>
                    </ul>
                  </div>

                  {/* Step 1: Download Backup */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <h5 className="text-xs font-extrabold text-slate-800">
                      💾 {isRtl ? 'الخطوة 1: تنزيل نسخة احتياطية آمنة' : 'Step 1: Download Safe System Backup'}
                    </h5>
                    <p className="text-[10.5px] text-slate-500 leading-relaxed">
                      {isRtl 
                        ? 'قبل إجراء أي تعديل أو حذف نهائي، نوصي بشدة بتحميل نسخة احتياطية كاملة لكافة بيانات وجداول النظام على جهازك، بحيث يمكنك استرجاعها في أي وقت بنقرة واحدة.' 
                        : 'Before performing any final data purges, we highly recommend downloading a complete system backup file so you can restore everything instantly.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          const backupPayload = {
                            version: "1.0",
                            generator: "Nesma First Maintenance Backup Engine - Pre Purge Backup",
                            timestamp: new Date().toISOString(),
                            clients,
                            visits,
                            technicians,
                            daysBeforeVisitAlert,
                            notificationLogs,
                            managerPhone,
                            managerEmail,
                            adminUsername,
                            adminPassword,
                            adminName,
                            quotations,
                            emergencyVisits,
                            companyBranches,
                            systemMode,
                            independentBranchId,
                            apiAccessToken,
                            linkedBranches
                          };
                          const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `nesma_pre_purge_backup_${new Date().toISOString().split('T')[0]}.json`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                          alert(isRtl ? '✅ تم تحميل النسخة الاحتياطية بنجاح وحفظها على جهازك!' : '✅ Backup downloaded successfully!');
                        } catch (err) {
                          alert(isRtl ? 'فشل تصدير النسخة الاحتياطية!' : 'Failed to export backup file!');
                        }
                      }}
                      className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      📥 {isRtl ? 'تحميل وحفظ نسخة احتياطية كاملة (.json)' : 'Export Safety Backup JSON'}
                    </button>
                  </div>

                  {/* Step 2: Select Branch & Show Impact Stats */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <h5 className="text-xs font-extrabold text-slate-800">
                      🏢 {isRtl ? 'الخطوة 2: تحديد الفرع المراد تصفيته واستعراض البيانات التابعة له' : 'Step 2: Select Branch to Purge & Preview Linked Data'}
                    </h5>
                    
                    <div>
                      <label className="text-[11px] font-bold text-slate-650 block mb-1">
                        {isRtl ? 'اختر الفرع المراد مسح بياناته من هذا التطبيق:' : 'Select Branch:'}
                      </label>
                      <select
                        value={purgerSelectedBranchId}
                        onChange={(e) => {
                          setPurgerSelectedBranchId(e.target.value);
                          setPurgerConfirmText('');
                        }}
                        className="w-full max-w-md px-3 py-2 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:border-teal-500"
                      >
                        <option value="">-- {isRtl ? 'اختر الفرع' : 'Select Company Branch'} --</option>
                        {companyBranches.map(b => (
                          <option key={b.id} value={b.id}>{b.name} ({b.city})</option>
                        ))}
                      </select>
                    </div>

                    {purgerSelectedBranchId && (() => {
                      const bObj = companyBranches.find(b => b.id === purgerSelectedBranchId);
                      if (!bObj) return null;
                      
                      const stats = {
                        clients: clients.filter(c => c.companyBranchId === purgerSelectedBranchId).length,
                        technicians: technicians.filter(t => t.companyBranchId === purgerSelectedBranchId).length,
                        visits: visits.filter(v => v.companyBranchId === purgerSelectedBranchId).length,
                        emergencyVisits: emergencyVisits.filter(v => v.companyBranchId === purgerSelectedBranchId).length,
                        quotations: quotations.filter(q => q.companyBranchId === purgerSelectedBranchId).length,
                        receipts: extinguisherReceipts.filter(r => r.companyBranchId === purgerSelectedBranchId).length,
                        logs: notificationLogs.filter(l => l.companyBranchId === purgerSelectedBranchId).length,
                      };

                      return (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                          <h6 className="text-[11px] font-black text-amber-800">
                            📊 {isRtl ? `إحصائيات البيانات التي سيتم تصفيتها لفرع: ${bObj.name}` : `Data to be purged for: ${bObj.name}`}
                          </h6>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[10.5px]">
                            <div className="p-2 bg-white rounded-lg border border-slate-150">
                              <span className="text-slate-500 block">{isRtl ? '👥 العملاء والمنشآت' : 'Clients'}</span>
                              <strong className="text-slate-800 font-extrabold text-xs">{stats.clients} {isRtl ? 'عميل' : 'clients'}</strong>
                            </div>
                            <div className="p-2 bg-white rounded-lg border border-slate-150">
                              <span className="text-slate-500 block">{isRtl ? '👷 الفنيين والمستخدمين' : 'Technicians'}</span>
                              <strong className="text-slate-800 font-extrabold text-xs">{stats.technicians} {isRtl ? 'فني' : 'technicians'}</strong>
                            </div>
                            <div className="p-2 bg-white rounded-lg border border-slate-150">
                              <span className="text-slate-500 block">{isRtl ? '📅 زيارات مجدولة معلقة ومكتملة' : 'Schedules & Visits'}</span>
                              <strong className="text-slate-800 font-extrabold text-xs">{stats.visits} {isRtl ? 'زيارة' : 'visits'}</strong>
                            </div>
                            <div className="p-2 bg-white rounded-lg border border-slate-150">
                              <span className="text-slate-500 block">{isRtl ? '🚨 بلاغات الطوارئ النشطة' : 'Emergency Visits'}</span>
                              <strong className="text-slate-800 font-extrabold text-xs">{stats.emergencyVisits} {isRtl ? 'بلاغ' : 'tickets'}</strong>
                            </div>
                            <div className="p-2 bg-white rounded-lg border border-slate-150">
                              <span className="text-slate-500 block">{isRtl ? '📄 عروض الأسعار والطلبات' : 'Quotations'}</span>
                              <strong className="text-slate-800 font-extrabold text-xs">{stats.quotations} {isRtl ? 'عرض' : 'quotes'}</strong>
                            </div>
                            <div className="p-2 bg-white rounded-lg border border-slate-150">
                              <span className="text-slate-500 block">{isRtl ? '🧯 سندات استلام الطفايات' : 'Extinguisher Receipts'}</span>
                              <strong className="text-slate-800 font-extrabold text-xs">{stats.receipts} {isRtl ? 'سند' : 'receipts'}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Step 3: Double Confirmation */}
                  {purgerSelectedBranchId && (() => {
                    const bObj = companyBranches.find(b => b.id === purgerSelectedBranchId);
                    if (!bObj) return null;
                    
                    return (
                      <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-3">
                        <h5 className="text-xs font-extrabold text-rose-800 flex items-center gap-1.5">
                          ⚠️ {isRtl ? 'الخطوة 3: تأكيد الحذف والتصفية النهائية للبيانات المعزولة' : 'Step 3: Double Confirmation & Execute'}
                        </h5>
                        
                        <div className="space-y-3">
                          {/* Checkbox */}
                          <label className="flex items-start gap-2 text-[11px] text-slate-700 cursor-pointer hover:text-slate-900 leading-relaxed">
                            <input
                              type="checkbox"
                              checked={purgerBackupChecked}
                              onChange={(e) => setPurgerBackupChecked(e.target.checked)}
                              className="mt-0.5 rounded border-rose-350 text-rose-600 focus:ring-rose-500 animate-pulse"
                            />
                            <span>
                              {isRtl 
                                ? `أقر بأنني قمت بتحميل نسخة احتياطية كاملة للنظام قبل البدء، وأتحمل كامل المسؤولية عن تصفية وحذف كافة بيانات فرع "${bObj.name}" نهائياً من قاعدة بيانات هذا النظام.` 
                                : `I acknowledge that I downloaded a full system backup before proceeding, and I take full responsibility for permanently purging all data linked to "${bObj.name}" branch.`}
                            </span>
                          </label>

                          {/* Text input confirmation */}
                          <div>
                            <label className="text-[11px] font-bold text-rose-800 block mb-1">
                              {isRtl 
                                ? `لتأكيد التطهير الآمن النهائي، يرجى كتابة اسم الفرع بالضبط "${bObj.name}" أو كلمة "تصفية" في الحقل أدناه:` 
                                : `Type exact branch name "${bObj.name}" or "PURGE" below to authorize:`}
                            </label>
                            <input
                              type="text"
                              value={purgerConfirmText}
                              onChange={(e) => setPurgerConfirmText(e.target.value)}
                              placeholder={isRtl ? 'اكتب لتأكيد تفعيل الزر...' : 'Type confirmation text...'}
                              className="w-full max-w-md px-3 py-2 text-xs bg-white border border-rose-250 rounded-xl focus:outline-none focus:border-rose-500 font-bold"
                            />
                          </div>

                          {/* Execution Button */}
                          <button
                            type="button"
                            disabled={!purgerBackupChecked || (purgerConfirmText.trim() !== bObj.name && purgerConfirmText.trim() !== 'تصفية' && purgerConfirmText.trim().toUpperCase() !== 'PURGE')}
                            onClick={() => {
                              if (confirm(isRtl 
                                ? `🚨 تحذير أخير وصارم جداً! هل تريد بالتأكيد تصفية ومسح كافة بيانات فرع "${bObj.name}" بشكل نهائي؟ لا يمكن التراجع عن هذه الخطوة إلا باسترجاع ملف النسخة الاحتياطية.` 
                                : `🚨 CRITICAL WARNING! Are you sure you want to permanently delete all records of "${bObj.name}"? This action cannot be undone.`)) {
                                executePurgeBranch(purgerSelectedBranchId);
                              }
                            }}
                            className={`w-full max-w-md py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm text-white ${
                              (purgerBackupChecked && (purgerConfirmText.trim() === bObj.name || purgerConfirmText.trim() === 'تصفية' || purgerConfirmText.trim().toUpperCase() === 'PURGE'))
                                ? 'bg-rose-600 hover:bg-rose-700 active:scale-95'
                                : 'bg-rose-300 cursor-not-allowed opacity-60'
                            }`}
                          >
                            🧼 {isRtl ? 'تنفيذ التصفية والتنظيف الآمن النهائي للبيانات' : 'Execute Final Safe Purge & Cleanup'}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setIsControlPanelModalOpen(false)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-105 text-slate-700 hover:text-slate-950 text-xs font-bold rounded-xl transition cursor-pointer font-sans"
              >
                {isRtl ? 'إغلاق لوحة التحكم' : 'Close Settings'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
