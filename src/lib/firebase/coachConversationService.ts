import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb } from './config';
import { CoachConversation } from '../../types/coach';

const LOCAL_STORAGE_KEY_PREFIX = 'thunder_coach_conversations_';
const localListeners = new Set<{ userId: string; callback: (conversations: CoachConversation[]) => void }>();

function getLocalConversations(userId: string): CoachConversation[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function setLocalConversations(userId: string, convs: CoachConversation[]): void {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(convs));
  } catch (err) {
    console.warn('[Coach LocalStorage Save Failed]:', err);
  }
  // Notify any active local subscribers for this userId
  localListeners.forEach((listener) => {
    if (listener.userId === userId) {
      try {
        listener.callback(convs);
      } catch (err) {
        console.warn('[Coach Local Listener Error]:', err);
      }
    }
  });
}

/**
 * Service to manage coach conversations in Firestore with offline localStorage fallback
 */
export const CoachConversationService = {
  /**
   * Subscribe to the user's coach conversations list in real-time
   */
  subscribeConversations(
    userId: string,
    onUpdate: (conversations: CoachConversation[]) => void
  ): Unsubscribe {
    const effectiveUserId = userId || 'guest';
    const db = getFirebaseDb();

    // If not authenticated or in guest mode, rely on robust local storage and event bus
    if (!db || !userId || userId === 'guest') {
      const listenerObj = { userId: effectiveUserId, callback: onUpdate };
      localListeners.add(listenerObj);
      const local = getLocalConversations(effectiveUserId);
      onUpdate(local);
      return () => {
        localListeners.delete(listenerObj);
      };
    }

    try {
      const colRef = collection(db, 'users', userId, 'coachConversations');
      const q = query(colRef, orderBy('updatedAt', 'desc'));

      return onSnapshot(
        q,
        (snapshot) => {
          const list: CoachConversation[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as CoachConversation;
            list.push({
              ...data,
              id: d.id,
            });
          });
          // Cache locally
          setLocalConversations(userId, list);
          onUpdate(list);
        },
        (error) => {
          console.warn('[Coach Firestore Subscription Error, fallback local]:', error);
          onUpdate(getLocalConversations(userId));
        }
      );
    } catch (err) {
      console.warn('[Coach subscribe catch, fallback local]:', err);
      onUpdate(getLocalConversations(userId));
      return () => {};
    }
  },

  /**
   * Fetch all conversations for a user
   */
  async getConversations(userId: string): Promise<CoachConversation[]> {
    const effectiveUserId = userId || 'guest';
    const db = getFirebaseDb();
    if (!db || !userId || userId === 'guest') {
      return getLocalConversations(effectiveUserId);
    }

    try {
      const colRef = collection(db, 'users', userId, 'coachConversations');
      const q = query(colRef, orderBy('updatedAt', 'desc'));
      const snapshot = await getDocs(q);

      const list: CoachConversation[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as CoachConversation;
        list.push({ ...data, id: d.id });
      });

      setLocalConversations(userId, list);
      return list;
    } catch (err) {
      console.warn('[Coach getConversations error, fallback local]:', err);
      return getLocalConversations(effectiveUserId);
    }
  },

  /**
   * Save or update a conversation in Firestore and local cache
   */
  async saveConversation(userId: string, conversation: CoachConversation): Promise<void> {
    const db = getFirebaseDb();
    const effectiveUserId = userId || 'guest';

    // Update local cache first (instant synchronous cache)
    const current = getLocalConversations(effectiveUserId);
    const existingIndex = current.findIndex((c) => c.id === conversation.id);
    let updated: CoachConversation[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = conversation;
    } else {
      updated = [conversation, ...current];
    }
    updated.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setLocalConversations(effectiveUserId, updated);

    if (!db || !userId || userId === 'guest') {
      return;
    }

    try {
      const docRef = doc(db, 'users', userId, 'coachConversations', conversation.id);
      // Timeout safeguard of 4s to guarantee it never hangs if network or offline queue delays
      await Promise.race([
        setDoc(docRef, conversation, { merge: true }),
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ]);
    } catch (err) {
      console.warn('[Coach saveConversation error]:', err);
    }
  },

  /**
   * Delete a conversation
   */
  async deleteConversation(userId: string, conversationId: string): Promise<void> {
    const db = getFirebaseDb();
    const effectiveUserId = userId || 'guest';

    const current = getLocalConversations(effectiveUserId);
    const filtered = current.filter((c) => c.id !== conversationId);
    setLocalConversations(effectiveUserId, filtered);

    if (!db || !userId || userId === 'guest') {
      return;
    }

    try {
      const docRef = doc(db, 'users', userId, 'coachConversations', conversationId);
      await Promise.race([
        deleteDoc(docRef),
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ]);
    } catch (err) {
      console.warn('[Coach deleteConversation error]:', err);
    }
  },
};
