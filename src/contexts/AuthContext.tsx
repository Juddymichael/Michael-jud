import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  getFirebaseAuth,
  getFirebaseDb,
  getGoogleProvider,
  isFirebaseConfigured,
} from '../lib/firebase/config';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  isDemoMode: boolean;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('smc_demo_mode') === 'true';
    } catch {
      return false;
    }
  });

  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        // Sync user profile document in /users/{uid}
        try {
          const db = getFirebaseDb();
          if (db) {
            const userRef = doc(db, 'users', currentUser.uid);
            await setDoc(
              userRef,
              {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName || null,
                photoURL: currentUser.photoURL || null,
                lastLoginAt: new Date().toISOString(),
                serverUpdatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          }
        } catch (syncErr) {
          console.warn('Could not sync user profile to Firestore:', syncErr);
        }
      }
    });

    return () => unsubscribe();
  }, [configured]);

  const enterDemoMode = () => {
    try {
      localStorage.setItem('smc_demo_mode', 'true');
    } catch {
      // ignore
    }
    setIsDemoMode(true);
  };

  const exitDemoMode = () => {
    try {
      localStorage.removeItem('smc_demo_mode');
    } catch {
      // ignore
    }
    setIsDemoMode(false);
  };

  const signInWithGoogle = async () => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Firebase Authentication non configuré');
    const provider = getGoogleProvider();
    await signInWithPopup(auth, provider);
  };

  const signInWithEmail = async (email: string, pass: string) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Firebase Authentication non configuré');
    await signInWithEmailAndPassword(auth, email.trim(), pass);
  };

  const signUpWithEmail = async (email: string, pass: string) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Firebase Authentication non configuré');
    await createUserWithEmailAndPassword(auth, email.trim(), pass);
  };

  const signOutUser = async () => {
    const auth = getFirebaseAuth();
    if (auth) {
      await signOut(auth);
    }
    exitDemoMode();
    setUser(null);
  };

  const resetPassword = async (email: string) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Firebase Authentication non configuré');
    await sendPasswordResetEmail(auth, email.trim());
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isConfigured: configured,
        isDemoMode,
        enterDemoMode,
        exitDemoMode,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOutUser,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
