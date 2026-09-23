import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Crosshair,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  Filter,
  TrendingUp,
  TrendingDown,
  Compass,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  Sliders,
  Flame,
  Calendar,
  Globe,
  Award,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Calculator,
  Target,
  BarChart2,
} from 'lucide-react';
import { Trade } from '../types/trade';
import { Setup } from '../types/setup';
import {
  calculateMyEdgeDeepAudit,
  DimensionPerformance,
  SetupPairSessionCombo,
  EdgeScoreBreakdown,
} from '../lib/calculations/edge';
import { formatCurrency, formatRMultiple, formatPercent, formatDecimal, formatKillzone } from '../lib/formatting';
import { getTradeSession } from '../lib/sessionCalculator';
import { useSettingsStore } from '../stores/useSettingsStore';
import { TradeDetailModal } from './TradeDetailModal';

interface MyEdgeViewProps {
  trades?: Trade[];
  setups?: Setup[];
  currency?: string;
  onOpenSetupModal?: () => void;
  onOpenSetupsModal?: () => void;
  onSelectTrade?: (trade: Trade) => void;
}

type EdgeTab = 'verdict' | 'combos' | 'setups' | 'pairs' | 'sessions' | 'directions';

export const MyEdgeView: React.FC<MyEdgeViewProps> = ({
  trades = [],
  setups = [],
  currency = 'EUR',
  onOpenSetupModal,
  onOpenSetupsModal,
  onSelectTrade,
}) => {
  const safeTrades = trades || [];
  const safeSetups = setups || [];
  const handleOpenSetups = onOpenSetupModal || onOpenSetupsModal || (() => {});
  const { settings } = useSettingsStore();
  const userTimezone = settings.timezone && settings.timezone !== 'UTC' ? settings.timezone : 'Europe/Paris';

  // 6 Interactive Filters
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('ALL');
  const [selectedSetup, setSelectedSetup] = useState<string>('ALL');
  const [selectedSession, setSelectedSession] = useState<string>('ALL');
  const [selectedDirection, setSelectedDirection] = useState<string>('ALL');
  const [selectedResult, setSelectedResult] = useState<string>('ALL');

  // Navigation tab
  const [activeTab, setActiveTab] = useState<EdgeTab>('verdict');

  // Edge Score Explainer Modal/Drawer
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);
  const [selectedScoreBreakdown, setSelectedScoreBreakdown] = useState<{
    title: string;
    breakdown: EdgeScoreBreakdown;
  } | null>(null);

  // Trade drill-down
  const [activeTradeDetail, setActiveTradeDetail] = useState<Trade | null>(null);
  const [drillDownCluster, setDrillDownCluster] = useState<{
    title: string;
    trades: Trade[];
  } | null>(null);
  const drillDownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (drillDownCluster && drillDownRef.current) {
      drillDownRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [drillDownCluster]);

  // Available unique values for dropdowns
  const availableSymbols = useMemo(() => {
    const symbols = new Set<string>();
    safeTrades.forEach((t) => t?.symbol && symbols.add(t.symbol.toUpperCase().trim()));
    return Array.from(symbols).sort();
  }, [safeTrades]);

  const availableSetupsList = useMemo(() => {
    const set = new Set<string>();
    safeTrades.forEach((t) => {
      const s = t.setup?.trim() || t.setupId;
      if (s) set.add(s);
    });
    safeSetups.forEach((s) => s?.name && set.add(s.name));
    return Array.from(set).sort();
  }, [safeTrades, safeSetups]);

  // Dynamically filter trades according to all 6 criteria
  const filteredTrades = useMemo(() => {
    const now = new Date().getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const EPSILON = 0.0001;

    return safeTrades.filter((t) => {
      if (!t) return false;
      const tradeTime = new Date(t.closedAt || t.openedAt).getTime();

      // 1. Period
      if (selectedPeriod === '7D' && now - tradeTime > 7 * oneDayMs) return false;
      if (selectedPeriod === '30D' && now - tradeTime > 30 * oneDayMs) return false;
      if (selectedPeriod === 'MONTH') {
        const d = new Date(tradeTime);
        const cur = new Date();
        if (d.getMonth() !== cur.getMonth() || d.getFullYear() !== cur.getFullYear()) return false;
      }
      if (selectedPeriod === 'YEAR') {
        const d = new Date(tradeTime);
        const cur = new Date();
        if (d.getFullYear() !== cur.getFullYear()) return false;
      }

      // 2. Pair / Symbol
      if (
        selectedSymbol !== 'ALL' &&
        (t.symbol || '').toUpperCase().trim() !== selectedSymbol
      ) {
        return false;
      }

      // 3. Setup
      if (selectedSetup !== 'ALL') {
        const s = t.setup?.trim() || t.setupId;
        if (s !== selectedSetup) return false;
      }

      // 4. Session / Killzone
      if (selectedSession !== 'ALL') {
        const kz = getTradeSession(t, userTimezone);
        if (selectedSession === 'LONDON' && kz !== 'London Killzone') return false;
        if (selectedSession === 'NEW_YORK' && kz !== 'New York Killzone') return false;
        if (selectedSession === 'ASIA' && kz !== 'Asian Killzone') return false;
        if (selectedSession === 'LONDON_CLOSE' && kz !== 'London Close Killzone') return false;
        if (selectedSession === 'OFF_HOURS' && kz !== 'Hors Killzone') return false;
      }

      // 5. Direction
      if (selectedDirection !== 'ALL' && t.direction !== selectedDirection) return false;

      // 6. Result (WIN, LOSS, BREAKEVEN)
      if (selectedResult !== 'ALL') {
        const pnl = t.netPnL ?? 0;
        if (selectedResult === 'WIN' && pnl <= EPSILON) return false;
        if (selectedResult === 'LOSS' && pnl >= -EPSILON) return false;
        if (selectedResult === 'BREAKEVEN' && Math.abs(pnl) > EPSILON) return false;
      }

      return true;
    });
  }, [
    safeTrades,
    selectedPeriod,
    selectedSymbol,
    selectedSetup,
    selectedSession,
    selectedDirection,
    selectedResult,
  ]);

  // Run deep statistical edge audit
  const audit = useMemo(() => {
    return calculateMyEdgeDeepAudit(filteredTrades, safeSetups, userTimezone);
  }, [filteredTrades, safeSetups, userTimezone]);

  const {
    setups: setupStats,
    pairs: pairStats,
    sessions: sessionStats,
    directions: dirStats,
    combinations: comboStats,
    verdict,
  } = audit;

  // Open drill-down for any item (accepts pre-computed cluster trades array or fallback predicate)
  const inspectClusterTrades = (
    title: string,
    filterOrTrades: ((t: Trade) => boolean) | Trade[]
  ) => {
    const matching = Array.isArray(filterOrTrades)
      ? filterOrTrades
      : filteredTrades.filter(filterOrTrades);
    setDrillDownCluster({ title, trades: matching });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/30';
    if (score >= 65) return 'text-[#7C3AED] dark:text-[#8B5CF6] bg-violet-500/10 border-violet-500/30';
    if (score >= 45) return 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/30';
    if (score >= 25) return 'text-[#6B7280] dark:text-[#8B92A0] bg-slate-500/10 border-slate-500/25';
    return 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/30';
  };

  return (
    <div className="space-y-6 text-[#1A1D23] dark:text-[#E6E8EB] font-sans select-none pb-12" id="view-my-edge">
      {/* 1. TOP HEADER & QUESTION MOTHER CARD */}
      <div className="rounded-3xl border border-slate-200/60 dark:border-[#1C2430] bg-white dark:bg-[#131820] p-6 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/20 dark:border-[#8B5CF6]/25 shadow-xs">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#1A1D23] dark:text-[#E6E8EB] flex items-center gap-2">
                  <span>My Edge</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/20 dark:border-[#8B5CF6]/25 font-bold tabular-nums font-mono">
                    Basé sur vos {filteredTrades.length} trades réels
                  </span>
                </h1>
                <p className="text-xs text-[#6B7280] dark:text-[#8B92A0] font-normal mt-0.5">
                  Identification mathématique transparente des conditions de marché où votre rentabilité est statistiquement prouvée
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFormulaModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] hover:bg-slate-100 dark:hover:bg-[#1C2430] text-[#1A1D23] dark:text-[#E6E8EB] border border-slate-200/60 dark:border-[#1C2430] text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Calculator className="w-4 h-4 text-[#7C3AED] dark:text-[#8B5CF6]" />
              <span>Transparence Edge Score</span>
            </button>
            <button
              onClick={handleOpenSetups}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#7C3AED] dark:bg-[#8B5CF6] hover:opacity-90 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Sliders className="w-4 h-4" />
              <span>Gérer les Setups</span>
            </button>
          </div>
        </div>

        {/* Central Core Question & Key Takeaway Banner */}
        <div className="mt-5 p-4 rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Award className="w-5 h-5 text-[#7C3AED] dark:text-[#8B5CF6] shrink-0 mt-0.5" />
            <div>
              <span className="text-[11px] uppercase font-bold tracking-wider text-[#7C3AED] dark:text-[#8B5CF6] block">
                Verdict Stratégique — Dans quelles conditions votre stratégie fonctionne-t-elle le mieux ?
              </span>
              <p className="text-sm font-medium text-[#1A1D23] dark:text-[#E6E8EB] mt-1">
                {verdict.keyTakeaway}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] text-center">
              <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] block font-normal">Meilleure Paire</span>
              <span className="text-xs font-bold text-[#7C3AED] dark:text-[#8B5CF6] font-mono">
                {verdict.bestPair ? verdict.bestPair.label : 'N/A'}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] text-center">
              <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] block font-normal">Meilleure Killzone</span>
              <span className="text-xs font-bold text-[#7C3AED] dark:text-[#8B5CF6]">
                {verdict.bestSession ? formatKillzone(verdict.bestSession.label) : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. DYNAMIC MULTI-DIMENSIONAL FILTERS BAR (6 FILTRES SYNCHRONISÉS) */}
      <div className="p-4 rounded-3xl border border-slate-200/60 dark:border-[#1C2430] bg-white dark:bg-[#131820] shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-[#6B7280] dark:text-[#8B92A0] mr-1">
          <Filter className="w-3.5 h-3.5 text-[#7C3AED] dark:text-[#8B5CF6]" />
          <span>Filtres Edge :</span>
        </div>

        {/* 1. Period */}
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200/60 dark:border-[#1C2430] bg-[#F7F8FA] dark:bg-[#181F2A] text-[#1A1D23] dark:text-[#E6E8EB] focus:ring-2 focus:ring-violet-500 outline-none cursor-pointer"
        >
          <option value="ALL">Période : Toute</option>
          <option value="7D">7 derniers jours</option>
          <option value="30D">30 derniers jours</option>
          <option value="MONTH">Ce mois-ci</option>
          <option value="YEAR">Cette année</option>
        </select>

        {/* 2. Pair / Symbol */}
        <select
          value={selectedSymbol}
          onChange={(e) => setSelectedSymbol(e.target.value)}
          className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200/60 dark:border-[#1C2430] bg-[#F7F8FA] dark:bg-[#181F2A] text-[#1A1D23] dark:text-[#E6E8EB] focus:ring-2 focus:ring-violet-500 outline-none cursor-pointer"
        >
          <option value="ALL">Toutes les paires ({availableSymbols.length})</option>
          {availableSymbols.map((sym) => (
            <option key={sym} value={sym}>
              {sym}
            </option>
          ))}
        </select>

        {/* 3. Setup */}
        <select
          value={selectedSetup}
          onChange={(e) => setSelectedSetup(e.target.value)}
          className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200/60 dark:border-[#1C2430] bg-[#F7F8FA] dark:bg-[#181F2A] text-[#1A1D23] dark:text-[#E6E8EB] focus:ring-2 focus:ring-violet-500 outline-none cursor-pointer"
        >
          <option value="ALL">Tous les setups ({availableSetupsList.length})</option>
          {availableSetupsList.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>

        {/* 4. Killzone */}
        <select
          value={selectedSession}
          onChange={(e) => setSelectedSession(e.target.value)}
          className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200/60 dark:border-[#1C2430] bg-[#F7F8FA] dark:bg-[#181F2A] text-[#1A1D23] dark:text-[#E6E8EB] focus:ring-2 focus:ring-violet-500 outline-none cursor-pointer"
        >
          <option value="ALL">Toutes les killzones</option>
          <option value="LONDON">London Killzone (09:00 - 12:00 Madag.)</option>
          <option value="NEW_YORK">New York Killzone (14:00 - 17:00 Madag.)</option>
          <option value="ASIA">Asian Killzone (04:00 - 08:00 Madag.)</option>
          <option value="LONDON_CLOSE">London Close (18:00 - 20:00 Madag.)</option>
        </select>

        {/* 5. Direction */}
        <select
          value={selectedDirection}
          onChange={(e) => setSelectedDirection(e.target.value)}
          className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200/60 dark:border-[#1C2430] bg-[#F7F8FA] dark:bg-[#181F2A] text-[#1A1D23] dark:text-[#E6E8EB] focus:ring-2 focus:ring-violet-500 outline-none cursor-pointer"
        >
          <option value="ALL">Toutes directions (BUY &amp; SELL)</option>
          <option value="BUY">Achats uniquement (BUY)</option>
          <option value="SELL">Ventes uniquement (SELL)</option>
        </select>

        {/* 6. Result (WIN / LOSS / BE) */}
        <select
          value={selectedResult}
          onChange={(e) => setSelectedResult(e.target.value)}
          className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200/60 dark:border-[#1C2430] bg-[#F7F8FA] dark:bg-[#181F2A] text-[#1A1D23] dark:text-[#E6E8EB] focus:ring-2 focus:ring-violet-500 outline-none cursor-pointer"
        >
          <option value="ALL">Tous résultats (Gains, Pertes, BE)</option>
          <option value="WIN">Gagnants uniquement</option>
          <option value="LOSS">Perdants uniquement</option>
          <option value="BREAKEVEN">Breakeven uniquement</option>
        </select>

        {(selectedPeriod !== 'ALL' ||
          selectedSession !== 'ALL' ||
          selectedDirection !== 'ALL' ||
          selectedSymbol !== 'ALL' ||
          selectedSetup !== 'ALL' ||
          selectedResult !== 'ALL') && (
          <button
            onClick={() => {
              setSelectedPeriod('ALL');
              setSelectedSession('ALL');
              setSelectedDirection('ALL');
              setSelectedSymbol('ALL');
              setSelectedSetup('ALL');
              setSelectedResult('ALL');
            }}
            className="text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 hover:underline ml-auto font-semibold cursor-pointer"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>

      {/* 3. SAMPLE SIZE WARNING & STATISTICAL METHODOLOGY BANNER */}
      <div className="p-4 rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] flex items-start gap-3">
        <Info className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
        <div className="text-xs text-[#6B7280] dark:text-[#8B92A0] leading-relaxed">
          <strong className="text-[#1A1D23] dark:text-[#E6E8EB] font-semibold">Méthodologie Statistique &amp; Edge Score : </strong>
          L&apos;Edge Score (sur 100) est calculé selon 4 piliers mathématiques stricts : <strong>Espérance R</strong> (30 pts), <strong>Profit Factor</strong> (25 pts), <strong>Efficience Win Rate / RR</strong> (25 pts) et <strong>Robustesse de l&apos;échantillon</strong> (20 pts). Un échantillon inférieur à 5 trades est pondéré pour prévenir les faux positifs.
        </div>
      </div>

      {/* 4. SUB-NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-[#1C2430] pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('verdict')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'verdict'
              ? 'bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/25 dark:border-[#8B5CF6]/30 shadow-xs'
              : 'text-[#6B7280] dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB]'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Synthèse &amp; Verdict</span>
        </button>

        <button
          onClick={() => setActiveTab('combos')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'combos'
              ? 'bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/25 dark:border-[#8B5CF6]/30 shadow-xs'
              : 'text-[#6B7280] dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Combinaisons Setup × Paire × Killzone</span>
        </button>

        <button
          onClick={() => setActiveTab('setups')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'setups'
              ? 'bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/25 dark:border-[#8B5CF6]/30 shadow-xs'
              : 'text-[#6B7280] dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB]'
          }`}
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span>Par Setup ({setupStats.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('pairs')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'pairs'
              ? 'bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/25 dark:border-[#8B5CF6]/30 shadow-xs'
              : 'text-[#6B7280] dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB]'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Par Paire ({pairStats.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'sessions'
              ? 'bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/25 dark:border-[#8B5CF6]/30 shadow-xs'
              : 'text-[#6B7280] dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB]'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Par Killzone ({sessionStats.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('directions')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'directions'
              ? 'bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/25 dark:border-[#8B5CF6]/30 shadow-xs'
              : 'text-[#6B7280] dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB]'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Buy vs Sell</span>
        </button>
      </div>

      {/* 5. TAB 1: SYNTHÈSE & VERDICT EXÉCUTIF */}
      {activeTab === 'verdict' && (
        <div className="space-y-6">
          {/* Top 4 Performance Matrix Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* CARD 1: BEST SETUP */}
            <div className="p-5 rounded-3xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-sm dark:shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-[#6B7280] dark:text-[#8B92A0] font-medium">Meilleur Setup</span>
                  {verdict.bestSetup && (
                    <button
                      onClick={() =>
                        setSelectedScoreBreakdown({
                          title: verdict.bestSetup!.label,
                          breakdown: verdict.bestSetup!.edgeScore,
                        })
                      }
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border cursor-pointer ${getScoreColor(
                        verdict.bestSetup.edgeScore.totalScore
                      )}`}
                    >
                      Score : {verdict.bestSetup.edgeScore.totalScore}/100
                    </button>
                  )}
                </div>
                <div className="text-lg font-bold text-[#1A1D23] dark:text-[#E6E8EB] truncate">
                  {verdict.bestSetup ? verdict.bestSetup.label : 'Données insuffisantes'}
                </div>
              </div>

              {verdict.bestSetup && (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#1C2430] space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-[#8B92A0]">Win Rate :</span>
                    <span className="font-bold tabular-nums font-mono text-[#10B981]">{verdict.bestSetup.winRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-[#8B92A0]">P&amp;L Net :</span>
                    <span className="font-bold tabular-nums font-mono text-[#7C3AED] dark:text-[#8B5CF6]">
                      {formatCurrency(verdict.bestSetup.totalNetPnL, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-[#8B92A0]">Expectancy :</span>
                    <span className="font-semibold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB]">
                      {formatCurrency(verdict.bestSetup.monetaryExpectancy, currency)}/trade
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* CARD 2: MEILLEURE PAIRE */}
            <div className="p-5 rounded-3xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-sm dark:shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-[#6B7280] dark:text-[#8B92A0] font-medium">Meilleure Paire</span>
                  {verdict.bestPair && (
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/20 dark:border-[#8B5CF6]/25 font-mono">
                      n = {verdict.bestPair.sampleSize}
                    </span>
                  )}
                </div>
                <div className="text-lg font-bold text-[#1A1D23] dark:text-[#E6E8EB] font-mono">
                  {verdict.bestPair ? verdict.bestPair.label : 'N/A'}
                </div>
              </div>

              {verdict.bestPair && (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#1C2430] space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-[#8B92A0]">Win Rate :</span>
                    <span className="font-bold tabular-nums font-mono text-[#10B981]">{verdict.bestPair.winRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-[#8B92A0]">P&amp;L Net :</span>
                    <span className="font-bold tabular-nums font-mono text-[#7C3AED] dark:text-[#8B5CF6]">
                      {formatCurrency(verdict.bestPair.totalNetPnL, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-[#8B92A0]">Profit Factor :</span>
                    <span className="font-semibold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB]">
                      {verdict.bestPair.profitFactor ? verdict.bestPair.profitFactor.toFixed(2) : '—'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* CARD 3: MEILLEURE KILLZONE */}
            <div className="p-5 rounded-3xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-sm dark:shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-[#6B7280] dark:text-[#8B92A0] font-medium">Meilleure Killzone</span>
                  {verdict.bestSession && (
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/20 dark:border-[#8B5CF6]/25 font-mono">
                      n = {verdict.bestSession.sampleSize}
                    </span>
                  )}
                </div>
                <div className="text-lg font-bold text-[#1A1D23] dark:text-[#E6E8EB]">
                  {verdict.bestSession ? formatKillzone(verdict.bestSession.label) : 'N/A'}
                </div>
              </div>

              {verdict.bestSession && (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#1C2430] space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-[#8B92A0]">Win Rate :</span>
                    <span className="font-bold tabular-nums font-mono text-[#10B981]">{verdict.bestSession.winRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-[#8B92A0]">P&amp;L Net :</span>
                    <span className="font-bold tabular-nums font-mono text-[#7C3AED] dark:text-[#8B5CF6]">
                      {formatCurrency(verdict.bestSession.totalNetPnL, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-[#8B92A0]">Gains bruts :</span>
                    <span className="font-semibold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB]">
                      {formatCurrency(verdict.bestSession.grossProfit, currency)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* CARD 4: BUY VS SELL VERDICT */}
            <div className="p-5 rounded-3xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-sm dark:shadow-md flex flex-col justify-between">
              <div>
                <span className="text-xs font-medium text-[#6B7280] dark:text-[#8B92A0] block mb-1.5">Biais Directionnel</span>
                <div className="text-lg font-bold text-[#1A1D23] dark:text-[#E6E8EB]">
                  {verdict.buyPerformance && verdict.sellPerformance
                    ? verdict.buyPerformance.totalNetPnL >= verdict.sellPerformance.totalNetPnL
                      ? 'BUY (Achats dominants)'
                      : 'SELL (Ventes dominantes)'
                    : 'Équilibré'}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#1C2430] space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#6B7280] dark:text-[#8B92A0]">BUY :</span>
                  <span className="font-semibold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB]">
                    {verdict.buyPerformance?.winRate}% WR ({verdict.buyPerformance?.sampleSize} tr.)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280] dark:text-[#8B92A0]">SELL :</span>
                  <span className="font-semibold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB]">
                    {verdict.sellPerformance?.winRate}% WR ({verdict.sellPerformance?.sampleSize} tr.)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280] dark:text-[#8B92A0]">P&amp;L Diff :</span>
                  <span className="font-bold tabular-nums font-mono text-[#7C3AED] dark:text-[#8B5CF6]">
                    {formatCurrency(
                      (verdict.buyPerformance?.totalNetPnL || 0) -
                        (verdict.sellPerformance?.totalNetPnL || 0),
                      currency
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recurring Conditions of Performance Section */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-sm dark:shadow-md space-y-4">
            <h2 className="text-base font-bold text-[#1A1D23] dark:text-[#E6E8EB] tracking-tight flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#7C3AED] dark:text-[#8B5CF6]" />
              <span>Conditions Récurrentes de Performance</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {verdict.recurringConditions.map((cond, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] flex items-start gap-3"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#7C3AED] dark:text-[#8B5CF6] shrink-0 mt-0.5" />
                  <p className="text-xs text-[#1A1D23] dark:text-[#E6E8EB] font-medium leading-relaxed">{cond}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Top Combinations Table Preview */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-sm dark:shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#1A1D23] dark:text-[#E6E8EB] tracking-tight">
                  Top Combinaisons Gagnantes (Setup × Paire × Killzone)
                </h2>
                <p className="text-xs text-[#6B7280] dark:text-[#8B92A0] font-normal">
                  Identifiez exactement la confluence multi-facteurs la plus rentable et son Edge Score transparent
                </p>
              </div>
              <button
                onClick={() => setActiveTab('combos')}
                className="text-xs font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 hover:underline cursor-pointer"
              >
                Voir toutes les combinaisons →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/60 dark:border-[#1C2430] text-[#6B7280] dark:text-[#8B92A0] uppercase text-[10px] tracking-wider">
                    <th className="pb-3 font-semibold">Combinaison</th>
                    <th className="pb-3 font-semibold text-center">Échantillon (n)</th>
                    <th className="pb-3 font-semibold text-center">Win Rate</th>
                    <th className="pb-3 font-semibold text-right">P&amp;L Net</th>
                    <th className="pb-3 font-semibold text-right">Total R</th>
                    <th className="pb-3 font-semibold text-center">Edge Score</th>
                    <th className="pb-3 font-semibold text-center">Fiabilité</th>
                    <th className="pb-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1C2430]">
                  {comboStats.slice(0, 5).map((combo, idx) => (
                    <tr key={idx} className="hover:bg-[#F7F8FA] dark:hover:bg-[#181F2A] transition">
                      <td className="py-3 font-semibold text-[#1A1D23] dark:text-[#E6E8EB]">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/20 dark:border-[#8B5CF6]/25 font-bold font-mono">
                            {combo.pair}
                          </span>
                          <span className="text-slate-400 dark:text-[#8B92A0]">+</span>
                          <span className="text-[#1A1D23] dark:text-[#E6E8EB]">{formatKillzone(combo.session)}</span>
                          <span className="text-slate-400 dark:text-[#8B92A0]">+</span>
                          <span className="text-[#7C3AED] dark:text-[#8B5CF6] font-medium">{combo.setup}</span>
                        </div>
                      </td>
                      <td className="py-3 text-center font-bold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB]">
                        {combo.sampleSize} trades
                      </td>
                      <td className="py-3 text-center font-bold tabular-nums font-mono text-[#10B981]">
                        {combo.winRate}%
                      </td>
                      <td
                        className={`py-3 text-right font-bold tabular-nums font-mono ${
                          combo.totalNetPnL >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                        }`}
                      >
                        {formatCurrency(combo.totalNetPnL, currency)}
                      </td>
                      <td className="py-3 text-right font-bold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB]">
                        {combo.totalR !== null ? `${combo.totalR > 0 ? '+' : ''}${combo.totalR}R` : '—'}
                      </td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() =>
                            setSelectedScoreBreakdown({
                              title: `${combo.pair} + ${formatKillzone(combo.session)} + ${combo.setup}`,
                              breakdown: combo.edgeScore,
                            })
                          }
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border cursor-pointer font-mono ${getScoreColor(
                            combo.edgeScore.totalScore
                          )}`}
                        >
                          {combo.edgeScore.totalScore}/100
                        </button>
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            combo.confidenceTier === 'CONFIRMED'
                              ? 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30'
                              : combo.confidenceTier === 'DEVELOPING'
                              ? 'bg-[#F59E0B]/10 text-amber-700 dark:text-[#F59E0B] border border-[#F59E0B]/30'
                              : 'bg-slate-100 dark:bg-[#181F2A] text-[#6B7280] dark:text-[#8B92A0] border border-slate-200/60 dark:border-[#1C2430]'
                          }`}
                        >
                          {combo.confidenceTier === 'CONFIRMED'
                            ? 'Confirmé'
                            : combo.confidenceTier === 'DEVELOPING'
                            ? 'Développement'
                            : 'Échantillon faible'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() =>
                            inspectClusterTrades(
                              `${combo.pair} + ${formatKillzone(combo.session)} + ${combo.setup}`,
                              combo.trades && combo.trades.length > 0
                                ? combo.trades
                                : (t) =>
                                    (t.symbol || '').toUpperCase().trim() === combo.pair &&
                                    getTradeSession(t, userTimezone) === combo.session &&
                                    (t.setup?.trim() || t.setupId || 'Général') === combo.setup
                            )
                          }
                          className="text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 hover:underline font-bold cursor-pointer"
                        >
                          Inspecter
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. TAB 2: COMBINAISONS DÉTAILLÉES (SETUP × PAIRE × KILLZONE) */}
      {activeTab === 'combos' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-sm dark:shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#1A1D23] dark:text-[#E6E8EB] tracking-tight">
                Toutes les Combinaisons Détectées ({comboStats.length})
              </h2>
              <p className="text-xs text-[#6B7280] dark:text-[#8B92A0] font-normal">
                Échantillon complet classé par rentabilité nette avec Edge Score explicable
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/60 dark:border-[#1C2430] text-[#6B7280] dark:text-[#8B92A0] uppercase text-[10px] tracking-wider">
                  <th className="pb-3 font-semibold">Paire</th>
                  <th className="pb-3 font-semibold">Killzone</th>
                  <th className="pb-3 font-semibold">Setup</th>
                  <th className="pb-3 font-semibold text-center">Trades (n)</th>
                  <th className="pb-3 font-semibold text-center">Win Rate</th>
                  <th className="pb-3 font-semibold text-right">P&amp;L Net</th>
                  <th className="pb-3 font-semibold text-right">Total R</th>
                  <th className="pb-3 font-semibold text-center">Edge Score</th>
                  <th className="pb-3 font-semibold text-center">Statut Échantillon</th>
                  <th className="pb-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1C2430]">
                {comboStats.map((combo, idx) => (
                  <tr key={idx} className="hover:bg-[#F7F8FA] dark:hover:bg-[#181F2A] transition">
                    <td className="py-3 font-bold font-mono text-[#7C3AED] dark:text-[#8B5CF6]">{combo.pair}</td>
                    <td className="py-3 font-medium text-[#1A1D23] dark:text-[#E6E8EB]">{formatKillzone(combo.session)}</td>
                    <td className="py-3 font-medium text-[#7C3AED] dark:text-[#8B5CF6]">{combo.setup}</td>
                    <td className="py-3 text-center font-bold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB]">
                      {combo.sampleSize}
                    </td>
                    <td className="py-3 text-center font-bold tabular-nums font-mono text-[#10B981]">
                      {combo.winRate}%
                    </td>
                    <td
                      className={`py-3 text-right font-bold tabular-nums font-mono ${
                        combo.totalNetPnL >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                      }`}
                    >
                      {formatCurrency(combo.totalNetPnL, currency)}
                    </td>
                    <td className="py-3 text-right font-bold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB]">
                      {combo.totalR !== null ? `${combo.totalR > 0 ? '+' : ''}${combo.totalR}R` : '—'}
                    </td>
                    <td className="py-3 text-center">
                      <button
                        onClick={() =>
                          setSelectedScoreBreakdown({
                            title: `${combo.pair} + ${formatKillzone(combo.session)} + ${combo.setup}`,
                            breakdown: combo.edgeScore,
                          })
                        }
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border cursor-pointer font-mono ${getScoreColor(
                          combo.edgeScore.totalScore
                        )}`}
                      >
                        {combo.edgeScore.totalScore}/100
                      </button>
                    </td>
                    <td className="py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          combo.confidenceTier === 'CONFIRMED'
                            ? 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30'
                            : combo.confidenceTier === 'DEVELOPING'
                            ? 'bg-[#F59E0B]/10 text-amber-700 dark:text-[#F59E0B] border border-[#F59E0B]/30'
                            : 'bg-slate-100 dark:bg-[#181F2A] text-[#6B7280] dark:text-[#8B92A0] border border-slate-200/60 dark:border-[#1C2430]'
                        }`}
                      >
                        {combo.confidenceTier === 'CONFIRMED'
                          ? 'Confirmé (≥15)'
                          : combo.confidenceTier === 'DEVELOPING'
                          ? 'Développement (5-14)'
                          : 'Faible (<5)'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() =>
                          inspectClusterTrades(
                            `${combo.pair} + ${formatKillzone(combo.session)} + ${combo.setup}`,
                            combo.trades && combo.trades.length > 0
                              ? combo.trades
                              : (t) =>
                                  (t.symbol || '').toUpperCase().trim() === combo.pair &&
                                  getTradeSession(t, userTimezone) === combo.session &&
                                  (t.setup?.trim() || t.setupId || 'Général') === combo.setup
                          )
                        }
                        className="text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 hover:underline font-bold cursor-pointer"
                      >
                        Détails
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. TAB 3: ANALYSE PAR SETUP */}
      {activeTab === 'setups' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {setupStats.map((st) => (
            <div
              key={st.key}
              className="p-5 rounded-3xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-sm dark:shadow-md flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="text-[10px] uppercase font-bold text-[#6B7280] dark:text-[#8B92A0]">
                    {st.category || 'Setup'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setSelectedScoreBreakdown({
                          title: st.label,
                          breakdown: st.edgeScore,
                        })
                      }
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border cursor-pointer ${getScoreColor(
                        st.edgeScore.totalScore
                      )}`}
                    >
                      Edge Score : {st.edgeScore.totalScore}/100
                    </button>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                        st.confidenceTier === 'CONFIRMED'
                          ? 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30'
                          : st.confidenceTier === 'DEVELOPING'
                          ? 'bg-[#F59E0B]/10 text-amber-700 dark:text-[#F59E0B] border border-[#F59E0B]/30'
                          : 'bg-slate-100 dark:bg-[#181F2A] text-[#6B7280] dark:text-[#8B92A0] border border-slate-200/60 dark:border-[#1C2430]'
                      }`}
                    >
                      n = {st.sampleSize}
                    </span>
                  </div>
                </div>
                <h3 className="text-base font-bold text-[#1A1D23] dark:text-[#E6E8EB]">{st.label}</h3>
              </div>

              <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 dark:border-[#1C2430] text-center">
                <div>
                  <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] block font-normal">Win Rate</span>
                  <span className="text-sm font-bold tabular-nums font-mono text-[#10B981]">{st.winRate}%</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] block font-normal">Profit Factor</span>
                  <span className="text-sm font-bold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB]">
                    {st.profitFactor ? st.profitFactor.toFixed(2) : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] block font-normal">Expectancy</span>
                  <span className="text-sm font-bold tabular-nums font-mono text-[#7C3AED] dark:text-[#8B5CF6]">
                    {st.rExpectancy !== null
                      ? `${st.rExpectancy > 0 ? '+' : ''}${st.rExpectancy}R`
                      : formatCurrency(st.monetaryExpectancy, currency)}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#6B7280] dark:text-[#8B92A0]">P&amp;L Net :</span>
                  <span
                    className={`font-bold tabular-nums font-mono ${
                      st.totalNetPnL >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                    }`}
                  >
                    {st.totalNetPnL >= 0 ? '+' : ''}
                    {formatCurrency(st.totalNetPnL, currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280] dark:text-[#8B92A0]">Total R réalisé :</span>
                  <span className="font-semibold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB]">
                    {st.totalR !== null ? `${st.totalR > 0 ? '+' : ''}${st.totalR}R` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280] dark:text-[#8B92A0]">Gains / Pertes :</span>
                  <span className="text-[#1A1D23] dark:text-[#E6E8EB] font-medium font-mono">
                    {st.wins}W / {st.losses}L ({st.breakevens} BE)
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-[#1C2430] flex items-center justify-between">
                <button
                  onClick={() =>
                    setSelectedScoreBreakdown({
                      title: st.label,
                      breakdown: st.edgeScore,
                    })
                  }
                  className="text-[11px] text-[#6B7280] dark:text-[#8B92A0] hover:text-violet-600 dark:hover:text-violet-400 font-medium cursor-pointer"
                >
                  Pourquoi ce score ? →
                </button>
                <button
                  onClick={() =>
                    inspectClusterTrades(
                      st.label,
                      st.trades && st.trades.length > 0
                        ? st.trades
                        : (t) => {
                            const s = t.setup?.trim() || t.setupId || 'Non défini / Général';
                            return s === st.key || s === st.label;
                          }
                    )
                  }
                  className="text-xs font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 hover:underline cursor-pointer"
                >
                  Voir trades
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 8. TAB 4: ANALYSE PAR PAIRE */}
      {activeTab === 'pairs' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-sm dark:shadow-md space-y-4">
          <h2 className="text-base font-bold text-[#1A1D23] dark:text-[#E6E8EB] tracking-tight">
            Classement de Performance par Paire / Actif ({pairStats.length})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/60 dark:border-[#1C2430] text-[#6B7280] dark:text-[#8B92A0] uppercase text-[10px] tracking-wider">
                  <th className="pb-3 font-semibold">Symbole</th>
                  <th className="pb-3 font-semibold text-center">Trades (n)</th>
                  <th className="pb-3 font-semibold text-center">Win Rate</th>
                  <th className="pb-3 font-semibold text-right">P&amp;L Net</th>
                  <th className="pb-3 font-semibold text-right">Gains Bruts</th>
                  <th className="pb-3 font-semibold text-right">Pertes Brutes</th>
                  <th className="pb-3 font-semibold text-center">Profit Factor</th>
                  <th className="pb-3 font-semibold text-right">Gain Moyen</th>
                  <th className="pb-3 font-semibold text-right">Perte Moyenne</th>
                  <th className="pb-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1C2430]">
                {pairStats.map((p) => (
                  <tr key={p.key} className="hover:bg-[#F7F8FA] dark:hover:bg-[#181F2A] transition">
                    <td className="py-3 font-bold text-[#1A1D23] dark:text-[#E6E8EB] flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/20 dark:border-[#8B5CF6]/25 font-bold font-mono">
                        {p.label}
                      </span>
                    </td>
                    <td className="py-3 text-center font-bold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB]">
                      {p.sampleSize}
                    </td>
                    <td className="py-3 text-center font-bold tabular-nums font-mono text-[#10B981]">
                      {p.winRate}%
                    </td>
                    <td
                      className={`py-3 text-right font-bold tabular-nums font-mono ${
                        p.totalNetPnL >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                      }`}
                    >
                      {formatCurrency(p.totalNetPnL, currency)}
                    </td>
                    <td className="py-3 text-right font-medium text-[#10B981] tabular-nums font-mono">
                      {formatCurrency(p.grossProfit, currency)}
                    </td>
                    <td className="py-3 text-right font-medium text-[#EF4444] tabular-nums font-mono">
                      {formatCurrency(-p.grossLoss, currency)}
                    </td>
                    <td className="py-3 text-center font-bold text-[#1A1D23] dark:text-[#E6E8EB] tabular-nums font-mono">
                      {p.profitFactor ? p.profitFactor.toFixed(2) : '—'}
                    </td>
                    <td className="py-3 text-right text-[#1A1D23] dark:text-[#E6E8EB] tabular-nums font-mono">
                      {formatCurrency(p.avgWin, currency)}
                    </td>
                    <td className="py-3 text-right text-[#6B7280] dark:text-[#8B92A0] tabular-nums font-mono">
                      {formatCurrency(-p.avgLoss, currency)}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() =>
                          inspectClusterTrades(
                            p.label,
                            p.trades && p.trades.length > 0
                              ? p.trades
                              : (t) => (t.symbol || '').toUpperCase().trim() === p.key
                          )
                        }
                        className="text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 hover:underline font-bold cursor-pointer"
                      >
                        Inspecter
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 9. TAB 5: ANALYSE PAR KILLZONE */}
      {activeTab === 'sessions' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-sm dark:shadow-md space-y-4">
          <h2 className="text-base font-bold text-[#1A1D23] dark:text-[#E6E8EB] tracking-tight">
            Performance par Killzone ({sessionStats.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {sessionStats.map((s) => (
              <div
                key={s.key}
                className="p-5 rounded-3xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] shadow-xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-[#6B7280] dark:text-[#8B92A0] font-medium">Killzone</span>
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white dark:bg-[#131820] text-[#7C3AED] dark:text-[#8B5CF6] border border-slate-200/60 dark:border-[#1C2430] font-mono">
                      n = {s.sampleSize}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#1A1D23] dark:text-[#E6E8EB]">{formatKillzone(s.label)}</h3>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-[#8B92A0]">Win Rate :</span>
                    <span className="font-bold tabular-nums font-mono text-[#10B981]">{s.winRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-[#8B92A0]">P&amp;L Net :</span>
                    <span
                      className={`font-bold tabular-nums font-mono ${
                        s.totalNetPnL >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                      }`}
                    >
                      {formatCurrency(s.totalNetPnL, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-[#8B92A0]">Profit Factor :</span>
                    <span className="font-semibold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB]">
                      {s.profitFactor ? s.profitFactor.toFixed(2) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-[#8B92A0]">Répartition :</span>
                    <span className="text-[#1A1D23] dark:text-[#E6E8EB] font-medium font-mono">
                      {s.wins}W / {s.losses}L
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/60 dark:border-[#1C2430] flex justify-end">
                  <button
                    onClick={() =>
                      inspectClusterTrades(
                        formatKillzone(s.label),
                        s.trades && s.trades.length > 0
                          ? s.trades
                          : (t) => {
                              const calculated = getTradeSession(t, userTimezone);
                              return calculated === s.key || calculated === s.label;
                            }
                      )
                    }
                    className="text-xs font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 hover:underline cursor-pointer"
                  >
                    Voir trades
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 10. TAB 6: BUY VS SELL */}
      {activeTab === 'directions' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {dirStats.map((d) => (
            <div
              key={d.key}
              className="p-6 rounded-3xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-sm dark:shadow-md space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      d.key === 'BUY'
                        ? 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30'
                        : 'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/30'
                    }`}
                  >
                    {d.key}
                  </span>
                  <h3 className="text-base font-bold text-[#1A1D23] dark:text-[#E6E8EB]">{d.label}</h3>
                </div>
                <span className="text-xs text-[#6B7280] dark:text-[#8B92A0] font-medium font-mono">
                  {d.sampleSize} trades enregistrés
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 py-4 border-y border-slate-100 dark:border-[#1C2430] text-center">
                <div>
                  <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] block font-normal">Win Rate</span>
                  <span className="text-lg font-bold tabular-nums font-mono text-[#10B981]">{d.winRate}%</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] block font-normal">Profit Factor</span>
                  <span className="text-lg font-bold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB]">
                    {d.profitFactor ? d.profitFactor.toFixed(2) : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] block font-normal">P&amp;L Net</span>
                  <span
                    className={`text-lg font-bold tabular-nums font-mono ${
                      d.totalNetPnL >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                    }`}
                  >
                    {formatCurrency(d.totalNetPnL, currency)}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#6B7280] dark:text-[#8B92A0]">Total Gains bruts :</span>
                  <span className="font-semibold tabular-nums font-mono text-[#10B981]">
                    {formatCurrency(d.grossProfit, currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280] dark:text-[#8B92A0]">Total Pertes brutes :</span>
                  <span className="font-semibold tabular-nums font-mono text-[#EF4444]">
                    {formatCurrency(-d.grossLoss, currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280] dark:text-[#8B92A0]">Moyenne par trade :</span>
                  <span className="font-semibold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB]">
                    {formatCurrency(d.avgReturn, currency)}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-[#1C2430] flex justify-end">
                <button
                  onClick={() =>
                    inspectClusterTrades(
                      d.label,
                      d.trades && d.trades.length > 0
                        ? d.trades
                        : (t) => (t.direction === 'SELL' ? 'SELL' : 'BUY') === d.key
                    )
                  }
                  className="text-xs font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 hover:underline cursor-pointer"
                >
                  Inspecter les trades {d.key}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 11. TRANSPARENT EDGE SCORE FORMULA MODAL */}
      {showFormulaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-[#1C2430] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-violet-500/10 text-[#7C3AED] dark:text-[#8B5CF6] border border-violet-500/20">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#1A1D23] dark:text-[#E6E8EB]">Transparence de l&apos;Edge Score</h3>
                  <p className="text-xs text-[#6B7280] dark:text-[#8B92A0]">
                    Calcul mathématique objectif sur 100 points, sans algorithme arbitraire
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFormulaModal(false)}
                className="text-slate-400 hover:text-[#6B7280] dark:text-[#8B92A0] dark:hover:text-[#E6E8EB] text-sm font-semibold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-[#1A1D23] dark:text-[#E6E8EB]">
              <p className="leading-relaxed text-[#6B7280] dark:text-[#8B92A0]">
                L&apos;Edge Score quantifie la qualité réelle d&apos;un setup ou d&apos;une condition de marché en combinant 4 piliers mathématiques fondamentaux :
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[#1A1D23] dark:text-[#E6E8EB]">1. Espérance Mathématique (Expectancy)</span>
                    <span className="px-2 py-0.5 rounded-lg bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/20 dark:border-[#8B5CF6]/25 font-bold font-mono">30 pts</span>
                  </div>
                  <p className="text-[#6B7280] dark:text-[#8B92A0] text-[11px]">
                    Mesure le gain net moyen par unité de risque (R) ou en devise sur le long terme (E &gt; 0.5R pour le score maximal).
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[#1A1D23] dark:text-[#E6E8EB]">2. Facteur de Profit (Profit Factor)</span>
                    <span className="px-2 py-0.5 rounded-lg bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/20 dark:border-[#8B5CF6]/25 font-bold font-mono">25 pts</span>
                  </div>
                  <p className="text-[#6B7280] dark:text-[#8B92A0] text-[11px]">
                    Ratio exact Gains bruts / Pertes brutes. Score maximal si PF &ge; 2.50, nul si PF &lt; 1.0.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[#1A1D23] dark:text-[#E6E8EB]">3. Efficience Win Rate × R/R</span>
                    <span className="px-2 py-0.5 rounded-lg bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/20 dark:border-[#8B5CF6]/25 font-bold font-mono">25 pts</span>
                  </div>
                  <p className="text-[#6B7280] dark:text-[#8B92A0] text-[11px]">
                    Compare le Win Rate effectif au seuil neutre de rentabilité (100 / (1 + RR)).
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[#1A1D23] dark:text-[#E6E8EB]">4. Robustesse Statistique (Sample Size)</span>
                    <span className="px-2 py-0.5 rounded-lg bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/20 dark:border-[#8B5CF6]/25 font-bold font-mono">20 pts</span>
                  </div>
                  <p className="text-[#6B7280] dark:text-[#8B92A0] text-[11px]">
                    Pénalise les séries courtes (n &lt; 5 trades = max 3 pts) pour éviter de confondre chance ponctuelle et réel avantage.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200/60 dark:border-[#1C2430] flex justify-end">
              <button
                onClick={() => setShowFormulaModal(false)}
                className="px-5 py-2.5 bg-[#7C3AED] dark:bg-[#8B5CF6] hover:opacity-90 text-white rounded-2xl text-xs font-bold transition shadow-md cursor-pointer"
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 12. INDIVIDUAL SCORE BREAKDOWN POPUP */}
      {selectedScoreBreakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-[#1C2430] pb-4">
              <div>
                <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] uppercase font-semibold">
                  Décomposition de l&apos;Edge Score
                </span>
                <h3 className="text-lg font-bold text-[#1A1D23] dark:text-[#E6E8EB]">
                  {selectedScoreBreakdown.title}
                </h3>
              </div>
              <div
                className={`px-3 py-1 rounded-xl text-sm font-bold border font-mono ${getScoreColor(
                  selectedScoreBreakdown.breakdown.totalScore
                )}`}
              >
                {selectedScoreBreakdown.breakdown.totalScore} / 100 · {selectedScoreBreakdown.breakdown.ratingLabel}
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#1A1D23] dark:text-[#E6E8EB] font-semibold">1. Espérance Mathématique (Expectancy) :</span>
                  <span className="font-bold font-mono text-[#7C3AED] dark:text-[#8B5CF6]">
                    {selectedScoreBreakdown.breakdown.expectancyPoints} / 30 pts
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-[#131820] h-1.5 rounded-full overflow-hidden border border-slate-300 dark:border-[#1C2430]">
                  <div
                    className="bg-[#7C3AED] dark:bg-[#8B5CF6] h-full rounded-full"
                    style={{ width: `${(selectedScoreBreakdown.breakdown.expectancyPoints / 30) * 100}%` }}
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#1A1D23] dark:text-[#E6E8EB] font-semibold">2. Facteur de Profit (Profit Factor) :</span>
                  <span className="font-bold font-mono text-indigo-600 dark:text-indigo-400">
                    {selectedScoreBreakdown.breakdown.profitFactorPoints} / 25 pts
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-[#131820] h-1.5 rounded-full overflow-hidden border border-slate-300 dark:border-[#1C2430]">
                  <div
                    className="bg-indigo-600 h-full rounded-full"
                    style={{ width: `${(selectedScoreBreakdown.breakdown.profitFactorPoints / 25) * 100}%` }}
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#1A1D23] dark:text-[#E6E8EB] font-semibold">3. Efficience Win Rate / RR :</span>
                  <span className="font-bold font-mono text-[#10B981]">
                    {selectedScoreBreakdown.breakdown.winRateEfficiencyPoints} / 25 pts
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-[#131820] h-1.5 rounded-full overflow-hidden border border-slate-300 dark:border-[#1C2430]">
                  <div
                    className="bg-emerald-500 h-full rounded-full"
                    style={{ width: `${(selectedScoreBreakdown.breakdown.winRateEfficiencyPoints / 25) * 100}%` }}
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#1A1D23] dark:text-[#E6E8EB] font-semibold">4. Fiabilité Statistique (Sample Size) :</span>
                  <span className="font-bold font-mono text-amber-600 dark:text-[#F59E0B]">
                    {selectedScoreBreakdown.breakdown.sampleConfidencePoints} / 20 pts
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-[#131820] h-1.5 rounded-full overflow-hidden border border-slate-300 dark:border-[#1C2430]">
                  <div
                    className="bg-amber-500 h-full rounded-full"
                    style={{ width: `${(selectedScoreBreakdown.breakdown.sampleConfidencePoints / 20) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Explanations list */}
            <div className="space-y-1.5 pt-2">
              <span className="text-[11px] font-semibold text-[#6B7280] dark:text-[#8B92A0]">Justifications mathématiques :</span>
              <ul className="space-y-1 text-xs text-[#1A1D23] dark:text-[#E6E8EB]">
                {selectedScoreBreakdown.breakdown.explanations.map((exp, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#7C3AED] dark:text-[#8B5CF6] font-bold">•</span>
                    <span>{exp}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-4 border-t border-slate-200/60 dark:border-[#1C2430] flex justify-end">
              <button
                onClick={() => setSelectedScoreBreakdown(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#181F2A] dark:hover:bg-[#1C2430] text-[#1A1D23] dark:text-[#E6E8EB] border border-slate-200/60 dark:border-[#1C2430] rounded-2xl text-xs font-semibold cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 13. DRILL-DOWN MODAL / TABLE OVERLAY */}
      {drillDownCluster && (
        <div ref={drillDownRef} className="p-6 rounded-3xl border border-slate-200/60 dark:border-[#1C2430] bg-white dark:bg-[#131820] shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#1A1D23] dark:text-[#E6E8EB] tracking-tight">
                Trades Loggés — &quot;{drillDownCluster.title}&quot; ({drillDownCluster.trades.length})
              </h2>
              <p className="text-xs text-[#6B7280] dark:text-[#8B92A0] font-normal">
                Inspection individuelle des positions réelles
              </p>
            </div>
            <button
              onClick={() => setDrillDownCluster(null)}
              className="text-xs text-[#6B7280] dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB] font-semibold cursor-pointer"
            >
              Fermer l&apos;inspection ✕
            </button>
          </div>

          {drillDownCluster.trades.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#6B7280] dark:text-[#8B92A0]">
              Aucun trade correspondant dans la sélection.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/60 dark:border-[#1C2430] text-[#6B7280] dark:text-[#8B92A0] uppercase text-[10px] tracking-wider">
                    <th className="pb-2.5 font-semibold">Symbole</th>
                    <th className="pb-2.5 font-semibold">Sens</th>
                    <th className="pb-2.5 font-semibold">Setup</th>
                    <th className="pb-2.5 font-semibold">Killzone</th>
                    <th className="pb-2.5 font-semibold">Date Clôture</th>
                    <th className="pb-2.5 font-semibold text-right">P&amp;L Net</th>
                    <th className="pb-2.5 font-semibold text-right">R-Multiple</th>
                    <th className="pb-2.5 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1C2430]">
                  {drillDownCluster.trades.map((t) => (
                    <tr key={t.id} className="hover:bg-[#F7F8FA] dark:hover:bg-[#181F2A] transition">
                      <td className="py-2.5 font-bold font-mono text-[#1A1D23] dark:text-[#E6E8EB]">{t.symbol}</td>
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                            t.direction === 'BUY'
                              ? 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30'
                              : 'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/30'
                          }`}
                        >
                          {t.direction}
                        </span>
                      </td>
                      <td className="py-2.5 text-[#7C3AED] dark:text-[#8B5CF6] font-medium truncate max-w-[140px]">
                        {t.setup?.trim() || t.setupId || 'Général'}
                      </td>
                      <td className="py-2.5 text-[#1A1D23] dark:text-[#E6E8EB] font-medium">{formatKillzone(getTradeSession(t, userTimezone))}</td>
                      <td className="py-2.5 text-[#6B7280] dark:text-[#8B92A0] tabular-nums font-mono">
                        {t.closedAt ? new Date(t.closedAt).toLocaleDateString('fr-FR') : 'Ouvert'}
                      </td>
                      <td
                        className={`py-2.5 text-right tabular-nums font-bold font-mono ${
                          (t.netPnL ?? 0) >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                        }`}
                      >
                        {formatCurrency(t.netPnL ?? 0, currency)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums font-semibold font-mono text-[#1A1D23] dark:text-[#E6E8EB]">
                        {t.rMultiple !== null && t.rMultiple !== undefined
                          ? `${t.rMultiple >= 0 ? '+' : ''}${t.rMultiple.toFixed(2)}R`
                          : '—'}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => {
                            if (onSelectTrade) onSelectTrade(t);
                            setActiveTradeDetail(t);
                          }}
                          className="text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 hover:underline font-bold cursor-pointer"
                        >
                          Détails
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 14. TRADE DETAIL MODAL */}
      {activeTradeDetail && (
        <TradeDetailModal
          trade={activeTradeDetail}
          currency={currency}
          onClose={() => setActiveTradeDetail(null)}
        />
      )}
    </div>
  );
};
