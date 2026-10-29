import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  setDoc,
  deleteDoc,
  updateDoc,
  getDocFromServer,
  serverTimestamp,
  writeBatch,
  FieldValue,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export { firebaseConfig };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<{ success: boolean; message: string }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { success: true, message: 'Firebase Firestore connected successfully!' };
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      return { success: false, message: 'Client is offline. Please check your network or Firebase configuration.' };
    }
    // "permission-denied" or "not-found" means reached server
    return { success: true, message: 'Firebase Firestore endpoint reached.' };
  }
}

export interface DataRecord {
  id: string;
  title: string;
  category: string;
  payload: string;
  status: 'pending' | 'processed' | 'archived';
  source?: string;
  createdBy: string;
  createdAt: Timestamp | FieldValue | Date | null;
  updatedAt: Timestamp | FieldValue | Date | null;
}

export interface SystemLog {
  id: string;
  eventType: string;
  details: string;
  createdBy: string;
  createdAt: Timestamp | FieldValue | Date | null;
}

// Helper to generate clean IDs matching ^[a-zA-Z0-9_\-]+$
export function generateValidId(prefix = 'doc'): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '');
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${cleanPrefix}_${timestamp}_${randomStr}`;
}

export async function loginWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google Sign In Error:', error);
    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

// Add a secure record
export async function addRecord(data: {
  title: string;
  category: string;
  payload: string;
  status: 'pending' | 'processed' | 'archived';
  source?: string;
}): Promise<string> {
  if (!auth.currentUser) {
    throw new Error('User must be signed in to add records.');
  }

  const recordId = generateValidId('rec');
  const path = `records/${recordId}`;

  const newRecord = {
    title: data.title.trim().slice(0, 200),
    category: data.category.trim().slice(0, 100),
    payload: data.payload.slice(0, 50000),
    status: data.status,
    ...(data.source ? { source: data.source.trim().slice(0, 100) } : {}),
    createdBy: auth.currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'records', recordId), newRecord);

    // Also record system log
    try {
      const logId = generateValidId('log');
      await setDoc(doc(db, 'system_logs', logId), {
        eventType: 'RECORD_CREATED',
        details: `Created record: ${newRecord.title} [${recordId}]`,
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });
    } catch (logErr) {
      console.warn('Could not write audit log:', logErr);
    }

    return recordId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// Update an existing record
export async function updateRecord(
  recordId: string,
  existingRecord: DataRecord,
  updates: {
    title?: string;
    category?: string;
    payload?: string;
    status?: 'pending' | 'processed' | 'archived';
    source?: string;
  }
): Promise<void> {
  if (!auth.currentUser) throw new Error('Not signed in');
  const path = `records/${recordId}`;

  const updatedData: Record<string, any> = {
    title: (updates.title ?? existingRecord.title).trim().slice(0, 200),
    category: (updates.category ?? existingRecord.category).trim().slice(0, 100),
    payload: (updates.payload ?? existingRecord.payload).slice(0, 50000),
    status: updates.status ?? existingRecord.status,
    updatedAt: serverTimestamp(),
  };

  if (updates.source !== undefined) {
    if (updates.source) {
      updatedData.source = updates.source.trim().slice(0, 100);
    }
  } else if (existingRecord.source) {
    updatedData.source = existingRecord.source;
  }

  try {
    await updateDoc(doc(db, 'records', recordId), updatedData);

    try {
      const logId = generateValidId('log');
      await setDoc(doc(db, 'system_logs', logId), {
        eventType: 'RECORD_UPDATED',
        details: `Updated record ID: ${recordId}`,
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });
    } catch {
      // ignore
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Delete record
export async function removeRecord(recordId: string): Promise<void> {
  if (!auth.currentUser) throw new Error('Not signed in');
  const path = `records/${recordId}`;
  try {
    await deleteDoc(doc(db, 'records', recordId));

    try {
      const logId = generateValidId('log');
      await setDoc(doc(db, 'system_logs', logId), {
        eventType: 'RECORD_DELETED',
        details: `Deleted record ID: ${recordId}`,
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });
    } catch {
      // ignore
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Bulk migration helper
export async function importBulkCollection(
  collectionName: 'clients' | 'contracts' | 'visits' | 'reports' | 'proposals' | 'records',
  rawItems: any[]
): Promise<{ success: boolean; count: number; error?: string }> {
  if (!auth.currentUser) throw new Error('يرجى تسجيل الدخول بحسابك أولاً لتنفيذ الترحيل');
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { success: false, count: 0, error: 'المصفوفة فارغة أو غير صالحة' };
  }

  const uid = auth.currentUser.uid;
  let totalImported = 0;

  // Process in batches of 400 (Firestore max is 500)
  const batchSize = 400;
  for (let i = 0; i < rawItems.length; i += batchSize) {
    const chunk = rawItems.slice(i, i + batchSize);
    const batch = writeBatch(db);

    for (const item of chunk) {
      const rawId = item.id || item._id || item.docId;
      const cleanId = rawId && typeof rawId === 'string' && /^[a-zA-Z0-9_-]+$/.test(rawId)
        ? rawId
        : generateValidId(collectionName.slice(0, 3));

      const docRef = doc(db, collectionName, cleanId);

      // Clean item and attach audit fields
      const recordPayload: Record<string, any> = {
        ...item,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Strip potential conflicting metadata
      delete recordPayload.id;
      delete recordPayload._id;

      // Provide defaults per collection if missing
      if (collectionName === 'clients') {
        recordPayload.name = String(recordPayload.name || recordPayload.clientName || 'عميل بدون اسم').slice(0, 200);
        recordPayload.status = ['active', 'inactive', 'lead'].includes(recordPayload.status) ? recordPayload.status : 'active';
        if (recordPayload.phone) recordPayload.phone = String(recordPayload.phone).slice(0, 50);
        if (recordPayload.email) recordPayload.email = String(recordPayload.email).slice(0, 150);
      } else if (collectionName === 'contracts') {
        recordPayload.title = String(recordPayload.title || 'عقد جديد').slice(0, 200);
        recordPayload.status = ['active', 'pending', 'completed', 'cancelled'].includes(recordPayload.status) ? recordPayload.status : 'active';
      } else if (collectionName === 'visits') {
        recordPayload.purpose = String(recordPayload.purpose || 'زيارة عمل').slice(0, 300);
        recordPayload.status = ['scheduled', 'completed', 'cancelled'].includes(recordPayload.status) ? recordPayload.status : 'completed';
      } else if (collectionName === 'reports') {
        recordPayload.title = String(recordPayload.title || 'تقرير').slice(0, 250);
        recordPayload.reportType = String(recordPayload.reportType || recordPayload.type || 'عام').slice(0, 100);
        recordPayload.content = String(recordPayload.content || recordPayload.details || '').slice(0, 50000);
        recordPayload.status = ['draft', 'published', 'archived'].includes(recordPayload.status) ? recordPayload.status : 'published';
      } else if (collectionName === 'proposals') {
        recordPayload.title = String(recordPayload.title || 'عرض سعر').slice(0, 250);
        recordPayload.status = ['draft', 'sent', 'accepted', 'rejected'].includes(recordPayload.status) ? recordPayload.status : 'sent';
      }

      batch.set(docRef, recordPayload);
    }

    await batch.commit();
    totalImported += chunk.length;
  }

  // Log system migration audit event
  try {
    const logId = generateValidId('mig');
    await setDoc(doc(db, 'system_logs', logId), {
      eventType: 'BULK_MIGRATION',
      details: `Bulk imported ${totalImported} items into ${collectionName}`,
      createdBy: uid,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Migration log notice:', err);
  }

  return { success: true, count: totalImported };
}

