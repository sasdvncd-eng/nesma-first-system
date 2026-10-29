import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import nodemailer from 'nodemailer';
import { initializeApp } from 'firebase/app';
import { initializeFirestore, getFirestore, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { GoogleGenAI, Type } from '@google/genai';

// Load environment variables
dotenv.config();

let ai: any = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log('[SAS Gemini] Server initialized Gemini API client successfully.');
  } catch (err) {
    console.error('[SAS Gemini] Failed to initialize Gemini API client:', err);
  }
} else {
  console.warn('[SAS Gemini] Warning: GEMINI_API_KEY is not defined in the environment.');
}

const DB_FILE = path.join(process.cwd(), 'database.json');

// Initialize Firebase client for persistent server state
let db: any = null;
try {
  const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(firebaseConfigPath)) {
    const configContent = fs.readFileSync(firebaseConfigPath, 'utf-8');
    const firebaseConfig = JSON.parse(configContent);
    const app = initializeApp(firebaseConfig);
    db = initializeFirestore(
      app,
      { experimentalAutoDetectLongPolling: true },
      firebaseConfig.firestoreDatabaseId
    );
    console.log('[SAS Firebase] Server initialized Firestore cloud client successfully for project:', firebaseConfig.projectId);
  } else {
    console.warn('[SAS Firebase] Warning: firebase-applet-config.json not found on disk at startup.');
  }
} catch (error) {
  console.error('[SAS Firebase] Crash during server-side Firebase initialization:', error);
}

// Helper to sanitize all objects for Firestore (removes undefined values which cause Firestore fatal errors)
function sanitizeForFirestore(data: any): any {
  if (data === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(data, (_key, value) => (value === undefined ? null : value)));
  } catch (e) {
    return data;
  }
}

const MAX_FS_DOC_SIZE = 750000; // 750 KB safe margin for Firestore 1MB doc limit

// Helper to read DB from Firestore with transparent chunk reconstruction
async function readDatabaseFS() {
  if (!db) {
    console.warn('[SAS Firestore] Firestore is uninitialized.');
    return null;
  }
  try {
    const docRef = doc(db, 'appState', 'global');
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      console.log('[SAS Firestore] Global document does not exist in Firestore yet.');
      return null;
    }
    const data = docSnap.data();
    if (data?.isChunked === true && typeof data?.totalChunks === 'number') {
      console.log(`[SAS Firestore] Master state is chunked (${data.totalChunks} chunks). Assembling chunks...`);
      let assembledStr = '';
      for (let i = 0; i < data.totalChunks; i++) {
        const chunkRef = doc(db, 'appState', `chunk_${i}`);
        const chunkSnap = await getDoc(chunkRef);
        if (chunkSnap.exists()) {
          assembledStr += chunkSnap.data().content || '';
        } else {
          console.error(`[SAS Firestore] Missing chunk_${i} while reconstructing master state!`);
        }
      }
      return JSON.parse(assembledStr);
    }
    return data;
  } catch (error) {
    console.error('[SAS Firestore] Failed to read database from Firestore:', error);
  }
  return null;
}

// Helper to write DB to Firestore with sanitization and chunking
let isDbDirty = false;
let lastFsWriteTime = 0;
let pendingFsTimer: NodeJS.Timeout | null = null;
let latestDbState: any = null;

const QUOTA_FILE = path.join(process.cwd(), '.firestore_quota.json');

function getNextUtcMidnight(): number {
  const now = new Date();
  const nextMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 5, 0));
  return nextMidnight.getTime();
}

function loadQuotaState(): { isExceeded: boolean; resetTime: number } {
  try {
    if (fs.existsSync(QUOTA_FILE)) {
      const data = JSON.parse(fs.readFileSync(QUOTA_FILE, 'utf-8'));
      if (data && typeof data.resetTime === 'number' && Date.now() < data.resetTime) {
        return { isExceeded: true, resetTime: data.resetTime };
      }
    }
  } catch (e) {}
  return { isExceeded: false, resetTime: 0 };
}

function persistQuotaExceeded() {
  const resetTime = getNextUtcMidnight();
  isFirestoreQuotaExceeded = true;
  quotaExceededResetTime = resetTime;
  try {
    fs.writeFileSync(QUOTA_FILE, JSON.stringify({ isExceeded: true, resetTime }), 'utf-8');
  } catch (e) {}
  console.warn(`[SAS Firestore] Daily write quota reached. Writes safely paused until midnight UTC (${new Date(resetTime).toISOString()}). Local disk and in-memory cache active.`);
}

const initialQuota = loadQuotaState();
let isFirestoreQuotaExceeded = initialQuota.isExceeded;
let quotaExceededResetTime = initialQuota.resetTime;

if (isFirestoreQuotaExceeded) {
  console.warn(`[SAS Firestore] Active quota pause loaded from disk. Resets at: ${new Date(quotaExceededResetTime).toISOString()}`);
}

// Helper for timeout-protected setDoc
async function setDocWithTimeout(docRef: any, data: any, timeoutMs = 4000) {
  let timer: any;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Firestore operation timeout')), timeoutMs);
  });
  try {
    await Promise.race([setDoc(docRef, data), timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

async function writeDatabaseFS(data: any) {
  if (!db) {
    return false;
  }
  if (isFirestoreQuotaExceeded && Date.now() < quotaExceededResetTime) {
    return false;
  }
  if (Date.now() >= quotaExceededResetTime && isFirestoreQuotaExceeded) {
    isFirestoreQuotaExceeded = false;
    quotaExceededResetTime = 0;
    try { if (fs.existsSync(QUOTA_FILE)) fs.unlinkSync(QUOTA_FILE); } catch (e) {}
  }
  try {
    const cleanData = sanitizeForFirestore(data);
    const jsonStr = JSON.stringify(cleanData);
    
    if (jsonStr.length > MAX_FS_DOC_SIZE) {
      console.log(`[SAS Firestore] Master state size (${jsonStr.length} bytes) exceeds safe threshold (${MAX_FS_DOC_SIZE}). Splitting across chunked documents...`);
      const totalChunks = Math.ceil(jsonStr.length / MAX_FS_DOC_SIZE);
      for (let i = 0; i < totalChunks; i++) {
        if (isFirestoreQuotaExceeded) return false;
        const chunkContent = jsonStr.substring(i * MAX_FS_DOC_SIZE, (i + 1) * MAX_FS_DOC_SIZE);
        const chunkRef = doc(db, 'appState', `chunk_${i}`);
        await setDocWithTimeout(chunkRef, { chunkIndex: i, content: chunkContent, updatedAt: new Date().toISOString() });
      }
      
      const docRef = doc(db, 'appState', 'global');
      await setDocWithTimeout(docRef, {
        isChunked: true,
        totalChunks,
        totalBytes: jsonStr.length,
        updatedAt: new Date().toISOString(),
        clientsCount: Array.isArray(cleanData.clients) ? cleanData.clients.length : 0,
        visitsCount: Array.isArray(cleanData.visits) ? cleanData.visits.length : 0,
        quotationsCount: Array.isArray(cleanData.quotations) ? cleanData.quotations.length : 0,
        techniciansCount: Array.isArray(cleanData.technicians) ? cleanData.technicians.length : 0,
        isWiped: cleanData.isWiped === true
      });
      console.log(`[SAS Firestore] Master state chunked successfully into ${totalChunks} documents!`);
    } else {
      const docRef = doc(db, 'appState', 'global');
      await setDocWithTimeout(docRef, {
        ...cleanData,
        isChunked: false,
        updatedAt: new Date().toISOString()
      });
      console.log('[SAS Firestore] Wrote master state directly to Cloud Firestore!');
    }
    return true;
  } catch (error: any) {
    const errMsg = String(error?.message || error || '');
    if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('resource-exhausted') || errMsg.includes('Quota limit exceeded') || errMsg.includes('quota') || errMsg.includes('timeout')) {
      persistQuotaExceeded();
    } else {
      console.warn('[SAS Firestore Background Sync Warning]:', error.message || error);
    }
    return false;
  }
}

async function queueFirestoreWrite(data: any) {
  if (isFirestoreQuotaExceeded && Date.now() < quotaExceededResetTime) {
    return;
  }
  latestDbState = data;
  isDbDirty = true;
  
  if (!pendingFsTimer) {
    const timeSinceLastWrite = Date.now() - lastFsWriteTime;
    const delay = Math.max(1000, 15000 - timeSinceLastWrite); // write at most once every 15 seconds, minimum 1 second delay
    
    pendingFsTimer = setTimeout(async () => {
      pendingFsTimer = null;
      if (isDbDirty && db && latestDbState) {
        const ok = await writeDatabaseFS(latestDbState);
        if (ok) {
          isDbDirty = false;
          lastFsWriteTime = Date.now();
        }
      }
    }, delay);
  }
}

// Helper to read DB from local disk
function readDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[SAS DB] Failed to read database.json:', error);
  }
  return null;
}

// Helper to write DB to local disk
function writeDatabase(data: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('[SAS DB] Failed to write database.json:', error);
    return false;
  }
}

// Global in-memory cache to completely bypass expensive/rate-limited Firestore read queries on polling
let cachedDbState: any = null;
let isDbLoaded = false;

// Highly resilient asynchronous server-state pre-loader and cache initializer
async function initializeServerState() {
  console.log('[SAS State Engine] Initializing database cache from Firestore/Local storage...');
  
  // 1. Attempt Firestore fetch
  let firestoreData: any = null;
  if (db) {
    try {
      firestoreData = await readDatabaseFS();
      if (firestoreData) {
        console.log('[SAS State Engine] Loaded master state snapshot from Cloud Firestore.');
      } else {
        console.warn('[SAS State Engine] appState/global not found in Firestore.');
      }
    } catch (err) {
      console.error('[SAS State Engine] Error reading master state from Firestore during startup:', err);
    }
  }

  // 2. Local disk read
  const localData = readDatabase();

  const isFsEmpty = !firestoreData || (
    (!firestoreData.clients || firestoreData.clients.length === 0) &&
    (!firestoreData.technicians || firestoreData.technicians.length === 0) &&
    (!firestoreData.visits || firestoreData.visits.length === 0)
  );

  const isLocalEmpty = !localData || (
    (!localData.clients || localData.clients.length === 0) &&
    (!localData.technicians || localData.technicians.length === 0) &&
    (!localData.visits || localData.visits.length === 0)
  );

  if (!isFsEmpty && !isLocalEmpty) {
    // Both have data: merge them intelligently, preferring the newest clients list
    const fsCount = (firestoreData.clients || []).length;
    const localCount = (localData.clients || []).length;
    if (fsCount >= localCount) {
      cachedDbState = mergeDatabase(localData, firestoreData);
    } else {
      cachedDbState = mergeDatabase(firestoreData, localData);
    }
    isDbLoaded = true;
    writeDatabase(cachedDbState);
    console.log(`[SAS State Engine] Merged Cloud Firestore (${fsCount} clients) with local disk (${localCount} clients) successfully.`);
  } else if (!isFsEmpty) {
    // Firestore has data: use it as source of truth and update local disk cache
    cachedDbState = firestoreData;
    isDbLoaded = true;
    writeDatabase(firestoreData);
    console.log('[SAS State Engine] Using Cloud Firestore as active source of truth.');
  } else if (!isLocalEmpty) {
    // Local disk has data, but Firestore was empty: use local disk and sync to Firestore
    cachedDbState = localData;
    isDbLoaded = true;
    console.log('[SAS State Engine] Using local disk state and populating Cloud Firestore...');
    if (db && !isFirestoreQuotaExceeded && Date.now() >= quotaExceededResetTime) {
      writeDatabaseFS(localData).catch(err => {
        console.error('[SAS State Engine] Initial Cloud Firestore sync error:', err);
      });
    }
  } else if (firestoreData) {
    cachedDbState = firestoreData;
    isDbLoaded = true;
  } else if (localData) {
    cachedDbState = localData;
    isDbLoaded = true;
  }

  // 3. Absolute fallback to valid empty structural schema so we don't crash the front-end
  if (!cachedDbState) {
    console.warn('[SAS State Engine] Warning: No existing database found anywhere. Initializing fresh template schema.');
    cachedDbState = {
      clients: [],
      visits: [],
      technicians: [],
      daysBeforeVisitAlert: 2,
      notificationLogs: [],
      quotations: [],
      emergencyVisits: [],
      deletedVisitIds: [],
      extinguisherReceipts: [],
      companyBranches: []
    };
    isDbLoaded = true;
  }

  // 4. Sanitize branch name of hq to "المقر الرئيسي" and make sure hq is always there
  if (cachedDbState) {
    if (!Array.isArray(cachedDbState.companyBranches)) {
      cachedDbState.companyBranches = [];
    }
    const hqExists = cachedDbState.companyBranches.some((b: any) => b.id === 'hq');
    if (!hqExists) {
      cachedDbState.companyBranches.unshift({
        id: 'hq',
        name: 'المقر الرئيسي',
        city: 'جدة',
        createdAt: new Date().toISOString()
      });
    } else {
      cachedDbState.companyBranches = cachedDbState.companyBranches.map((b: any) =>
        b.id === 'hq' ? { ...b, name: 'المقر الرئيسي' } : b
      );
    }
  }
}

// Smart merger to prevent concurrent writes on master database being wiped out by stale dashboard clients
function mergeDatabase(current: any, incoming: any) {
  if (!current || typeof current !== 'object') return incoming;
  if (!incoming || typeof incoming !== 'object') return current;

  const result = { ...current };

  // Sync deletedVisitIds list across nodes
  const currentDeletedIds = Array.isArray(current.deletedVisitIds) ? current.deletedVisitIds : [];
  const incomingDeletedIds = Array.isArray(incoming.deletedVisitIds) ? incoming.deletedVisitIds : [];
  const mergedDeletedIds = Array.from(new Set([...currentDeletedIds, ...incomingDeletedIds]));
  result.deletedVisitIds = mergedDeletedIds;

  // Direct overwrite or smart partial merge for clients
  if (Array.isArray(incoming.clients)) {
    if (incoming.action === 'updateClient' || (incoming.clients.length === 1 && Array.isArray(current?.clients) && current.clients.length > 1)) {
      const incomingMap = new Map<string, any>(incoming.clients.map((c: any) => [c.id, c]));
      const updatedList = (current.clients || []).map((c: any) => {
        const update: any = incomingMap.get(c.id);
        return update ? { ...c, ...update } : c;
      });
      incoming.clients.forEach((c: any) => {
        if (!updatedList.some((existing: any) => existing.id === c.id)) {
          updatedList.push(c);
        }
      });
      result.clients = updatedList;
    } else {
      result.clients = incoming.clients;
    }
  }
  if (Array.isArray(incoming.technicians)) {
    result.technicians = incoming.technicians;
  }
  if (Array.isArray(incoming.quotations)) {
    result.quotations = incoming.quotations;
  }
  if (Array.isArray(incoming.notificationLogs)) {
    result.notificationLogs = incoming.notificationLogs;
  }
  if (Array.isArray(incoming.emergencyVisits)) {
    result.emergencyVisits = incoming.emergencyVisits.filter((v: any) => v && v.id && !mergedDeletedIds.includes(v.id));
  } else if (Array.isArray(result.emergencyVisits)) {
    result.emergencyVisits = result.emergencyVisits.filter((v: any) => v && v.id && !mergedDeletedIds.includes(v.id));
  }

  // Smart guard merge for visits:
  // We keep all incoming visits.
  // We restore completed server visits only if they are missing or pending,
  // AND their client still exists (to allow cascade client deletes).
  if (Array.isArray(incoming.visits)) {
    const visitMap = new Map<string, any>();
    
    // Start with incoming visits, ensuring they are not in the deleted list
    incoming.visits.forEach((v: any) => {
      if (v && v.id && !mergedDeletedIds.includes(v.id)) {
        visitMap.set(v.id, v);
      }
    });

    const incomingClientsSet = new Set(
      Array.isArray(incoming.clients) ? incoming.clients.map((c: any) => c.id) : []
    );

    const currentVisits = Array.isArray(current.visits) ? current.visits : [];
    currentVisits.forEach((v: any) => {
      if (!v || !v.id || mergedDeletedIds.includes(v.id)) return;
      
      const incomingVisit = visitMap.get(v.id);
      
      // If server visit is completed, we want to make sure we don't accidentally revert it to pending
      if (v.status === 'completed') {
        const clientStillExists = incomingClientsSet.has(v.clientId);
        if (clientStillExists) {
          if (!incomingVisit) {
            // Restore missing completed visit
            visitMap.set(v.id, v);
          } else if (incomingVisit.status === 'pending') {
            // Prevent reverting a completed visit back to pending unless explicitly reset with a newer updatedAt timestamp by an admin
            const isFreshResetByAdmin = 
              incomingVisit.updatedAt && 
              (!v.updatedAt || incomingVisit.updatedAt > v.updatedAt);

            if (isFreshResetByAdmin) {
              visitMap.set(v.id, incomingVisit);
            } else {
              visitMap.set(v.id, { ...v, ...incomingVisit, status: 'completed' });
            }
          }
        }
      }
    });

    result.visits = Array.from(visitMap.values());
  }

  if (Array.isArray(incoming.extinguisherReceipts)) {
    const receiptMap = new Map<string, any>();
    const currentReceipts = Array.isArray(current.extinguisherReceipts) ? current.extinguisherReceipts : [];
    
    currentReceipts.forEach((r: any) => {
      if (r && r.id) receiptMap.set(r.id, r);
    });
    
    incoming.extinguisherReceipts.forEach((r: any) => {
      if (r && r.id) {
        receiptMap.set(r.id, { ...receiptMap.get(r.id), ...r });
      }
    });
    
    result.extinguisherReceipts = Array.from(receiptMap.values());
  }

  if (Array.isArray(incoming.companyBranches)) {
    result.companyBranches = incoming.companyBranches.map((b: any) =>
      b.id === 'hq' ? { ...b, name: 'المقر الرئيسي' } : b
    );
  }

  // Merge system variables
  if (incoming.daysBeforeVisitAlert !== undefined) {
    result.daysBeforeVisitAlert = incoming.daysBeforeVisitAlert;
  }
  if (incoming.managerPhone) {
    result.managerPhone = incoming.managerPhone;
  }
  if (incoming.managerEmail) {
    result.managerEmail = incoming.managerEmail;
  }
  if (incoming.adminUsername) {
    result.adminUsername = incoming.adminUsername;
  }
  if (incoming.adminPassword) {
    result.adminPassword = incoming.adminPassword;
  }
  if (incoming.adminName) {
    result.adminName = incoming.adminName;
  }
  if (incoming.maintenanceModeEnabled !== undefined) {
    result.maintenanceModeEnabled = incoming.maintenanceModeEnabled === true;
  }
  if (incoming.systemMode) {
    result.systemMode = incoming.systemMode;
  }
  if (incoming.independentBranchId) {
    result.independentBranchId = incoming.independentBranchId;
  }
  if (incoming.apiAccessToken) {
    result.apiAccessToken = incoming.apiAccessToken;
  }
  if (incoming.linkedBranches !== undefined) {
    result.linkedBranches = incoming.linkedBranches;
  }
  if (incoming.companyName) {
    result.companyName = incoming.companyName;
  }
  if (incoming.companyUnified) {
    result.companyUnified = incoming.companyUnified;
  }
  if (incoming.companyPhone) {
    result.companyPhone = incoming.companyPhone;
  }
  if (incoming.companyEmail) {
    result.companyEmail = incoming.companyEmail;
  }
  if (incoming.companyTaxId) {
    result.companyTaxId = incoming.companyTaxId;
  }
  if (incoming.companyAddress) {
    result.companyAddress = incoming.companyAddress;
  }
  if (incoming.smtpHost !== undefined) {
    result.smtpHost = incoming.smtpHost;
  }
  if (incoming.smtpPort !== undefined) {
    result.smtpPort = incoming.smtpPort;
  }
  if (incoming.smtpUser !== undefined) {
    result.smtpUser = incoming.smtpUser;
  }
  if (incoming.smtpPass !== undefined) {
    result.smtpPass = incoming.smtpPass;
  }
  if (incoming.smtpFromEmail !== undefined) {
    result.smtpFromEmail = incoming.smtpFromEmail;
  }
  if (incoming.smtpEnabled !== undefined) {
    result.smtpEnabled = incoming.smtpEnabled === true;
  }
  if (incoming.customization !== undefined) {
    result.customization = incoming.customization;
  }

  return result;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use JSON middleware with large limits to support uploading high-res report photos/PDF files
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Create local static uploads directory on persistent/container disk
  const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  // Serve static files inside the uploads directory directly so clients can access report media
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Highly resilient Firestore operation helpers with exponential backoff and retries
  async function retrySetDoc(docRef: any, data: any, retries = 2) {
    if (isFirestoreQuotaExceeded && Date.now() < quotaExceededResetTime) {
      return;
    }
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await setDocWithTimeout(docRef, data, 3500);
        return;
      } catch (err: any) {
        const errMsg = String(err?.message || err || '');
        if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('resource-exhausted') || errMsg.includes('Quota limit exceeded') || errMsg.includes('quota') || errMsg.includes('timeout')) {
          persistQuotaExceeded();
          return;
        }
        if (attempt === retries) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 300));
      }
    }
  }

  async function retryGetDoc(docRef: any, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const snap = await getDoc(docRef);
        return snap;
      } catch (err) {
        console.warn(`[SAS Firestore Retry] GetDoc attempt ${attempt}/${retries} failed for ${docRef.path}:`, err);
        if (attempt === retries) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
  }

  // High-priority self-healing restore fallback route to pull files from Firestore if missing on container disk
  app.get('/uploads/:filename', async (req, res) => {
    const filename = req.params.filename;
    const localPath = path.join(UPLOADS_DIR, filename);

    // 1. If file is on local disk, serve it immediately
    if (fs.existsSync(localPath)) {
      res.sendFile(localPath);
      return;
    }

    // 2. If missing from disk, pull from durable Cloud Firestore collection "uploadedFiles"
    if (db) {
      try {
        const docRef = doc(db, 'uploadedFiles', filename);
        const docSnap = await retryGetDoc(docRef);
        if (docSnap.exists()) {
          const fileData = docSnap.data() as any;
          let base64Full = '';

          if (fileData.isChunked) {
            console.log(`[SAS Self-Healing] Rebuilding chunked file ${filename} (${fileData.totalChunks} chunks)...`);
            const chunks: string[] = [];
            for (let i = 0; i < fileData.totalChunks; i++) {
              const chunkDocRef = doc(db, 'uploadedFileChunks', `${filename}_chunk_${i}`);
              const chunkSnap = await retryGetDoc(chunkDocRef);
              if (chunkSnap.exists()) {
                chunks.push((chunkSnap.data() as any).base64Chunk);
              } else {
                throw new Error(`Missing chunk index ${i} for file ${filename}`);
              }
            }
            base64Full = chunks.join('');
            console.log(`[SAS Self-Healing] Rebuilt chunked file ${filename} successfully. Total reconstructed length: ${base64Full.length} chars.`);
          } else {
            base64Full = fileData.base64;
          }

          if (base64Full) {
            const buffer = Buffer.from(base64Full, 'base64');
            
            // Re-sync file to local disk cache so subsequent requests load instantaneously
            try {
              fs.writeFileSync(localPath, buffer);
              console.log(`[SAS Self-Healing] Successfully restored ${filename} from Firestore to local storage cache.`);
            } catch (writeErr) {
              console.error('[SAS Cache Write Error] Failed to write restored file locally:', writeErr);
            }

            res.setHeader('Content-Type', fileData.type || 'application/octet-stream');
            res.send(buffer);
            return;
          }
        }
      } catch (err) {
        console.error(`[SAS Restore Error] Failed to retrieve ${filename} from Firestore cloud:`, err);
      }
    }

    res.status(404).send('File or service endpoint not found / مستند أو خدمة غير متوفرة');
  });

  // High-performance API endpoint to parse base64 media, save it locally, and synchronously persist to durable Cloud Firestore (completely avoiding background worker freeze)
  app.post('/api/upload', async (req, res) => {
    const { name, type, base64 } = req.body;
    if (!base64) {
      res.status(400).json({ success: false, error: 'Base64 content is required' });
      return;
    }

    try {
      const buffer = Buffer.from(base64, 'base64');
      
      // Sanitize filename to avoid directory traversal
      const safeName = (name || 'upload')
        .replace(/[^a-zA-Z0-9.\-_]/g, '_')
        .substring(0, 100);
      
      let fileExt = path.extname(safeName);
      if (!fileExt || fileExt === '.bin') {
        const lowerType = String(type || '').toLowerCase();
        if (lowerType.includes('mp4') || lowerType.includes('video') || lowerType.includes('quicktime') || lowerType.includes('mov')) fileExt = '.mp4';
        else if (lowerType.includes('webm')) fileExt = '.webm';
        else if (lowerType.includes('png')) fileExt = '.png';
        else if (lowerType.includes('jpeg') || lowerType.includes('jpg') || lowerType.includes('image')) fileExt = '.jpg';
        else if (lowerType.includes('pdf')) fileExt = '.pdf';
        else fileExt = '.bin';
      }
      const baseName = path.basename(safeName, path.extname(safeName));
      const uniqueName = `${baseName}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}${fileExt}`;
      const destPath = path.join(UPLOADS_DIR, uniqueName);

      // 1. Save locally for instantaneous fallback access
      fs.writeFileSync(destPath, buffer);
      console.log(`[SAS Upload] Successfully stored file to local disk: ${destPath}`);

      // 2. Respond immediately to client so uploads finish in milliseconds
      res.json({
        success: true,
        url: `/uploads/${uniqueName}`
      });

      // 3. Asynchronously back up to Cloud Firestore in the background (zero blocking)
      if (db && !isFirestoreQuotaExceeded) {
        (async () => {
          try {
            const docRef = doc(db, 'uploadedFiles', uniqueName);
            const binarySize = base64.length * 0.75;
            
            if (base64.length <= 900000) {
              await retrySetDoc(docRef, {
                base64,
                type: type || 'application/octet-stream',
                uploadedAt: new Date().toISOString(),
                isChunked: false
              });
              console.log(`[SAS Firebase Backup] Successfully persisted ${uniqueName} (${Math.round(binarySize / 1024)}KB) to Cloud Firestore.`);
            } else {
              const chunkSize = 750000;
              const totalChunks = Math.ceil(base64.length / chunkSize);
              
              await retrySetDoc(docRef, {
                type: type || 'application/octet-stream',
                uploadedAt: new Date().toISOString(),
                isChunked: true,
                totalChunks
              });

              for (let i = 0; i < totalChunks; i++) {
                if (isFirestoreQuotaExceeded) break;
                const chunkStr = base64.substring(i * chunkSize, (i + 1) * chunkSize);
                const chunkDocRef = doc(db, 'uploadedFileChunks', `${uniqueName}_chunk_${i}`);
                await retrySetDoc(chunkDocRef, {
                  base64Chunk: chunkStr,
                  fileId: uniqueName,
                  chunkIndex: i
                });
              }
              console.log(`[SAS Firebase Chunking] Background backup finished for ${uniqueName}`);
            }
          } catch (fsErr) {
            console.warn(`[SAS Firebase Backup Warning] Background backup skipped/error for ${uniqueName}:`, fsErr);
          }
        })().catch(() => {});
      }
    } catch (error: any) {
      console.error('[SAS Upload Error] Failed to process upload:', error);
      res.status(500).json({ success: false, error: 'Failed to write file to storage' });
    }
  });

  // High-performance offline translation dictionary containing safety, fire-protection, cities, names, and status terms
  const TRANSLATION_DICTIONARY: Record<string, string> = {
    // Cities & Locations
    'الرياض': 'Riyadh',
    'جدة': 'Jeddah',
    'الدمام': 'Dammam',
    'مكة': 'Makkah',
    'المدينة': 'Madinah',
    'الخبر': 'Khobar',
    'الهفوف': 'Hofuf',
    'خميس مشيط': 'Khamis Mushait',
    'الجبيل': 'Jubail',
    'تبوك': 'Tabuk',
    'حائل': 'Hail',
    'نجران': 'Najran',
    'جيزان': 'Jizan',
    'بريدة': 'Buraidah',
    'أبها': 'Abha',
    'القصيم': 'Al-Qassim',
    'الأحساء': 'Al-Ahsa',
    'ينبع': 'Yanbu',
    'الطائف': 'Taif',
    'عرعر': 'Arar',
    'سكاكا': 'Sakaka',
    'الباحة': 'Al-Baha',
    'جازان': 'Jazan',
    
    // Locations / Offices / Branches
    'المقر الرئيسي للمنشأة': 'Main Corporate Headquarters',
    'المقر الرئيسي': 'Main Headquarters',
    'الفرع الرئيسي': 'Main Branch',
    'الفرع الرئيسي للمنشأة': 'Main Branch of the Facility',
    'الفرع': 'Branch',
    'فرع': 'Branch',
    'فروع': 'Branches',
    'مستودع': 'Warehouse',
    'المستودع الرئيسي': 'Main Warehouse',
    'المعرض': 'Showroom',
    'المعرض الرئيسي': 'Main Showroom',
    'المكتب': 'Office',
    'المكتب الرئيسي': 'Main Office',
    'المحطة': 'Station',
    'المصنع': 'Factory',
    'الإدارة': 'Administration',
    'قسم الصيانة': 'Maintenance Department',

    // Fire / Safety Terminology
    'حريق': 'Fire',
    'طفاية': 'Extinguisher',
    'طفايات': 'Extinguishers',
    'طفاية حريق': 'Fire Extinguisher',
    'طفايات حريق': 'Fire Extinguishers',
    'ثاني أكسيد الكربون': 'Carbon Dioxide (CO2)',
    'مسحوق جاف': 'Dry Powder',
    'رغوة': 'Foam',
    'بودرة جافة': 'Dry Powder',
    'بودرة': 'Powder',
    'هالون': 'Halon',
    'ماء': 'Water',
    'كيميائي رطب': 'Wet Chemical',

    // Receipts / Documents / Statuses
    'سند': 'Receipt',
    'سند استلام': 'Handover Receipt',
    'تقرير': 'Report',
    'تقرير فحص': 'Inspection Report',
    'تقرير الصيانة': 'Maintenance Report',
    'تقرير الفحص': 'Inspection Report',
    'فاتورة': 'Invoice',
    'عرض': 'Offer/Quotation',
    'عرض سعر': 'Quotation',
    'أمر عمل': 'Work Order',
    'عقد': 'Contract',

    // Visits & Status
    'زيارة': 'Visit',
    'زيارة طارئة': 'Emergency Visit',
    'زيارة دورية': 'Routine Visit',
    'زيارة فحص': 'Inspection Visit',
    'زيارة صيانة': 'Maintenance Visit',
    'مكتملة': 'Completed',
    'مكتمل': 'Completed',
    'قيد الانتظار': 'Pending',
    'ملغية': 'Cancelled',
    'ملغي': 'Cancelled',
    'مرفوضة': 'Rejected',
    'مرفوض': 'Rejected',
    'مقبولة': 'Accepted',
    'مقبول': 'Accepted',
    'تحت المعالجة': 'Processing',
    'تم الإصلاح': 'Repaired',
    'صيانة': 'Maintenance',
    'فحص': 'Inspection',
    'معاينة': 'Inspection/Survey',

    // Faults & Issues
    'عطل': 'Fault',
    'أعطال': 'Faults',
    'عيوب': 'Defects',
    'العيوب': 'Defects',
    'خلل': 'Malfunction',
    'تسريب': 'Leak',
    'تالف': 'Damaged',
    'مكسور': 'Broken',
    'صدأ': 'Rust',
    'منتهي الصلاحية': 'Expired',
    'غير صالح': 'Invalid/Unfit',
    'صالح': 'Valid/Fit',
    'سليم': 'Safe/Intact',
    'ممتاز': 'Excellent',
    'جيد': 'Good',
    'يحتاج تغيير': 'Needs Replacement',
    'استبدال': 'Replacement',
    'تعبئة': 'Refilling',
    'ضغط منخفض': 'Low Pressure',
    'ضغط مرتفع': 'High Pressure',

    // Common phrases / words
    'ملاحظات': 'Notes',
    'ملاحظات الفني': 'Technician Notes',
    'توصيات': 'Recommendations',
    'تم الفحص والتشغيل': 'Inspected and Operational',
    'تم فحص طفايات الحريق': 'Fire extinguishers have been inspected',
    'تم تعبئة الطفايات': 'Extinguishers have been refilled',
    'لا توجد ملاحظات': 'No notes',
    'كل شيء سليم': 'Everything is intact',
    'الوضع ممتاز': 'Status is excellent',
    'تم تغيير الخرطوم': 'Hose has been replaced',
    'تم تغيير المحبس': 'Valve has been replaced',

    // Roles & People
    'أحمد': 'Ahmed',
    'محمد': 'Muhammad',
    'علي': 'Ali',
    'خالد': 'Khalid',
    'عبدالله': 'Abdullah',
    'يوسف': 'Yousef',
    'عمر': 'Omar',
    'فني': 'Technician',
    'فني صيانة': 'Maintenance Technician',
    'مهندس': 'Engineer',
    'مشرف': 'Supervisor',
    'مشرف الموقع': 'Site Supervisor',
    'المدير': 'Manager',
    'مسؤول': 'Officer/Responsible',
    'مجمع السلامة الوقائية': 'Safety Preventive Complex',
    'شركة نجد': 'Najd Company',
    'مؤسسة السلامة': 'Safety Establishment',
    'شركة نسما': 'Nesma Company',

    // Specific Client Data Entries
    'شركة كفاءة التميز التجارية': 'Kafaat Al-Tamyuz Commercial Company',
    'شارع حراء': 'Hira Street',
    'مؤسسة الرابط الدولي للخدمات التجارية': 'International Link Foundation for Commercial Services',
    'مصنع النجوم الذهبية للصناعة': 'Golden Stars Industry Factory',
    'شركة قصور اللوتس المحدودة': 'Lotus Palaces Company Limited',
    'شركة علامات راقية لتقديم الوجبات': 'Raqia Marks Catering Company',
    'المطبخ الرئيسي': 'Main Kitchen',
    'جدة - عسفان': 'Jeddah - Usfan',
    'حي السلامة': 'Al-Salama District',
    'شركة ابناء محمد موسى بو خمسين': 'Sons of Mohammad Musa Bu Khamsin Company',
  };

  // Helper function to translate a string locally using tokenized lookup
  function localTranslate(text: string | null | undefined): string {
    if (!text || typeof text !== 'string') return '';
    const trimmed = text.trim();
    if (!trimmed) return '';

    // 1. Direct dictionary match
    if (TRANSLATION_DICTIONARY[trimmed]) {
      return TRANSLATION_DICTIONARY[trimmed];
    }

    // 2. Case-insensitive/prefix stripped matching
    const noPrefix = trimmed.replace(/^(ال)/, '');
    if (TRANSLATION_DICTIONARY[noPrefix]) {
      return TRANSLATION_DICTIONARY[noPrefix];
    }

    // 3. Multi-word tokenizer translation
    const words = trimmed.split(/\s+/);
    const translatedWords = words.map(word => {
      // Strip common punctuation for lookup
      const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
      const cleanNoPrefix = cleanWord.replace(/^(ال)/, '');

      const match = TRANSLATION_DICTIONARY[cleanWord] || TRANSLATION_DICTIONARY[cleanNoPrefix];
      if (match) return match;

      // Keep numbers
      if (/^\d+$/.test(cleanWord)) return cleanWord;
      // Keep English words
      if (/^[A-Za-z0-9]+$/.test(cleanWord)) return cleanWord;

      return word; // Fallback to original word
    });

    const assembled = translatedWords.join(' ');
    if (assembled !== trimmed) {
      return assembled;
    }

    // If it's a completely unknown Arabic string, do a transliteration approximation or return a neat label
    return trimmed;
  }

  // Keep track of whether the Gemini API key has been proven invalid to avoid slow subsequent timeouts
  let isGeminiDisabled = false;

  // Helper to translate single text using MyMemory Translation API
  async function translateWithMyMemory(text: string): Promise<string> {
    try {
      const controller = new AbortController();
      // Increase timeout to 12 seconds to handle slow network responses safely
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      
      // Use user's email as registered 'de' parameter to access premium tier limits of 10k words/day without rate limit blockage
      const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ar|en&de=aymanvip700@gmail.com`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const data: any = await response.json();
      if (data && data.responseData && data.responseData.translatedText) {
        const trans = data.responseData.translatedText;
        if (trans && typeof trans === 'string' && trans.trim() !== text.trim() && !/[\u0600-\u06FF]/.test(trans)) {
          return trans.trim();
        }
      }
    } catch (err: any) {
      console.warn(`[SAS MyMemory] Translation error or abort for text "${text}":`, err.message || err);
    }
    return '';
  }

  // High-performance API endpoint to dynamically translate Arabic manual data into English using Gemini or fallback APIs
  app.post('/api/translate', async (req, res) => {
    const { texts } = req.body;
    if (!Array.isArray(texts) || texts.length === 0) {
      res.json({ success: true, translations: [] });
      return;
    }

    const cleanTexts = texts.map(t => typeof t === 'string' ? t.trim() : '');

    // 1. Try resolving using local translation dictionary first (zero latency!)
    const resolvedLocally = cleanTexts.map(tx => {
      const trans = localTranslate(tx);
      // Only count as successfully translated if it's different from the original and does not contain Arabic
      if (trans && trans !== tx && !/[\u0600-\u06FF]/.test(trans)) {
        return trans;
      }
      return null;
    });

    const allResolvedLocally = resolvedLocally.every(t => t !== null);
    if (allResolvedLocally) {
      res.json({ success: true, translations: resolvedLocally });
      return;
    }

    // 2. If Gemini is available and not disabled, try it
    if (ai && !isGeminiDisabled) {
      try {
        const prompt = `You are a professional technical translator for "Nesma First" safety maintenance portal.
Translate the following array of safety records, client names, contract files, locations, branches or supervisor notes from Arabic into professional context-aware English.
Maintain any English words or numbers exactly as they are. Keep professional terms accurate (e.g. "حريق" -> "Fire", "طفاية" -> "Extinguisher", "زيارة" -> "Visit", "عقد" -> "Contract").

Return a JSON array of strings containing the translations in the exact same sequence.
DO NOT add any markdown formatting other than the valid JSON array output.

Input Text List:
${JSON.stringify(cleanTexts)}`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING
              }
            }
          }
        });

        let textOutput = response.text || '';
        console.log(`[SAS Gemini] Translation output received: ${textOutput}`);
        
        if (textOutput.includes('```')) {
          textOutput = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
        }

        if (textOutput && textOutput !== '[]') {
          const decoded = JSON.parse(textOutput);
          if (Array.isArray(decoded)) {
            const validated = decoded.map((trans, idx) => {
              const orig = cleanTexts[idx];
              // Use local dictionary as micro-fallback if Gemini output is invalid or incomplete
              if (!trans || typeof trans !== 'string' || trans.trim() === orig || /[\u0600-\u06FF]/.test(trans)) {
                return resolvedLocally[idx] || localTranslate(orig);
              }
              return trans;
            });
            res.json({ success: true, translations: validated });
            return;
          }
        }
      } catch (error: any) {
        console.error('[SAS Gemini] Exception during translation call. Switching to fallback mode:', error.message);
        // Detect invalid API key to avoid subsequent requests slowing down the server
        if (error.message && (error.message.includes('API key not valid') || error.message.includes('INVALID_ARGUMENT') || error.message.includes('400'))) {
          isGeminiDisabled = true;
          console.warn('[SAS Gemini] Gemini API Key is invalid. Permanently disabled Gemini translation engine for this session.');
        }
      }
    }

    // 3. Fallback: Translate remaining non-dictionary items using MyMemory Translation API sequentially (staggered)
    try {
      console.log(`[SAS Translation Fallback] Using sequential local dict + MyMemory API to translate ${cleanTexts.length} items without triggering concurrent connection aborts.`);
      
      const finalTranslations: string[] = [];
      
      for (let i = 0; i < cleanTexts.length; i++) {
        const orig = cleanTexts[i];
        
        // If already resolved by local dictionary, use it immediately
        if (resolvedLocally[i]) {
          finalTranslations.push(resolvedLocally[i]!);
          continue;
        }

        // Stagger requests slightly to respect rate-limiting and socket concurrency limits
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 150));
        }

        // Try translating with MyMemory Translation API
        const onlineTrans = await translateWithMyMemory(orig);
        if (onlineTrans) {
          finalTranslations.push(onlineTrans);
        } else {
          // Final fallback: use best-effort localTranslate
          finalTranslations.push(localTranslate(orig));
        }
      }

      res.json({ success: true, translations: finalTranslations });
    } catch (fallbackError: any) {
      console.error('[SAS Translation Fallback] Hard crash in MyMemory fallback:', fallbackError);
      const ultimateFallback = cleanTexts.map((orig, idx) => resolvedLocally[idx] || localTranslate(orig));
      res.json({ success: true, translations: ultimateFallback, error: fallbackError.message });
    }
  });

  let lastFsCheckTime = 0;

  // API Router to fetch shared app data
  app.get('/api/data', async (req, res) => {
    // 1. Initial cold start check: load from disk/cloud if not initialized yet
    if (!isDbLoaded || !cachedDbState) {
      console.log('[SAS Cache Miss] Database cache is not loaded yet on fetch, initializing state...');
      await initializeServerState();
    }

    // 2. Cloud sync if forceCloudSync=true or if > 12s since last check
    const wantsForce = req.query.forceCloudSync === 'true';
    const timeSinceLastCheck = Date.now() - lastFsCheckTime;

    if (db && (wantsForce || timeSinceLastCheck > 12000)) {
      lastFsCheckTime = Date.now();
      try {
        const remoteState = await readDatabaseFS();
        if (remoteState) {
          const remoteTime = remoteState.updatedAt || '';
          const currentTime = cachedDbState?.updatedAt || '';
          const remoteClientCount = Array.isArray(remoteState.clients) ? remoteState.clients.length : 0;
          const currentClientCount = Array.isArray(cachedDbState?.clients) ? cachedDbState.clients.length : 0;
          
          if (remoteTime > currentTime || remoteClientCount > currentClientCount) {
            console.log(`[SAS Cloud Sync] Remote Firestore state adopted (remote clients: ${remoteClientCount}, local clients: ${currentClientCount})`);
            cachedDbState = mergeDatabase(cachedDbState, remoteState);
            isDbLoaded = true;
            writeDatabase(cachedDbState);
          }
        }
      } catch (fsErr) {
        console.warn('[SAS Cache Poll] Non-fatal Firestore refresh warning:', fsErr);
      }
    }
    
    if (cachedDbState) {
      res.json({ success: true, data: cachedDbState });
    } else {
      res.json({ success: false, message: 'Database state could not be read from cloud or local disk.' });
    }
  });

  // API Router to save / update shared app data
  app.post('/api/data', async (req, res) => {
    try {
      const payload = req.body;
      if (!payload || typeof payload !== 'object') {
        res.status(400).json({ success: false, error: 'Empty or invalid payload' });
        return;
      }

      // Helper: Convert any embedded Base64 dataURL to a separate durable hosted file on disk and Cloud Firestore (Regex-free for performance)
      async function saveBase64ToFileAndCloud(dataUrl: string): Promise<string> {
        if (!dataUrl.startsWith('data:')) return dataUrl;
        const commaIndex = dataUrl.indexOf(',');
        if (commaIndex === -1) return dataUrl;

        const meta = dataUrl.substring(0, commaIndex);
        if (!meta.includes(';base64')) return dataUrl;

        const mimeMatch = meta.match(/^data:([^;]+)/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        const base64 = dataUrl.substring(commaIndex + 1).trim();
        if (!base64) return dataUrl;

        let ext = '.bin';
        if (mimeType.includes('png')) ext = '.png';
        else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = '.jpg';
        else if (mimeType.includes('gif')) ext = '.gif';
        else if (mimeType.includes('webp')) ext = '.webp';
        else if (mimeType.includes('pdf')) ext = '.pdf';
        else if (mimeType.includes('mp4') || mimeType.includes('video') || mimeType.includes('quicktime') || mimeType.includes('mov')) ext = '.mp4';
        else if (mimeType.includes('webm')) ext = '.webm';
        else if (mimeType.includes('ogg')) ext = '.ogg';

        const uniqueName = `auto_upload_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
        const localPath = path.join(UPLOADS_DIR, uniqueName);
        
        try {
          const buffer = Buffer.from(base64, 'base64');
          fs.writeFileSync(localPath, buffer);
          console.log(`[Auto Base64 Extractor] Saved asset locally to: ${localPath}`);

          if (db && !isFirestoreQuotaExceeded) {
            // Backup to Firestore in the background asynchronously to avoid blocking the main HTTP response thread
            (async () => {
              try {
                const docRef = doc(db, 'uploadedFiles', uniqueName);
                if (base64.length <= 900000) {
                  await retrySetDoc(docRef, {
                    base64,
                    type: mimeType,
                    uploadedAt: new Date().toISOString(),
                    isChunked: false
                  });
                  console.log(`[Auto Base64 Extractor Cloud] Saved single doc ${uniqueName} to Firestore in background.`);
                } else if (base64.length <= 3000000) {
                  const chunkSize = 750000;
                  const totalChunks = Math.ceil(base64.length / chunkSize);
                  await retrySetDoc(docRef, {
                    type: mimeType,
                    uploadedAt: new Date().toISOString(),
                    isChunked: true,
                    totalChunks
                  });
                  for (let i = 0; i < totalChunks; i++) {
                    const chunkStr = base64.substring(i * chunkSize, (i + 1) * chunkSize);
                    const chunkDocRef = doc(db, 'uploadedFileChunks', `${uniqueName}_chunk_${i}`);
                    await retrySetDoc(chunkDocRef, {
                      base64Chunk: chunkStr,
                      fileId: uniqueName,
                      chunkIndex: i
                    });
                  }
                  console.log(`[Auto Base64 Extractor Cloud] Saved chunked ${uniqueName} to Firestore (${totalChunks} chunks) in background.`);
                }
              } catch (backupErr) {
                console.warn(`[Auto Base64 Extractor Cloud Warning] Failed background backup for ${uniqueName}:`, backupErr);
              }
            })();
          }
          return `/uploads/${uniqueName}`;
        } catch (err) {
          console.error('[Auto Base64 Extractor Error] Failed to save and back up asset:', err);
          return dataUrl;
        }
      }

      // Helper: Recursively walk object keys and extract Base64 data URLs in-place for maximum performance
      async function processBase64FieldsRecursively(obj: any): Promise<any> {
        if (!obj) return obj;
        
        if (typeof obj === 'string') {
          if (obj.startsWith('data:') && obj.includes(';base64,')) {
            return await saveBase64ToFileAndCloud(obj);
          }
          return obj;
        }
        
        if (Array.isArray(obj)) {
          for (let i = 0; i < obj.length; i++) {
            obj[i] = await processBase64FieldsRecursively(obj[i]);
          }
          return obj;
        }
        
        if (typeof obj === 'object') {
          for (const key of Object.keys(obj)) {
            obj[key] = await processBase64FieldsRecursively(obj[key]);
          }
          return obj;
        }
        
        return obj;
      }
      
      // Fetch latest master state from the in-memory cache, fallback to disk/Firestore if not loaded yet
      if (!isDbLoaded || !cachedDbState) {
        console.log('[SAS Cache Miss] Database cache is not loaded yet on save, initializing state...');
        await initializeServerState();
      }
      
      // Check if this is an explicit wipe or force replacement from a backup import
      const isForceReplace = payload.forceReplace === true || payload.isWipe === true;
      let targetDB: any;

      if (isForceReplace) {
        console.log(`[SAS State Engine] Executing FORCE REPLACE / WIPE (isWipe=${payload.isWipe === true}). Overwriting master state completely.`);
        targetDB = {
          clients: Array.isArray(payload.clients) ? payload.clients : [],
          visits: Array.isArray(payload.visits) ? payload.visits : [],
          technicians: Array.isArray(payload.technicians) ? payload.technicians : [],
          daysBeforeVisitAlert: payload.daysBeforeVisitAlert ?? 2,
          notificationLogs: Array.isArray(payload.notificationLogs) ? payload.notificationLogs : [],
          quotations: Array.isArray(payload.quotations) ? payload.quotations : [],
          emergencyVisits: Array.isArray(payload.emergencyVisits) ? payload.emergencyVisits : [],
          deletedVisitIds: Array.isArray(payload.deletedVisitIds) ? payload.deletedVisitIds : [],
          extinguisherReceipts: Array.isArray(payload.extinguisherReceipts) ? payload.extinguisherReceipts : [],
          companyBranches: Array.isArray(payload.companyBranches) && payload.companyBranches.length > 0
            ? payload.companyBranches.map((b: any) => b.id === 'hq' ? { ...b, name: 'المقر الرئيسي' } : b)
            : (cachedDbState?.companyBranches || [{ id: 'hq', name: 'المقر الرئيسي', city: 'جدة', createdAt: new Date().toISOString() }]),
          managerPhone: payload.managerPhone || cachedDbState?.managerPhone || '0555012345',
          managerEmail: payload.managerEmail || cachedDbState?.managerEmail || 'maintenance-admin@sas-safety.com',
          adminUsername: payload.adminUsername || cachedDbState?.adminUsername || 'admin',
          adminPassword: payload.adminPassword || cachedDbState?.adminPassword || '123',
          adminName: payload.adminName || cachedDbState?.adminName || 'المشرف العام',
          maintenanceModeEnabled: payload.maintenanceModeEnabled === true,
          companyName: payload.companyName || cachedDbState?.companyName || 'شركة نسما الأولى لمعدات السلامة',
          companyUnified: payload.companyUnified || cachedDbState?.companyUnified || '7003489890',
          companyPhone: payload.companyPhone || cachedDbState?.companyPhone || '0555012345',
          companyEmail: payload.companyEmail || cachedDbState?.companyEmail || 'maintenance-admin@sas-safety.com',
          companyTaxId: payload.companyTaxId || cachedDbState?.companyTaxId || '310456789000003',
          companyAddress: payload.companyAddress || cachedDbState?.companyAddress || 'جدة، المملكة العربية السعودية',
          smtpHost: payload.smtpHost !== undefined ? payload.smtpHost : (cachedDbState?.smtpHost || ''),
          smtpPort: payload.smtpPort !== undefined ? payload.smtpPort : (cachedDbState?.smtpPort || ''),
          smtpUser: payload.smtpUser !== undefined ? payload.smtpUser : (cachedDbState?.smtpUser || ''),
          smtpPass: payload.smtpPass !== undefined ? payload.smtpPass : (cachedDbState?.smtpPass || ''),
          smtpFromEmail: payload.smtpFromEmail !== undefined ? payload.smtpFromEmail : (cachedDbState?.smtpFromEmail || ''),
          smtpEnabled: payload.smtpEnabled !== undefined ? payload.smtpEnabled === true : true,
          systemMode: payload.systemMode || cachedDbState?.systemMode || 'hq',
          independentBranchId: payload.independentBranchId || cachedDbState?.independentBranchId || '',
          apiAccessToken: payload.apiAccessToken || cachedDbState?.apiAccessToken || '',
          linkedBranches: payload.linkedBranches || cachedDbState?.linkedBranches || [],
          customization: payload.customization || cachedDbState?.customization || null,
          isWiped: payload.isWipe === true,
          lastWipeAt: payload.isWipe === true ? new Date().toISOString() : (cachedDbState?.lastWipeAt || null),
          lastImportAt: payload.forceReplace === true ? new Date().toISOString() : (cachedDbState?.lastImportAt || null)
        };
      } else {
        targetDB = mergeDatabase(cachedDbState, payload);
      }
      
      // Process state recursively to extract and host any Base64 strings (signatures, photos, attachments)
      const processedTargetDB = await processBase64FieldsRecursively(targetDB);
      const cleanTargetDB = sanitizeForFirestore(processedTargetDB);
      cleanTargetDB.updatedAt = new Date().toISOString();
      
      // Update the local in-memory cache with the new master state
      cachedDbState = cleanTargetDB;
      isDbLoaded = true;
      
      // Save to local disk (lightning fast)
      const localOk = writeDatabase(cleanTargetDB);
      
      // Save to Firestore in the background via debounced queue (instant HTTP response, zero blocking)
      if (db) {
        queueFirestoreWrite(cleanTargetDB).catch(err => {
          console.warn('[SAS Firestore Queue Error]', err);
        });
      }
      
      if (localOk) {
        res.json({ 
          success: true, 
          message: isForceReplace ? 'Database force replaced/wiped successfully.' : 'Updated global server state locally and scheduled cloud synchronization.',
          isWiped: targetDB.isWiped === true
        });
      } else {
        res.status(500).json({ success: false, error: 'Failed to write data state to any persistent storage.' });
      }
    } catch (routeErr: any) {
      console.error('[SAS API Error] Critical failure in /api/data POST handler:', routeErr);
      res.status(500).json({ success: false, error: routeErr.message || String(routeErr) });
    }
  });

  // Dedicated API endpoint to completely wipe operational data from both local disk and Cloud Firestore
  app.post('/api/wipe-database', async (req, res) => {
    try {
      console.log('[SAS API] Received full wipe request for database...');
      
      // Keep administrator account and system identity so users can still log in and operate
      const cleanState: any = {
        clients: [],
        visits: [],
        technicians: [
          {
            id: 'admin_root',
            name: cachedDbState?.adminName || 'المشرف العام',
            username: cachedDbState?.adminUsername || 'admin',
            password: cachedDbState?.adminPassword || '123',
            role: 'admin',
            permissions: {
              manageClients: true,
              manageQuotes: true,
              manageTechnicians: true,
              wipeDatabase: true
            }
          }
        ],
        daysBeforeVisitAlert: 2,
        notificationLogs: [],
        quotations: [],
        emergencyVisits: [],
        deletedVisitIds: [],
        extinguisherReceipts: [],
        companyBranches: [
          {
            id: 'hq',
            name: 'المقر الرئيسي',
            city: 'جدة',
            createdAt: new Date().toISOString()
          }
        ],
        managerPhone: cachedDbState?.managerPhone || '0555012345',
        managerEmail: cachedDbState?.managerEmail || 'maintenance-admin@sas-safety.com',
        adminUsername: cachedDbState?.adminUsername || 'admin',
        adminPassword: cachedDbState?.adminPassword || '123',
        adminName: cachedDbState?.adminName || 'المشرف العام',
        maintenanceModeEnabled: false,
        companyName: cachedDbState?.companyName || 'شركة نسما الأولى لمعدات السلامة',
        companyUnified: cachedDbState?.companyUnified || '7003489890',
        companyPhone: cachedDbState?.companyPhone || '0555012345',
        companyEmail: cachedDbState?.companyEmail || 'maintenance-admin@sas-safety.com',
        companyTaxId: cachedDbState?.companyTaxId || '310456789000003',
        companyAddress: cachedDbState?.companyAddress || 'جدة، المملكة العربية السعودية',
        smtpHost: cachedDbState?.smtpHost || '',
        smtpPort: cachedDbState?.smtpPort || '',
        smtpUser: cachedDbState?.smtpUser || '',
        smtpPass: cachedDbState?.smtpPass || '',
        smtpFromEmail: cachedDbState?.smtpFromEmail || '',
        smtpEnabled: cachedDbState?.smtpEnabled !== false,
        systemMode: 'hq',
        independentBranchId: '',
        apiAccessToken: '',
        linkedBranches: [],
        customization: cachedDbState?.customization || null,
        isWiped: true,
        lastWipeAt: new Date().toISOString()
      };

      cachedDbState = cleanState;
      isDbLoaded = true;

      // 1. Write to local database.json
      writeDatabase(cleanState);

      // 2. Synchronously write to Cloud Firestore
      if (db) {
        try {
          await writeDatabaseFS(cleanState);
          console.log('[SAS Firestore] Cloud Firestore database successfully wiped and set to clean template.');
        } catch (fsErr) {
          console.error('[SAS Firestore] Failed to wipe Cloud Firestore directly, queuing...', fsErr);
          queueFirestoreWrite(cleanState).catch(() => {});
        }
      }

      res.json({
        success: true,
        message: 'تم تصفير ومسح قاعدة البيانات السحابية والمحلية بنجاح. النظام جاهز تماماً لاستيراد النسخة الاحتياطية.',
        data: cleanState
      });
    } catch (wipeErr: any) {
      console.error('[SAS API Error] Failed to execute wipe-database:', wipeErr);
      res.status(500).json({ success: false, error: wipeErr.message || String(wipeErr) });
    }
  });

  // Helper for normalizing phone numbers to E.164 state (especially Saudi numbers)
  function normalizePhoneNumber(phone: string): string {
    if (!phone) return '';
    let isWhatsapp = false;
    let rawPhone = phone.trim();
    if (rawPhone.toLowerCase().startsWith('whatsapp:')) {
      isWhatsapp = true;
      rawPhone = rawPhone.slice(9).trim();
    }
    
    // Strip all non-numeric characters except +
    let cleaned = rawPhone.replace(/[^\d+]/g, '');
    
    if (cleaned.startsWith('00')) {
      cleaned = '+' + cleaned.slice(2);
    }
    
    // Standard Saudi normalization: convert 05xxxxxxxx to +9665xxxxxxxx
    if (cleaned.startsWith('05') && cleaned.length === 10) {
      cleaned = '+966' + cleaned.slice(1);
    } else if (cleaned.startsWith('5') && cleaned.length === 9) {
      cleaned = '+966' + cleaned;
    } else if (!cleaned.startsWith('+') && cleaned.startsWith('966')) {
      cleaned = '+' + cleaned;
    } else if (!cleaned.startsWith('+') && cleaned.length === 9) {
      cleaned = '+966' + cleaned;
    }
    
    return isWhatsapp ? `whatsapp:${cleaned}` : cleaned;
  }

  // API router for dispatching SMS notifications
  app.post('/api/send-sms', async (req, res) => {
    const { to: rawTo, text } = req.body;

    if (!rawTo || !text) {
      res.status(400).json({ success: false, error: 'Recipient phone number and text are required.' });
      return;
    }

    const accountSid = (req.body.twilioSid || process.env.TWILIO_ACCOUNT_SID || '').trim();
    const authToken = (req.body.twilioToken || process.env.TWILIO_AUTH_TOKEN || '').trim();
    const rawFrom = (req.body.twilioPhone || process.env.TWILIO_PHONE_NUMBER || '').trim();

    let to = normalizePhoneNumber(rawTo);
    let fromNumber = normalizePhoneNumber(rawFrom);

    // Dynamic routing: If Twilio sender is whatsapp:, the recipient must also have whatsapp: prefix
    if (fromNumber.toLowerCase().startsWith('whatsapp:') && !to.toLowerCase().startsWith('whatsapp:')) {
      to = `whatsapp:${to}`;
    }

    console.log(`[Notification Alert] Preparing to send to ${to} from ${fromNumber}: "${text}"`);

    // Verify if Twilio credentials are set
    if (accountSid && authToken && fromNumber) {
      try {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        
        // Encode phone number & parameters
        const params = new URLSearchParams();
        params.append('To', to);
        params.append('From', fromNumber);
        params.append('Body', text);

        // Basic Base64 Auth
        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: params.toString()
        });

        const data = await response.json() as any;

        if (response.ok) {
          console.log(`[SMS Gateway] Twilio dispatch succeeded. SID: ${data.sid}`);
          res.json({ 
            success: true, 
            simulated: false, 
            sid: data.sid, 
            message: `SMS Sent successfully to ${to} via Twilio.` 
          });
          return;
        } else {
          console.error(`[SMS Gateway] Twilio Error:`, data);
          // Extract specific human-friendly errors from Twilio
          const twilioCode = data.code ? `(Code ${data.code})` : '';
          const detail = data.message || JSON.stringify(data);
          res.status(400).json({ 
            success: false, 
            error: `${detail} ${twilioCode}`,
            simulated: false,
            message: `Twilio Error: ${detail}`
          });
          return;
        }
      } catch (err: any) {
        console.error(`[SMS Gateway] Exception raised:`, err);
        res.status(500).json({ 
          success: false, 
          error: err.message || 'Unknown network error.',
          simulated: false,
          message: `Network failure connecting to Twilio Gateway.`
        });
        return;
      }
    } else {
      // Return beautiful sandbox/simulation acknowledgement
      console.log(`[SMS Gateway] No Twilio credentials in environment. Simulating SMS dispatch to ${to}...`);
      res.json({
        success: true,
        simulated: true,
        message: `تمت المحاكاة والإرسال الرقمي بنجاح إلى ${to}. لتفعيل الإرسال الحقيقي للجوال، يرجى تزويد مفاتيح Twilio في ملف الإعدادات.`
      });
    }
  });

  // API router for dispatching WhatsApp notifications
  app.post('/api/send-whatsapp', async (req, res) => {
    const { to: rawTo, text } = req.body;
    const instanceId = (req.body.instanceId || process.env.WHATSAPP_INSTANCE_ID || '').trim();
    const token = (req.body.token || process.env.WHATSAPP_TOKEN || '').trim();
    const gatewayUrl = (req.body.gatewayUrl || process.env.WHATSAPP_GATEWAY || 'https://api.ultramsg.com/v1/messages/chat').trim();

    if (!rawTo || !text) {
      res.status(400).json({ success: false, error: 'Recipient number and message body are required' });
      return;
    }

    let to = normalizePhoneNumber(rawTo);
    // Remove "whatsapp:" if present in E.164 for generic gateways, but keep for formatting if needed
    let cleanTo = to.replace('whatsapp:', '');

    console.log(`[WhatsApp Gateway] Preparing WhatsApp message to ${cleanTo} using Instance: ${instanceId}. Text: "${text}"`);

    // Verify if UltraMsg or target gateway credentials are set
    if (instanceId && token) {
      try {
        // Build post parameters
        // For UltraMsg, parameters are usually form-urlencoded or JSON: to, body, token
        const finalUrl = gatewayUrl.includes('ultramsg.com') && !gatewayUrl.includes(instanceId)
          ? `https://api.ultramsg.com/${instanceId}/messages/chat`
          : gatewayUrl;

        const bodyData = {
          token: token,
          to: cleanTo,
          body: text
        };

        const response = await fetch(finalUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bodyData)
        });

        const data = await response.json() as any;

        if (response.ok && (data.sent || data.success || data.id)) {
          console.log(`[WhatsApp Gateway] Dispatch Succeeded. Msg ID: ${data.id || data.sent}`);
          res.json({
            success: true,
            simulated: false,
            message: `WhatsApp message dispatched successfully to ${cleanTo}.`,
            data
          });
          return;
        } else {
          console.error(`[WhatsApp Gateway] API Response Error:`, data);
          res.status(400).json({
            success: false,
            error: data.error || data.message || 'API responded with error status.',
            simulated: false
          });
          return;
        }
      } catch (err: any) {
        console.error(`[WhatsApp Gateway] Network exception raised:`, err);
        res.status(500).json({
          success: false,
          error: err.message || 'Unknown network error.',
          simulated: false
        });
        return;
      }
    } else {
      console.log(`[WhatsApp Gateway] No credentials in environment/local storage. Simulating WhatsApp dispatch...`);
      res.json({
        success: true,
        simulated: true,
        message: `تم إرسال رسالة الواتس اب (محاكاة) بنجاح إلى ${cleanTo}. لتشغيل الإرسال الفعلي التلقائي عبر UltraMsg/WhatsLoop، يرجى تعيين معرف المنصة ومفتاح الوصول (Token) في الإعدادات.`
      });
    }
  });

  // API router for dispatching Email notifications with client complaints & alerts
  app.post('/api/send-email', async (req, res) => {
    const { to, subject, text } = req.body;

    if (!to || !text) {
      res.status(400).json({ success: false, error: 'Recipient email address and message body are required.' });
      return;
    }

    console.log(`[Email Gateway] Forwarding Client Complaint to Admin [${to}]: "${subject}"`);
    console.log(`[Email Content]:\n${text}\n`);

    const smtpHost = req.body.smtpHost || process.env.SMTP_HOST;
    const smtpPort = req.body.smtpPort || process.env.SMTP_PORT;
    const smtpUser = req.body.smtpUser || process.env.SMTP_USER;
    const smtpPass = req.body.smtpPass || process.env.SMTP_PASS;
    const smtpFrom = req.body.smtpFromEmail || process.env.SMTP_FROM_EMAIL || smtpUser;

    if (smtpHost && smtpPort && smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(smtpPort, 10),
          secure: smtpPort === '465', // True for SSL on port 465, false for 587/other
          auth: {
            user: smtpUser,
            pass: smtpPass
          },
          tls: {
            rejectUnauthorized: false
          }
        });

        const mailOptions = {
          from: `"شركة نسما الأولى" <${smtpFrom}>`,
          to: to,
          subject: subject,
          text: text,
          html: `
            <div dir="rtl" style="font-family: Arial, sans-serif; padding: 25px; background-color: #f8fafc; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); text-align: right; max-width: 600px; margin: auto; border: 1px solid #e2e8f0;">
              <header style="border-bottom: 2px solid #ea580c; padding-bottom: 12px; margin-bottom: 20px;">
                <h2 style="color: #1e293b; margin: 0; font-size: 1.4rem;">🚨 شركة نسما الأولى - بوابة الإشعارات والتحقق</h2>
              </header>
              <article style="font-size: 1.05rem; color: #334155; line-height: 1.7;">
                ${text.replace(/\n/g, '<br/>')}
              </article>
              <footer style="margin-top: 30px; padding-top: 15px; border-top: 1px dashed #cbd5e1; font-size: 0.85rem; color: #64748b; text-align: center;">
                - هذا البريد مرسل تلقائياً من بوابة الاشعارات والتحقق لشركة نسما الاولى -
              </footer>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log(`[Email Gateway] Successfully sent real email via SMTP to ${to}`);
        
        res.json({
          success: true,
          simulated: false,
          message: `تم إرسال إشعار بريد إلكتروني حقيقي بنجاح إلى البريد الإلكتروني للمسؤول: ${to}`
        });
        return;
      } catch (err: any) {
        console.error(`[Email Gateway] Failed to dispatch real SMTP email:`, err);
        res.json({
          success: true,
          simulated: true,
          error: err.message,
          message: `فشل الإرسال الحقيقي عبر SMTP (${err.message}). تم محاكاة الإرسال محلياً وتدوينه في النظام لضمان استمرارية العمل لبريد: ${to}`
        });
        return;
      }
    } else {
      // Return sandbox fallback indicator
      console.log(`[Email Gateway] SMTP is not configured. Simulating dispatch to ${to}...`);
      res.json({
        success: true,
        simulated: true,
        message: `تم إرسال إشعار بريد إلكتروني محاكى بنجاح ومزامنته في النظام إلى: ${to}. لتفعيل إرسال حقيقي رسمي ومباشر، يرجى ملء بيانات SMTP في ملف الإعدادات.`
      });
    }
  });

  // Secure cross-branch API endpoint for retrieving local database remotely
  app.get('/api/external-data', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = cachedDbState?.apiAccessToken;
    
    if (!token || !authHeader || authHeader !== `Bearer ${token}`) {
      console.warn('[SAS Security] Unauthorized external-data access attempt.');
      res.status(401).json({ success: false, error: 'Unauthorized or invalid API access token.' });
      return;
    }

    console.log('[SAS Security] Authorized external-data access: returning database snapshot.');
    res.json({ success: true, data: cachedDbState });
  });

  // Proxy endpoint to fetch remote branch data server-side to avoid CORS restrictions
  app.post('/api/proxy-branch-data', async (req, res) => {
    const { targetUrl, accessToken } = req.body;
    if (!targetUrl || !accessToken) {
      res.status(400).json({ success: false, error: 'Both targetUrl and accessToken are required.' });
      return;
    }

    try {
      // Normalize URL and append API path
      let cleanUrl = targetUrl.trim();
      if (cleanUrl.endsWith('/')) {
        cleanUrl = cleanUrl.slice(0, -1);
      }
      const remoteEndpoint = `${cleanUrl}/api/external-data`;
      console.log(`[SAS Proxy] Forwarding request to remote branch: ${remoteEndpoint}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(remoteEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[SAS Proxy] Remote branch responded with status ${response.status}: ${errorText}`);
        res.status(response.status).json({ success: false, error: `Remote branch error: ${response.statusText}` });
        return;
      }

      const remoteJson = await response.json() as any;
      res.json(remoteJson);
    } catch (err: any) {
      console.error('[SAS Proxy] Proxy exception:', err);
      res.status(502).json({ success: false, error: `Failed to connect to remote branch: ${err.message || err}` });
    }
  });

  // Support custom shortened paths containing company brand name/acronym (Nesma First)
  // These map back to root smoothly preserving all query params (like login tokens u and p)
  const handleShortRedirect = (req: express.Request, res: express.Response) => {
    const urlParts = req.url.split('?');
    const queryString = urlParts.length > 1 ? '?' + urlParts[1] : '';
    console.log(`[SAS Shortlink] Redirecting branded shortcut "${req.path}" directly to the root application...`);
    res.redirect('/' + queryString);
  };

  app.get('/nesmafirst', handleShortRedirect);
  app.get('/nesma', handleShortRedirect);
  app.get('/n', handleShortRedirect);

  // Serve static assets or mount Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Dynamic HTML transformation catch-all for SPA sub-routes (e.g. /direct/*) in development mode
    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      // Guard: If it is of interest to uploads or API, return 404 instead of index.html fallback
      if (url.startsWith('/uploads/') || url.startsWith('/api/')) {
        res.status(404).send('File or service endpoint not found / مستند أو خدمة غير متوفرة');
        return;
      }

      try {
        let template = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const url = req.originalUrl;
      // Guard: If it is of interest to uploads or API, return 404 instead of index.html fallback
      if (url.startsWith('/uploads/') || url.startsWith('/api/')) {
        res.status(404).send('File or service endpoint not found / مستند أو خدمة غير متوفرة');
        return;
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Pre-load and cache the database state from Firestore/Local JSON on startup
  try {
    await initializeServerState();

    // Register real-time background snapshot listener from Firestore to synchronize multiple container instances (AI Studio Dev + Shared Preview revisions)
    if (db) {
      try {
        const docRef = doc(db, 'appState', 'global');
        onSnapshot(docRef, async (snapshot) => {
          if (snapshot.exists()) {
            let remoteData = snapshot.data();
            if (remoteData?.isChunked === true && typeof remoteData?.totalChunks === 'number') {
              try {
                let assembledStr = '';
                for (let i = 0; i < remoteData.totalChunks; i++) {
                  const chunkSnap = await getDoc(doc(db, 'appState', `chunk_${i}`));
                  if (chunkSnap.exists()) {
                    assembledStr += chunkSnap.data().content || '';
                  }
                }
                remoteData = JSON.parse(assembledStr);
              } catch (chunkErr) {
                console.error('[SAS Firestore Sync] Failed assembling chunked snapshot:', chunkErr);
                return;
              }
            }
            const remoteStr = JSON.stringify(remoteData);
            const localStr = JSON.stringify(cachedDbState);
            
            if (remoteStr !== localStr) {
              console.log('[SAS Firestore Sync] Real-time master state updated in Firestore. Syncing container cache...');
              cachedDbState = remoteData;
              isDbLoaded = true;
              writeDatabase(remoteData);
            }
          }
        }, (error) => {
          console.warn('[SAS Firestore Sync Warning] Real-time snapshot listener re-establishing connection:', error?.message || error);
        });
      } catch (listenerErr) {
        console.error('[SAS Firestore Sync] Failed to register real-time Firestore listener:', listenerErr);
      }
    }
  } catch (initErr) {
    console.error('[SAS Startup Error] Failed to initialize state cache on boot:', initErr);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SAS Server] Ready and running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[SAS Startup Error] Failed to boot full-stack server:', err);
});
