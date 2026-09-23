import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const AuthScreen: React.FC = () => {
  const {
    isConfigured,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    enterDemoMode,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';

  const formatFirebaseError = (err: unknown): string => {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      const code = (err as { code: string }).code;
      switch (code) {
        case 'auth/unauthorized-domain':
          setUnauthorizedDomain(currentHost);
          return 'Domaine non autorisé dans la console Firebase pour la connexion Google.';
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          return 'Email ou mot de passe incorrect.';
        case 'auth/email-already-in-use':
          return 'Cette adresse email possède déjà un compte existant.';
        case 'auth/weak-password':
          return 'Le mot de passe doit contenir au moins 6 caractères.';
        case 'auth/invalid-email':
          return 'Le format de l’adresse email est invalide.';
        case 'auth/popup-closed-by-user':
          return 'La fenêtre de connexion Google a été fermée.';
        case 'auth/popup-blocked':
          return 'Le popup a été bloqué par le navigateur. Autorisez les fenêtres pop-up.';
        case 'auth/too-many-requests':
          return 'Trop de tentatives infructueuses. Veuillez patienter un instant.';
        default:
          return (err as { message?: string }).message || 'Une erreur est survenue lors de la connexion.';
      }
    }
    return err instanceof Error ? err.message : 'Erreur de connexion.';
  };

  const copyHost = () => {
    if (currentHost) {
      navigator.clipboard.writeText(currentHost);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 3000);
    }
  };

  const handleGoogleSubmit = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Veuillez remplir tous les champs.');
      return;
    }

    if (mode === 'register') {
      if (password.length < 6) {
        setError('Le mot de passe doit contenir au moins 6 caractères.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Les mots de passe ne correspondent pas.');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setIsLoading(true);
    try {
      await resetPassword(resetEmail);
      setResetSent(true);
      setError(null);
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0A0E14] text-[#E6E8EB] flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden font-sans">
      <div className="w-full max-w-md z-10 space-y-6">
        {/* Terminal Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#8B5CF6] shadow-xs mb-1">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#E6E8EB]">
            SMC Trading Terminal
          </h1>
          <p className="text-xs sm:text-sm text-[#8B92A0] max-w-xs mx-auto">
            Synchronisation temps réel multi-appareils (Desktop & Mobile)
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-[#131820] border border-[#1C2430] rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-[#0A0E14] border border-[#1C2430] text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-2 rounded-lg transition text-center cursor-pointer ${
                mode === 'login'
                  ? 'bg-[#8B5CF6] text-white shadow-xs'
                  : 'text-[#8B92A0] hover:text-[#E6E8EB]'
              }`}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`py-2 rounded-lg transition text-center cursor-pointer ${
                mode === 'register'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Créer un compte
            </button>
          </div>

          {/* Error Message Box */}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Unauthorized Domain Guide */}
          {unauthorizedDomain && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-3"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-300">
                    Autoriser ce domaine pour Google :
                  </p>
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    Firebase restreint la connexion Google aux domaines explicitement approuvés.
                  </p>
                  <ol className="list-decimal list-inside text-[11px] space-y-1 text-amber-100/90 pt-1">
                    <li>Rendez-vous sur Firebase Console &gt; <strong>Authentication</strong> &gt; <strong>Paramètres</strong> &gt; <strong>Domaines autorisés</strong>.</li>
                    <li>Cliquez sur <strong>Ajouter un domaine</strong> et collez le domaine actuel :</li>
                  </ol>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 justify-between">
                <span className="truncate">{currentHost}</span>
                <button
                  type="button"
                  onClick={copyHost}
                  className="px-2.5 py-1 rounded-md bg-violet-600 hover:bg-violet-500 text-white font-sans text-[11px] font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {copiedDomain ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedDomain ? 'Copié !' : 'Copier'}</span>
                </button>
              </div>

              <div className="pt-2 border-t border-amber-500/20 flex flex-wrap items-center justify-between gap-2">
                <a
                  href="https://console.firebase.google.com/project/indigo-quote-lsx2c/authentication/settings"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-amber-300 hover:text-amber-100 underline font-semibold"
                >
                  <span>Ouvrir les Paramètres Firebase</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <span className="text-[10px] text-amber-300/80">
                  Ou utilisez <strong>Email / Mot de passe</strong> ci-dessous
                </span>
              </div>
            </motion.div>
          )}

          {/* Quick Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSubmit}
            disabled={isLoading || !isConfigured}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold flex items-center justify-center gap-2.5 transition cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.4l3.7 2.9C6.5 7.4 9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
              />
              <path
                fill="#FBBC05"
                d="M5.6 14.7c-.2-.7-.4-1.5-.4-2.7s.2-2 .4-2.7L1.9 6.4C.7 8.8 0 10.8 0 12s.7 3.2 1.9 5.6l3.7-2.9z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.3L1.9 16c1.8 3.8 5.6 7 10.1 7z"
              />
            </svg>
            <span>Continuer avec Google</span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
              ou par email
            </span>
            <div className="border-t border-slate-800 w-full" />
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Adresse Email</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trader@exemple.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-xs focus:outline-hidden focus:border-violet-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Mot de passe</span>
                </label>
                {mode === 'login' && isConfigured && (
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setShowResetModal(true);
                    }}
                    className="text-[11px] text-violet-400 hover:text-violet-300 transition cursor-pointer"
                  >
                    Oublié ?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-xs focus:outline-hidden focus:border-violet-500 transition pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Confirmer le mot de passe</span>
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-xs focus:outline-hidden focus:border-violet-500 transition"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !isConfigured}
              className="w-full py-2.5 px-4 rounded-xl bg-[#8B5CF6] hover:opacity-90 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Traitement en cours...</span>
                </>
              ) : mode === 'login' ? (
                <>
                  <span>Ouvrir ma session</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Créer mon compte sécurisé</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Direct Access without account (Local Dexie IndexedDB mode) */}
          <div className="pt-2">
            <button
              type="button"
              onClick={enterDemoMode}
              className="w-full py-2 px-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Continuer sans compte (Mode Local / Démo)</span>
            </button>
          </div>

          {/* Multi-device sync features */}
          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-around text-[11px] text-slate-400 font-medium">
            <div className="flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5 text-violet-400" />
              <span>Desktop Web</span>
            </div>
            <span className="text-slate-600">•</span>
            <div className="flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-pink-400" />
              <span>Mobile PWA</span>
            </div>
            <span className="text-slate-600">•</span>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Session persistante</span>
            </div>
          </div>
        </div>
      </div>

      {/* Password Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-violet-400" />
              <h3 className="text-sm font-bold text-slate-100">Réinitialisation du mot de passe</h3>
            </div>

            {resetSent ? (
              <div className="space-y-3">
                <p className="text-xs text-emerald-400">
                  Un email de réinitialisation vous a été envoyé à <strong>{resetEmail}</strong>. Suivez le lien dans votre messagerie pour définir un nouveau mot de passe.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setResetSent(false);
                  }}
                  className="w-full py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-3">
                <p className="text-xs text-slate-400">
                  Saisissez votre email. Nous vous enverrons un lien pour réinitialiser votre mot de passe.
                </p>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="votre-email@exemple.com"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs"
                />
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Envoyer
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
