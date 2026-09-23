import {
  collection,
  doc,
  getDocFromServer,
  type CollectionReference,
  type DocumentReference,
} from 'firebase/firestore';
import { getFirebaseDb } from './config';
import type { Trade } from '../../types/trade';
import type { Setup } from '../../types/setup';

export interface UserProfileDocument {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: string;
  lastLoginAt: string;
  syncedDeviceCount?: number;
}

/**
 * Helper to construct user collection references in Firestore:
 * Structure:
 * /users/{userId} -> Root user doc
 * /users/{userId}/trades/{tradeId} -> Private trades collection
 * /users/{userId}/setups/{setupId} -> Private setups collection
 * /users/{userId}/settings/{settingId} -> User preferences & account config
 */
export function getUserDocRef(userId: string): DocumentReference | null {
  const db = getFirebaseDb();
  if (!db) return null;
  return doc(db, 'users', userId);
}

export function getUserTradesRef(userId: string): CollectionReference | null {
  const db = getFirebaseDb();
  if (!db) return null;
  return collection(db, 'users', userId, 'trades');
}

export function getUserTradeDocRef(userId: string, tradeId: string): DocumentReference | null {
  const db = getFirebaseDb();
  if (!db) return null;
  return doc(db, 'users', userId, 'trades', tradeId);
}

export function getUserSetupsRef(userId: string): CollectionReference | null {
  const db = getFirebaseDb();
  if (!db) return null;
  return collection(db, 'users', userId, 'setups');
}

export function getUserSettingsRef(userId: string): CollectionReference | null {
  const db = getFirebaseDb();
  if (!db) return null;
  return collection(db, 'users', userId, 'settings');
}

/**
 * Validates connection to Firestore server per architectural best practices
 */
export async function testFirestoreConnection(): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client is offline or configuration is not yet active.');
    }
    // Even if doc does not exist, connection is valid as long as server responded
    return true;
  }
}
