import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import appletConfig from '../../../firebase-applet-config.json';

export interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
  firestoreDatabaseId?: string;
}

export const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || appletConfig.appId || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || appletConfig.measurementId || '',
  firestoreDatabaseId: appletConfig.firestoreDatabaseId || '(default)',
};

/**
 * Checks whether the minimum required Firebase configuration is supplied.
 */
export function isFirebaseConfigured(): boolean {
  const { apiKey, projectId } = firebaseConfig;
  return Boolean(
    apiKey &&
    projectId &&
    apiKey.trim().length > 5 &&
    projectId.trim().length > 2 &&
    !apiKey.includes('MY_FIREBASE_') &&
    !apiKey.includes('YOUR_')
  );
}

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firestoreDb: Firestore | null = null;
let googleAuthProvider: GoogleAuthProvider | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) {
    return null;
  }
  if (!firebaseApp) {
    if (getApps().length > 0) {
      firebaseApp = getApp();
    } else {
      firebaseApp = initializeApp({
        apiKey: firebaseConfig.apiKey,
        authDomain: firebaseConfig.authDomain,
        projectId: firebaseConfig.projectId,
        storageBucket: firebaseConfig.storageBucket,
        messagingSenderId: firebaseConfig.messagingSenderId,
        appId: firebaseConfig.appId,
        measurementId: firebaseConfig.measurementId,
      });
    }
  }
  return firebaseApp;
}

export function getFirebaseAuth(): Auth | null {
  if (firebaseAuth) return firebaseAuth;
  const app = getFirebaseApp();
  if (!app) return null;
  firebaseAuth = getAuth(app);
  return firebaseAuth;
}

export function getFirebaseDb(): Firestore | null {
  if (firestoreDb) return firestoreDb;
  const app = getFirebaseApp();
  if (!app) return null;
  if (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)') {
    firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  } else {
    firestoreDb = getFirestore(app);
  }
  return firestoreDb;
}

export function getGoogleProvider(): GoogleAuthProvider {
  if (!googleAuthProvider) {
    googleAuthProvider = new GoogleAuthProvider();
    googleAuthProvider.setCustomParameters({ prompt: 'select_account' });
  }
  return googleAuthProvider;
}

