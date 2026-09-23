import fs from 'fs';
import path from 'path';
import { Trade } from '../../types/trade';

export interface AppletConfig {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId?: string;
  fallbackProjectId?: string;
  fallbackApiKey?: string;
}

export function loadAppletConfig(): AppletConfig {
  let fileConfig: any = {};
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      fileConfig = JSON.parse(raw);
    }
  } catch {
    // Fallback to environment variables
  }

  // Consistent resolution with client-side src/lib/firebase/config.ts:
  // Environment variables take precedence, with file config as fallback
  const apiKey = process.env.VITE_FIREBASE_API_KEY || fileConfig.apiKey || '';
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || fileConfig.projectId || '';
  const firestoreDatabaseId =
    fileConfig.firestoreDatabaseId ||
    process.env.VITE_FIRESTORE_DATABASE_ID ||
    '(default)';

  const fallbackApiKey =
    apiKey === process.env.VITE_FIREBASE_API_KEY
      ? fileConfig.apiKey || ''
      : process.env.VITE_FIREBASE_API_KEY || '';

  const fallbackProjectId =
    projectId === process.env.VITE_FIREBASE_PROJECT_ID
      ? fileConfig.projectId || ''
      : process.env.VITE_FIREBASE_PROJECT_ID || '';

  return {
    projectId,
    apiKey,
    firestoreDatabaseId,
    fallbackProjectId,
    fallbackApiKey,
  };
}

/**
 * Converts a Firestore REST API typed field value to a standard JS value
 */
export function convertFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return val;
  if ('stringValue' in val) return val.stringValue;
  if ('doubleValue' in val) return val.doubleValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(convertFirestoreValue);
  }
  if ('mapValue' in val) {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      res[k] = convertFirestoreValue(v);
    }
    return res;
  }
  return val;
}

/**
 * Verifies the user's Firebase ID token using Google Identity Toolkit REST API
 * Supports multiple candidate API keys for seamless local/production compatibility
 */
export async function verifyFirebaseIdToken(
  token: string,
  apiKeys: string | string[]
): Promise<{ uid: string; email?: string } | null> {
  if (!token) return null;
  const keyList = (Array.isArray(apiKeys) ? apiKeys : [apiKeys]).filter(Boolean);
  if (keyList.length === 0) return null;

  for (const key of keyList) {
    try {
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: token }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.users && data.users[0]) {
          return {
            uid: data.users[0].localId,
            email: data.users[0].email,
          };
        }
      }
    } catch {
      // Token verification failed quietly
    }
  }

  return null;
}

/**
 * Fetches all trades of the authenticated user directly from Firestore REST API.
 * The Bearer token ensures Firestore Security Rules (request.auth.uid == userId) are applied.
 * Automatically handles named database fallback to '(default)' if required.
 */
export async function fetchUserTradesFromFirestore(
  uid: string,
  idToken: string,
  config: AppletConfig
): Promise<Trade[]> {
  const candidateDatabases = [
    config.firestoreDatabaseId,
    '(default)',
  ].filter((db, idx, arr): db is string => Boolean(db) && arr.indexOf(db) === idx);

  const candidateProjects = [
    config.projectId,
    config.fallbackProjectId,
  ].filter((p, idx, arr): p is string => Boolean(p) && arr.indexOf(p) === idx);

  for (const proj of candidateProjects) {
    for (const dbId of candidateDatabases) {
      const baseUrl = `https://firestore.googleapis.com/v1/projects/${proj}/databases/${dbId}/documents/users/${uid}/trades?pageSize=1000`;
      const trades: Trade[] = [];
      let pageToken = '';
      let querySuccess = false;

      try {
        do {
          const url = pageToken ? `${baseUrl}&pageToken=${encodeURIComponent(pageToken)}` : baseUrl;
          const response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${idToken}`,
              Accept: 'application/json',
            },
          });

          if (!response.ok) {
            break;
          }

          querySuccess = true;
          const data = await response.json();
          if (data.documents && Array.isArray(data.documents)) {
            for (const doc of data.documents) {
              const docId = doc.name ? doc.name.split('/').pop() : '';
              const rawFields: Record<string, any> = {};
              for (const [key, val] of Object.entries(doc.fields || {})) {
                rawFields[key] = convertFirestoreValue(val);
              }
              trades.push({
                id: docId || rawFields.id || String(Math.random()),
                ...rawFields,
              } as Trade);
            }
          }

          pageToken = data.nextPageToken || '';
        } while (pageToken);

        if (querySuccess) {
          return trades;
        }
      } catch {
        // Continue to fallback database
      }
    }
  }

  return [];
}
