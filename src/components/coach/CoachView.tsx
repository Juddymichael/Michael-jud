import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import {
  Bot,
  Send,
  Plus,
  Trash2,
  MessageSquare,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Cpu,
  History,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  PanelLeftClose,
  PanelLeftOpen,
  Globe,
  Target,
  ShieldAlert,
  ExternalLink,
  Zap,
  Square,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Trade } from '../../types/trade';
import { CoachConversation, CoachChatMessage, CoachToolInvocation } from '../../types/coach';
import { CoachConversationService } from '../../lib/firebase/coachConversationService';
import { computeCompactTradingContext } from '../../lib/coach/compactTradingContext';

interface CoachViewProps {
  userTimezone?: string;
  currency?: string;
  trades?: Trade[];
}

export const AVAILABLE_MODELS = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    badge: 'Recommandé & Direct',
    description: 'Modèle haute vitesse optimisé pour le coaching, Search Grounding et Function Calling',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    badge: 'Search & Grounding',
    description: 'Intelligence générale rapide avec recherche Google en direct',
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    badge: 'Raisonnement Complexe',
    description: 'Audit mathématique en profondeur et analyse institutionnelle',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    badge: 'Latence Minimale',
    description: 'Latence minimale pour questions simples et confirmations instantanées',
  },
];

export const SAMPLE_PROMPTS = [
  {
    title: 'News Macro & Catalyseurs',
    prompt: "On a quoi comme news aujourd'hui et quelles sont les règles prop firm à respecter ?",
    desc: 'Calendrier économique, CPI/NFP et restrictions',
  },
  {
    title: 'Audit de Mon Journal',
    prompt: 'Analyse la performance de mes trades récents : calcule mon winrate, mon profit factor et mon espérance R par session.',
    desc: 'Diagnostic quantitatif direct sur vos positions réelles',
  },
  {
    title: 'Méthodologie SMC & Checklist',
    prompt: "Explique-moi comment combiner un balayage de liquidité (Sweep) avec un Market Structure Shift (MSS) et un FVG.",
    desc: 'Confirmation institutionnelle et points d’entrée',
  },
  {
    title: 'Discipline & Anti-Tilt',
    prompt: "Comment gérer une série de pertes sans dévier de mon plan et neutraliser le revenge trading ?",
    desc: 'Règles de protection psychologique et financière',
  },
];

export const CoachView: React.FC<CoachViewProps> = ({
  userTimezone = 'Indian/Antananarivo',
  currency = 'USD',
  trades = [],
}) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<CoachConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.8-flash');
  const [searchGroundingEnabled, setSearchGroundingEnabled] = useState<boolean>(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cancel ongoing request if any
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setElapsedSeconds(0);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Subscribe to conversations from Firestore
  useEffect(() => {
    const effectiveUserId = user?.uid || 'guest';
    const unsubscribe = CoachConversationService.subscribeConversations(
      effectiveUserId,
      (list) => {
        setConversations(list);
        if (list.length > 0 && !activeConversationId) {
          setActiveConversationId(list[0].id);
        }
      }
    );
    return () => unsubscribe();
  }, [user?.uid]);

  // Current conversation
  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) || null;

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages, isLoading]);

  // Create new conversation
  const handleNewConversation = () => {
    const newId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const effectiveUserId = user?.uid || 'guest';
    const newConv: CoachConversation = {
      id: newId,
      userId: effectiveUserId,
      title: 'Nouvelle discussion',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };

    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newId);
    CoachConversationService.saveConversation(effectiveUserId, newConv);
    setErrorMsg(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Delete conversation
  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const effectiveUserId = user?.uid || 'guest';
    await CoachConversationService.deleteConversation(effectiveUserId, id);
    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== id);
      if (activeConversationId === id) {
        setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
      }
      return remaining;
    });
  };

  // Send message
  const handleSendMessage = async (textToSend?: string) => {
    const message = (textToSend || inputMessage).trim();
    if (!message || isLoading) return;

    setInputMessage('');
    setErrorMsg(null);

    const effectiveUserId = user?.uid || 'guest';

    // Get or create conversation
    let conv = activeConversation;
    if (!conv) {
      const newId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      conv = {
        id: newId,
        userId: effectiveUserId,
        title: message.slice(0, 32) + (message.length > 32 ? '...' : ''),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
      };
    } else if (conv.messages.length === 0) {
      // Rename title based on first query
      conv.title = message.slice(0, 32) + (message.length > 32 ? '...' : '');
    }

    const userMessage: CoachChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    };

    const updatedMessages = [...conv.messages, userMessage];
    const updatedConv: CoachConversation = {
      ...conv,
      messages: updatedMessages,
      updatedAt: new Date().toISOString(),
    };

    // Immediate optimistic update to React state and active conversation
    setActiveConversationId(updatedConv.id);
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === updatedConv.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updatedConv;
        return next;
      }
      return [updatedConv, ...prev];
    });

    // Persist optimistic state
    CoachConversationService.saveConversation(effectiveUserId, updatedConv).catch(console.warn);

    setIsLoading(true);
    setElapsedSeconds(0);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Forced 15-second timeout mechanism to guarantee UI responsiveness
    const timeoutTimer = setTimeout(() => {
      abortController.abort();
    }, 15000);

    const timerInterval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      let idToken = '';
      if (user) {
        try {
          idToken = await Promise.race([
            user.getIdToken(),
            new Promise<string>((resolve) => setTimeout(() => resolve(''), 3000)),
          ]);
          if (idToken) {
            headers['Authorization'] = `Bearer ${idToken}`;
          } else {
            headers['x-demo-mode'] = 'true';
          }
        } catch {
          headers['x-demo-mode'] = 'true';
        }
      } else {
        headers['x-demo-mode'] = 'true';
      }

      // Bloc 4: Troncature de l'historique - n'envoyer que les 3 à 5 derniers tours (user/assistant) au lieu de l'historique complet
      // Le contexte trading (Bloc 3) reste séparé et n'est jamais tronqué ni résumé — il est recalculé frais à chaque appel.
      const previousMessages = updatedMessages.slice(0, -1);
      const MAX_PREVIOUS_TURNS = 4; // 4 tours = jusqu'à 8 messages user/assistant
      const truncatedHistory = previousMessages.slice(-(MAX_PREVIOUS_TURNS * 2));
      const historyPayload = truncatedHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/coach/chat', {
        method: 'POST',
        headers,
        signal: abortController.signal,
        body: JSON.stringify({
          message,
          history: historyPayload,
          timezone: userTimezone,
          currency,
          demoTrades: trades,
          trades,
          model: selectedModel,
          compactTradingContext: computeCompactTradingContext(trades, currency),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erreur serveur (${res.status})`);
      }

      const data = await res.json();

      const assistantMessage: CoachChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'model',
        content: data.reply,
        createdAt: new Date().toISOString(),
        toolInvocations: data.toolInvocations,
        searchSources: data.searchSources,
        model: data.model || selectedModel,
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      const finalConv: CoachConversation = {
        ...updatedConv,
        messages: finalMessages,
        updatedAt: new Date().toISOString(),
      };

      // Immediate state update with Coach reply
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === finalConv.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = finalConv;
          return next;
        }
        return [finalConv, ...prev];
      });

      // Clear loading state immediately so user can interact
      setIsLoading(false);

      // Persist in background asynchronously without blocking UI
      CoachConversationService.saveConversation(effectiveUserId, finalConv).catch((e) =>
        console.warn('[Coach Background Save Warning]:', e)
      );
    } catch (err: any) {
      const isAborted = err?.name === 'AbortError' || err?.message?.includes('aborted');
      const rawError = err?.message || 'Une erreur est survenue lors de l’échange avec le Coach.';

      let friendlyError = rawError;
      if (isAborted) {
        friendlyError = `⏱️ **Délai d’attente dépassé (15 secondes)**\n\nLa requête a été automatiquement annulée après 15 secondes afin de garantir la réactivité immédiate de l'interface et éviter tout blocage. Le champ de saisie a été immédiatement débloqué. Vous pouvez renvoyer votre question ou essayer une autre formulation.`;
      } else if (rawError.includes('Authentification requise')) {
        friendlyError = `⚠️ **Authentification requise**\n\nVous êtes actuellement non connecté ou en mode démo. Pour que je puisse accéder et analyser vos trades dans Firestore via mes outils de calcul institutionnels, veuillez vous connecter avec votre compte Thunder Edge.`;
      } else if (rawError.includes('Session expirée')) {
        friendlyError = `⚠️ **Session expirée**\n\nVotre jeton de session Firebase a expiré. Veuillez vous reconnecter pour poursuivre l'analyse de vos positions.`;
      } else {
        friendlyError = `⚠️ **Erreur lors du traitement**\n\n${rawError}\n\n*Le Coach n'a pas pu finaliser cette requête. Vérifiez votre connexion ou cliquez sur Réessayer.*`;
      }

      // Render visible error chat bubble
      const errorAssistantMessage: CoachChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: 'model',
        content: friendlyError,
        createdAt: new Date().toISOString(),
        isError: true,
      };

      const finalMessages = [...updatedMessages, errorAssistantMessage];
      const finalConv: CoachConversation = {
        ...updatedConv,
        messages: finalMessages,
        updatedAt: new Date().toISOString(),
      };

      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === finalConv.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = finalConv;
          return next;
        }
        return [finalConv, ...prev];
      });

      // Clear loading immediately
      setIsLoading(false);

      CoachConversationService.saveConversation(effectiveUserId, finalConv).catch((e) =>
        console.warn('[Coach Background Save Error]:', e)
      );
    } finally {
      clearTimeout(timeoutTimer);
      clearInterval(timerInterval);
      abortControllerRef.current = null;
      setIsLoading(false);
      setElapsedSeconds(0);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div
      id="coach-view-root"
      className="flex h-[calc(100vh-4.5rem)] bg-[#0A0E14] text-[#E6E8EB] overflow-hidden select-text"
    >
      {/* Sidebar: Discussions History */}
      <aside
        className={`${
          showSidebar ? 'w-72 sm:w-80' : 'w-0'
        } shrink-0 bg-[#0D111A] border-r border-[#1E2532] transition-all duration-200 overflow-hidden flex flex-col z-20`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-[#1E2532] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/30">
              <History className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold tracking-wide text-white">Discussions</span>
          </div>
          <button
            onClick={handleNewConversation}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-medium transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouveau</span>
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">
              Aucune discussion archivée. Cliquez sur "Nouveau" pour démarrer.
            </div>
          ) : (
            conversations.map((c) => {
              const isActive = c.id === activeConversationId;
              const dateStr = new Date(c.updatedAt).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    setActiveConversationId(c.id);
                    setErrorMsg(null);
                  }}
                  className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-xs transition-colors ${
                    isActive
                      ? 'bg-[#182030] text-white border border-[#8B5CF6]/40 font-medium'
                      : 'text-slate-400 hover:bg-[#131822] hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                    <MessageSquare
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? 'text-[#8B5CF6]' : 'text-slate-500'
                      }`}
                    />
                    <div className="truncate">
                      <p className="truncate text-slate-200 font-medium">{c.title || 'Discussion sans titre'}</p>
                      <p className="text-[10px] text-slate-500">{dateStr}</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteConversation(e, c.id)}
                    title="Supprimer la discussion"
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/20 hover:text-rose-400 text-slate-500 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer Context */}
        <div className="p-3 border-t border-[#1E2532] bg-[#0A0E14]/60 text-[11px] text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Gemini 3.8 Flash
          </span>
          <span className="text-[10px] text-slate-500">UTC+3 (Madagascar)</span>
        </div>
      </aside>

      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-[#0A0E14]">
        {/* Chat Topbar - Clean, minimal & distraction-free */}
        <div className="min-h-14 py-2 border-b border-[#1E2532] bg-[#0D111A]/95 backdrop-blur px-3 sm:px-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-1.5 rounded-lg bg-[#141A26] border border-[#1E2532] text-slate-400 hover:text-white transition-colors cursor-pointer"
              title={showSidebar ? 'Masquer les discussions' : 'Afficher les discussions'}
            >
              {showSidebar ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeftOpen className="w-4 h-4" />
              )}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#8B5CF6] to-[#6366F1] p-0.5 shadow-sm shadow-[#8B5CF6]/20 shrink-0">
                <div className="w-full h-full bg-[#0A0E14] rounded-[10px] flex items-center justify-center">
                  <Bot className="w-4 h-4 text-[#8B5CF6]" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-semibold text-white tracking-wide">Coach IA</h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/30">
                    Expert ICT / SMC
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  Méthodologie ICT/SMC • Macro &amp; News • Audit Journal en Temps Réel
                </p>
              </div>
            </div>
          </div>

          {/* Minimal Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleNewConversation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#151B28] hover:bg-[#1C2436] border border-[#1E2532] text-slate-200 text-xs font-medium transition-colors cursor-pointer shadow-sm"
              title="Démarrer une nouvelle discussion vierge"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <span>Nouveau chat</span>
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
          {(!activeConversation || activeConversation.messages.length === 0) && (
            <div className="max-w-3xl mx-auto py-6">
              {/* Institutional Welcome Card */}
              <div className="p-6 rounded-2xl bg-[#0F1420] border border-[#1E2532] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#8B5CF6]/5 rounded-full blur-3xl pointer-events-none" />
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#8B5CF6] to-[#6366F1] flex items-center justify-center shrink-0 shadow-lg shadow-[#8B5CF6]/20">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                      Coach IA Thunder Edge — Expert ICT / SMC &amp; Macro
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                      Votre mentor institutionnel unique : analyse en temps réel de vos trades et de votre discipline, explication approfondie de la méthode SMC (Order Blocks, FVG, Liquidity Sweeps) et veille macroéconomique avec Google Search Grounding. Un persona unique pour toutes vos questions.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6 pt-6 border-t border-[#1E2532]/80">
                  <div className="p-3 rounded-xl bg-[#0A0E14]/70 border border-[#1E2532]">
                    <p className="text-xs font-semibold text-[#8B5CF6]">📊 Vos Trades &amp; Audit</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Winrate, Profit Factor, drawdown max et espérance R recalculés depuis vos positions.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0A0E14]/70 border border-[#1E2532]">
                    <p className="text-xs font-semibold text-blue-400">🌐 Macro &amp; News du Jour</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Catalyseurs CPI, NFP, taux Fed et recherche Google Search Grounding en direct.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0A0E14]/70 border border-[#1E2532]">
                    <p className="text-xs font-semibold text-emerald-400">🎯 Méthodologie ICT / SMC</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Order Blocks, FVG, Liquidity Sweeps, Killzones institutionnelles et discipline anti-tilt.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Suggestion Chips */}
              <div className="mt-8">
                <p className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wider">
                  Suggestions recommandées :
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SAMPLE_PROMPTS.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(item.prompt)}
                      className="text-left p-3.5 rounded-xl bg-[#111622] hover:bg-[#161D2C] border border-[#1E2532] hover:border-[#8B5CF6]/50 transition-all group cursor-pointer"
                    >
                      <p className="text-xs font-semibold text-slate-200 group-hover:text-white flex items-center justify-between">
                        <span>{item.title}</span>
                        <Send className="w-3 h-3 text-slate-500 group-hover:text-[#8B5CF6] transition-colors" />
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">{item.prompt}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Render Active Messages */}
          {activeConversation?.messages.map((msg) => {
            const isUser = msg.role === 'user';
            const timeStr = new Date(msg.createdAt).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${
                  isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center shadow-md ${
                    isUser
                      ? 'bg-slate-700 text-slate-200'
                      : msg.isError || msg.content.startsWith('⚠️')
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-rose-950/30'
                      : 'bg-gradient-to-tr from-[#8B5CF6] to-[#6366F1] text-white shadow-[#8B5CF6]/20'
                  }`}
                >
                  {isUser ? (
                    <span className="text-xs font-bold">MOI</span>
                  ) : msg.isError || msg.content.startsWith('⚠️') ? (
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>

                {/* Bubble Container */}
                <div className={`space-y-2 max-w-[85%] sm:max-w-[78%]`}>
                  {/* Tool Invocations Badge (Model only) */}
                  {!isUser && msg.toolInvocations && msg.toolInvocations.length > 0 && (
                    <div className="space-y-1.5 mb-2">
                      {msg.toolInvocations.map((inv, iIdx) => (
                        <ToolInvocationCard key={iIdx} invocation={inv} currency={currency} />
                      ))}
                    </div>
                  )}

                  {/* Message Body */}
                  <div
                    className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                      isUser
                        ? 'bg-[#1E1938] text-slate-100 border border-[#8B5CF6]/30 rounded-tr-none'
                        : msg.isError || msg.content.startsWith('⚠️')
                        ? 'bg-[#1A1014] text-rose-100 border border-rose-500/40 rounded-tl-none shadow-md shadow-rose-950/20'
                        : 'bg-[#101522] text-[#E6E8EB] border border-[#1E2532] rounded-tl-none shadow-sm'
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <>
                        <div
                          className={`prose prose-invert prose-xs sm:prose-sm max-w-none text-[#E6E8EB] [&>p]:mb-3 [&>p:last-child]:mb-0 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-3 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:mb-3 [&>li]:mb-1 [&>strong]:text-[#8B5CF6] [&>strong]:font-bold [&>h3]:text-sm [&>h3]:font-bold [&>h3]:text-white [&>h3]:mt-3 [&>h3]:mb-1 ${
                            msg.isError ? '[&>strong]:text-rose-400' : ''
                          }`}
                        >
                          <Markdown>{msg.content}</Markdown>
                        </div>

                        {/* Google Search Grounding Sources */}
                        {msg.searchSources && msg.searchSources.length > 0 && (
                          <div className="mt-3.5 pt-3 border-t border-[#1E2532] space-y-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-400">
                              <Globe className="w-3.5 h-3.5" />
                              <span>Sources &amp; Données vérifiées en direct :</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.searchSources.map((src, sIdx) => (
                                <a
                                  key={sIdx}
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#141A26] hover:bg-[#1A2234] border border-[#232D40] text-[10px] text-slate-300 hover:text-white transition-colors"
                                >
                                  <ExternalLink className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                                  <span className="truncate max-w-[200px]">{src.title}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Timestamp & Model Metadata */}
                  <div
                    className={`flex items-center gap-2 text-[10px] text-slate-500 ${
                      isUser ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <span>{timeStr}</span>
                    {!isUser && msg.model && (
                      <span className="px-1.5 py-0.5 rounded bg-[#141A26] border border-[#1E2532] text-slate-400 text-[9px] font-mono">
                        {msg.model}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* State-Based Visual Loading Feedback with Live Timer & Timeout Protection */}
          {isLoading && (
            <div className="flex gap-3 max-w-3xl mr-auto w-full">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#8B5CF6] to-[#6366F1] text-white flex items-center justify-center shrink-0 shadow-lg shadow-[#8B5CF6]/30">
                <Bot className="w-5 h-5 animate-pulse" />
              </div>
              <div className="flex-1 p-4 rounded-2xl bg-[#0F1420] border border-[#8B5CF6]/30 rounded-tl-none text-xs text-slate-200 shadow-xl space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8B5CF6] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#8B5CF6]"></span>
                    </span>
                    <span className="font-semibold text-slate-100">Coach IA en cours d'analyse...</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-[#182030] text-[#A78BFA] border border-[#8B5CF6]/20 font-medium">
                      ⏱️ {elapsedSeconds}s / 15s max
                    </span>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-white text-[11px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Arrêter la requête immédiatement"
                    >
                      <Square className="w-2.5 h-2.5 fill-current" />
                      <span>Arrêter</span>
                    </button>
                  </div>
                </div>

                {/* Live Animated Progress Bar */}
                <div className="w-full bg-[#1A2234] rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-[#8B5CF6] via-indigo-500 to-purple-400 h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(10, Math.round((elapsedSeconds / 15) * 100)))}%`,
                    }}
                  />
                </div>

                {/* Dynamic Contextual Phase Description */}
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>
                    {elapsedSeconds < 3 && '🔍 Analyse autonome de la question et sélection de la section experte...'}
                    {elapsedSeconds >= 3 &&
                      elapsedSeconds < 7 &&
                      '📊 Interrogation des règles institutionnelles & calculs...'}
                    {elapsedSeconds >= 7 &&
                      elapsedSeconds < 12 &&
                      '🧠 Formulation personnalisée et vérification de la stratégie...'}
                    {elapsedSeconds >= 12 &&
                      '⚡ Finalisation de la réponse (Sécurité anti-blocage 15s active)...'}
                  </span>
                  <span className="text-slate-500 font-mono text-[10px] hidden sm:inline">
                    Déblocage auto à 15s
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-[#0D111A] border-t border-[#1E2532] relative">
          {/* Active Loading Glow Line */}
          {isLoading && (
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#8B5CF6] to-transparent animate-pulse" />
          )}

          <div className="max-w-3xl mx-auto">
            <div
              className={`relative flex items-center bg-[#141A26] border rounded-2xl p-1.5 transition-all shadow-lg ${
                isLoading
                  ? 'border-[#8B5CF6]/50 shadow-[#8B5CF6]/5 ring-1 ring-[#8B5CF6]/20'
                  : 'border-[#1E2532] focus-within:border-[#8B5CF6]'
              }`}
            >
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isLoading
                    ? "Le Coach analyse votre requête... (Cliquez sur 'Arrêter' pour débloquer immédiatement)"
                    : "Posez votre question (audit de vos trades, concepts ICT/SMC, news macro du jour, gestion du risque)..."
                }
                rows={1}
                disabled={isLoading}
                className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-xs sm:text-sm px-3 py-2 outline-none resize-none max-h-32 disabled:opacity-60"
              />
              {isLoading ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shrink-0 flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
                  title="Arrêter la génération"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Arrêter</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || isLoading}
                  className="p-2.5 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:bg-[#1E2532] disabled:text-slate-600 text-white transition-all shadow-md shrink-0 cursor-pointer"
                  title="Envoyer le message"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-500 text-center mt-2">
              Coach IA ICT/SMC unique • Contexte trading recalculé en temps réel • Recherche Google Search Grounding active
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Component to display a Tool Invocation executed by Gemini
 */
const ToolInvocationCard: React.FC<{
  invocation: CoachToolInvocation;
  currency: string;
}> = ({ invocation, currency }) => {
  const [isOpen, setIsOpen] = useState(false);

  const getToolDisplayName = (name: string) => {
    switch (name) {
      case 'getTradesBySession':
        return `Filtrage par Killzone : ${invocation.args?.session || 'Session'}`;
      case 'getTradesByDateRange':
        return `Période : ${invocation.args?.startDate || ''} → ${invocation.args?.endDate || ''}`;
      case 'compareTwoPeriods':
        return 'Comparaison comparative de 2 périodes (A vs B)';
      default:
        return name;
    }
  };

  const res = invocation.result as any;

  return (
    <div className="rounded-xl bg-[#0A0E14] border border-[#1E2532] text-xs overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-[#121722] transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded bg-[#8B5CF6]/15 text-[#8B5CF6]">
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono text-[11px] text-slate-300 font-medium truncate">
            {getToolDisplayName(invocation.name)}
          </span>
          {res && typeof res.totalTrades === 'number' && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 shrink-0">
              {res.totalTrades} {res.totalTrades > 1 ? 'trades' : 'trade'}
            </span>
          )}
          {res && res.isSmallSample && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
              Échantillon restreint
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
          <span className="text-[10px]">Détails</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {isOpen && (
        <div className="px-3 py-2.5 border-t border-[#1E2532] bg-[#070A0F] font-mono text-[11px] text-slate-300 space-y-2">
          {/* Quick Metrics Summary if available */}
          {res && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 pb-1">
              {res.winRate !== undefined && (
                <div className="p-1.5 rounded bg-[#101520] border border-[#1E2532]">
                  <span className="text-[10px] text-slate-500 block">Win Rate</span>
                  <span className="text-white font-semibold">{res.winRate}%</span>
                </div>
              )}
              {res.netPnL !== undefined && (
                <div className="p-1.5 rounded bg-[#101520] border border-[#1E2532]">
                  <span className="text-[10px] text-slate-500 block">Net P&L</span>
                  <span
                    className={`font-semibold ${
                      res.netPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {res.netPnL > 0 ? '+' : ''}
                    {res.netPnL} {currency}
                  </span>
                </div>
              )}
              {res.expectedR !== undefined && (
                <div className="p-1.5 rounded bg-[#101520] border border-[#1E2532]">
                  <span className="text-[10px] text-slate-500 block">Espérance R</span>
                  <span className="text-white font-semibold">
                    {res.expectedR !== null ? `${res.expectedR > 0 ? '+' : ''}${res.expectedR}R` : 'N/A'}
                  </span>
                </div>
              )}
              {res.completeTrades !== undefined && (
                <div className="p-1.5 rounded bg-[#101520] border border-[#1E2532]">
                  <span className="text-[10px] text-slate-500 block">Complets / Total</span>
                  <span className="text-white font-semibold">
                    {res.completeTrades} / {res.totalTrades}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Raw JSON inspection */}
          <details className="text-[10px] text-slate-500 pt-1 cursor-pointer">
            <summary className="hover:text-slate-400">Données JSON brutes retournées</summary>
            <pre className="p-2 rounded bg-black/40 overflow-x-auto text-slate-400 text-[10px] mt-1 max-h-48">
              {JSON.stringify(res, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};
