import React, { useState, useMemo } from 'react';
import { Trade } from '../types/trade';
import { formatCurrency, formatRMultiple, formatPercent, formatDecimal } from '../lib/formatting';
import { calculateStreaks } from '../lib/calculations/streaks';
import { calculateDrawdown } from '../lib/calculations/drawdown';
import { calculateProfitFactor, calculateWinRate, calculateExpectancy } from '../lib/calculations/statistics';
import { isTradeRRComplete } from '../lib/calculations/riskReward';
import {
  calculateMyEdgeDeepAudit,
  EdgeScoreBreakdown,
  calculateTransparentEdgeScore,
} from '../lib/calculations/edge';
import { getTradeKillzone } from '../lib/sessionCalculator';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  BarChart3,
  Globe,
  Layers,
  Clock,
  Crosshair,
  Award,
  Compass,
  Calculator,
} from 'lucide-react';
import { TradeDetailModal } from './TradeDetailModal';
import { motion, AnimatePresence } from 'motion/react';
import { AnimatedNumber } from './AnimatedNumber';
import { EquityCurveChart } from './EquityCurveChart';
import { WeeklyPerformanceChart } from './WeeklyPerformanceChart';

interface AnalyticsViewProps {
  trades?: Trade[];
  currency?: string;
  initialBalance?: number;
  onSelectTrade?: (trade: Trade) => void;
  onNavigateToMyEdge?: () => void;
}

// Exact logical order requested:
// Performance globale → Performance par Setup → Performance par Session → Performance par Paire → Edge
type AnalyticsSubTab = 'overview' | 'setups' | 'sessions' | 'pairs' | 'edge' | 'directions' | 'timeline';

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  trades = [],
  currency = 'EUR',
  initialBalance: appInitialBalance = 10000,
  onSelectTrade,
  onNavigateToMyEdge,
}) => {
  const safeTrades = trades || [];

  // 6 Dynamic Interactive Filters
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('ALL');
  const [selectedSetup, setSelectedSetup] = useState<string>('ALL');
  const [selectedSession, setSelectedSession] = useState<string>('ALL');
  const [selectedDirection, setSelectedDirection] = useState<string>('ALL');
  const [selectedResult, setSelectedResult] = useState<string>('ALL');

  // Active Tab
  const [activeTab, setActiveTab] = useState<AnalyticsSubTab>('overview');

  // Trade drill-down modal & Edge Score breakdown modal
  const [activeTradeDetail, setActiveTradeDetail] = useState<Trade | null>(null);
  const [selectedScoreBreakdown, setSelectedScoreBreakdown] = useState<{
    title: string;
    breakdown: EdgeScoreBreakdown;
  } | null>(null);

  // Extract unique filter dropdown values
  const availableSymbols = useMemo(() => {
    const s = new Set<string>();
    safeTrades.forEach((t) => t?.symbol && s.add(t.symbol.toUpperCase().trim()));
    return Array.from(s).sort();
  }, [safeTrades]);

  const availableSetups = useMemo(() => {
    const s = new Set<string>();
    safeTrades.forEach((t) => {
      const name = t.setup?.trim() || t.setupId;
      if (name) s.add(name);
    });
    return Array.from(s).sort();
  }, [safeTrades]);

  // Dynamically Filtered Trades based on all 6 criteria
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
        const name = t.setup?.trim() || t.setupId;
        if (name !== selectedSetup) return false;
      }

      // 4. Killzone
      if (selectedSession !== 'ALL') {
        const kz = (t.killzone || t.session || '').toUpperCase().trim();
        if (selectedSession === 'LONDON' && !kz.includes('LONDON')) return false;
        else if (selectedSession === 'NEW_YORK' && !kz.includes('NY') && !kz.includes('NEW_YORK')) return false;
        else if (selectedSession === 'TOKYO' && !kz.includes('ASIA') && !kz.includes('TOKYO')) return false;
        else if (selectedSession === 'SYDNEY' && !kz.includes('SYDNEY')) return false;
        else if (selectedSession !== 'LONDON' && selectedSession !== 'NEW_YORK' && selectedSession !== 'TOKYO' && selectedSession !== 'SYDNEY' && kz !== selectedSession) return false;
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

  // Chronologically sorted closed trades
  const closedTrades = useMemo(() => {
    return filteredTrades
      .filter((t) => t.status !== 'OPEN' && t.netPnL !== null && t.netPnL !== undefined)
      .sort((a, b) => {
        const timeA = new Date(a.closedAt || a.openedAt).getTime();
        const timeB = new Date(b.closedAt || b.openedAt).getTime();
        return timeA - timeB;
      });
  }, [filteredTrades]);

  // 1. COMPREHENSIVE GLOBAL METRICS
  const globalMetrics = useMemo(() => {
    const EPSILON = 0.0001;
    let wins = 0;
    let losses = 0;
    let breakevens = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let totalNetPnL = 0;
    let totalR = 0;
    let rCount = 0;

    for (const t of closedTrades) {
      const pnl = t.netPnL ?? 0;
      totalNetPnL += pnl;

      if (pnl > EPSILON) {
        wins++;
        grossProfit += pnl;
      } else if (pnl < -EPSILON) {
        losses++;
        grossLoss += Math.abs(pnl);
      } else {
        breakevens++;
      }

      if (isTradeRRComplete(t) && t.rMultiple !== null && t.rMultiple !== undefined && !isNaN(t.rMultiple)) {
        totalR += t.rMultiple;
        rCount++;
      }
    }

    const totalClosed = closedTrades.length;
    const incompleteTradesCount = Math.max(0, totalClosed - rCount);
    const winRate = totalClosed > 0 ? (wins / totalClosed) * 100 : 0;
    const lossRate = totalClosed > 0 ? (losses / totalClosed) * 100 : 0;
    const avgWin = wins > 0 ? grossProfit / wins : 0;
    const avgLoss = losses > 0 ? grossLoss / losses : 0;

    let profitFactor = 0;
    if (grossLoss > 0) {
      profitFactor = grossProfit / grossLoss;
    } else if (grossProfit > 0) {
      profitFactor = 99.99;
    }

    // Expectancy
    const winFraction = totalClosed > 0 ? wins / totalClosed : 0;
    const lossFraction = totalClosed > 0 ? losses / totalClosed : 0;
    const monetaryExpectancy = totalClosed > 0 ? winFraction * avgWin - lossFraction * avgLoss : 0;
    const rExpectancy = rCount > 0 ? totalR / rCount : null;

    // Drawdown
    const initialBalance = appInitialBalance > 0 ? appInitialBalance : 10000;
    const currentBalance = initialBalance + totalNetPnL;
    const netReturnPercent = (totalNetPnL / initialBalance) * 100;

    const ddResult = calculateDrawdown(closedTrades, initialBalance);
    const streakResult = calculateStreaks(closedTrades);

    // Realized R/R
    const realizedRR = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 2.5 : 0;

    return {
      totalClosed,
      wins,
      losses,
      breakevens,
      winRate,
      grossProfit,
      grossLoss,
      totalNetPnL,
      profitFactor,
      avgWin,
      avgLoss,
      realizedRR,
      monetaryExpectancy,
      totalR,
      rExpectancy,
      rCount,
      incompleteTradesCount,
      initialBalance,
      currentBalance,
      netReturnPercent,
      maxDrawdownMoney: ddResult.maxDrawdown,
      maxDrawdownPercent: ddResult.maxDrawdownPercent,
      currentDrawdownMoney: ddResult.currentDrawdown,
      currentDrawdownPercent: ddResult.currentDrawdownPercent,
      streaks: streakResult,
      equityCurve: ddResult.equityCurve,
    };
  }, [closedTrades, appInitialBalance]);

  // 2. BREAKDOWN BY SETUP (with transparent Edge Score)
  const setupBreakdown = useMemo(() => {
    const map = new Map<string, Trade[]>();
    for (const t of closedTrades) {
      const s = t.setup?.trim() || t.setupId || 'Non défini';
      const arr = map.get(s) || [];
      arr.push(t);
      map.set(s, arr);
    }

    return Array.from(map.entries()).map(([setupName, cluster]) => {
      const wr = calculateWinRate(cluster);
      const pf = calculateProfitFactor(cluster);
      const exp = calculateExpectancy(cluster);
      let pnl = 0;
      let totalR = 0;
      let rCount = 0;
      let grossProfit = 0;
      let grossLoss = 0;

      cluster.forEach((t) => {
        const net = t.netPnL ?? 0;
        pnl += net;
        if (net > 0) grossProfit += net;
        else if (net < 0) grossLoss += Math.abs(net);

        if (t.rMultiple !== null && t.rMultiple !== undefined) {
          totalR += t.rMultiple;
          rCount++;
        }
      });

      const avgWin = wr.wins > 0 ? grossProfit / wr.wins : 0;
      const avgLoss = wr.losses > 0 ? grossLoss / wr.losses : 0;
      const rExp = rCount > 0 ? totalR / rCount : null;

      const edgeScore = calculateTransparentEdgeScore(
        cluster.length,
        wr.winRate ?? 0,
        pf.profitFactor,
        exp.moneyExpectancy ?? 0,
        rExp,
        avgWin,
        avgLoss
      );

      return {
        name: setupName,
        tradesCount: cluster.length,
        wins: wr.wins,
        losses: wr.losses,
        breakevens: wr.breakeven,
        winRate: wr.winRate ?? 0,
        profitFactor: pf.profitFactor,
        pnl,
        totalR: rCount > 0 ? totalR : null,
        rExpectancy: exp.rExpectancy,
        monetaryExpectancy: exp.moneyExpectancy ?? 0,
        edgeScore,
      };
    }).sort((a, b) => b.edgeScore.totalScore - a.edgeScore.totalScore || b.pnl - a.pnl);
  }, [closedTrades]);

  // 3. BREAKDOWN BY KILLZONE
  const sessionBreakdown = useMemo(() => {
    const map = new Map<string, Trade[]>();
    for (const t of closedTrades) {
      const kz = getTradeKillzone(t);
      const arr = map.get(kz) || [];
      arr.push(t);
      map.set(kz, arr);
    }

    return Array.from(map.entries()).map(([kzName, cluster]) => {
      const wr = calculateWinRate(cluster);
      const pf = calculateProfitFactor(cluster);
      let pnl = 0;
      cluster.forEach((t) => (pnl += t.netPnL ?? 0));

      return {
        session: kzName,
        tradesCount: cluster.length,
        wins: wr.wins,
        losses: wr.losses,
        winRate: wr.winRate ?? 0,
        profitFactor: pf.profitFactor,
        pnl,
      };
    }).sort((a, b) => b.pnl - a.pnl);
  }, [closedTrades]);

  // 4. BREAKDOWN BY PAIR / SYMBOL
  const pairBreakdown = useMemo(() => {
    const map = new Map<string, Trade[]>();
    for (const t of closedTrades) {
      const sym = (t.symbol || 'AUTRE').toUpperCase().trim();
      const arr = map.get(sym) || [];
      arr.push(t);
      map.set(sym, arr);
    }

    return Array.from(map.entries()).map(([sym, cluster]) => {
      const wr = calculateWinRate(cluster);
      const pf = calculateProfitFactor(cluster);
      let pnl = 0;
      let grossProfit = 0;
      let grossLoss = 0;
      cluster.forEach((t) => {
        const net = t.netPnL ?? 0;
        pnl += net;
        if (net > 0) grossProfit += net;
        else if (net < 0) grossLoss += Math.abs(net);
      });

      return {
        symbol: sym,
        tradesCount: cluster.length,
        wins: wr.wins,
        losses: wr.losses,
        winRate: wr.winRate ?? 0,
        profitFactor: pf.profitFactor,
        grossProfit,
        grossLoss,
        pnl,
      };
    }).sort((a, b) => b.pnl - a.pnl);
  }, [closedTrades]);

  // 5. EDGE DEEP AUDIT FOR EDGE TAB
  const edgeAudit = useMemo(() => {
    return calculateMyEdgeDeepAudit(filteredTrades);
  }, [filteredTrades]);

  // 6. BREAKDOWN BY DIRECTION (BUY VS SELL)
  const directionBreakdown = useMemo(() => {
    const buyTrades = closedTrades.filter((t) => t.direction === 'BUY');
    const sellTrades = closedTrades.filter((t) => t.direction === 'SELL');

    const getStats = (cluster: Trade[], label: string) => {
      const wr = calculateWinRate(cluster);
      const pf = calculateProfitFactor(cluster);
      let pnl = 0;
      let grossProfit = 0;
      let grossLoss = 0;
      cluster.forEach((t) => {
        const net = t.netPnL ?? 0;
        pnl += net;
        if (net > 0) grossProfit += net;
        else if (net < 0) grossLoss += Math.abs(net);
      });

      return {
        label,
        count: cluster.length,
        wins: wr.wins,
        losses: wr.losses,
        winRate: wr.winRate ?? 0,
        profitFactor: pf.profitFactor,
        grossProfit,
        grossLoss,
        pnl,
      };
    };

    return {
      buy: getStats(buyTrades, 'Positions Acheteuses (BUY)'),
      sell: getStats(sellTrades, 'Positions Vendeuses (SELL)'),
    };
  }, [closedTrades]);

  // 7. TIMELINE BREAKDOWN (DAY OF WEEK & MONTH)
  const timelineBreakdown = useMemo(() => {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const dayMap = new Map<number, Trade[]>();
    const monthMap = new Map<string, Trade[]>();

    for (const t of closedTrades) {
      const dateStr = t.openedAt || t.closedAt;
      if (!dateStr) continue;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) continue;

      let dayIdx = d.getUTCDay();
      // Trades placed Sunday evening belong to Monday trading session
      if (dayIdx === 0) dayIdx = 1;
      // Weekend settlement belongs to Friday
      if (dayIdx === 6) dayIdx = 5;

      const monthKey = d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' });

      const dayArr = dayMap.get(dayIdx) || [];
      dayArr.push(t);
      dayMap.set(dayIdx, dayArr);

      const mArr = monthMap.get(monthKey) || [];
      mArr.push(t);
      monthMap.set(monthKey, mArr);
    }

    const byDay = [1, 2, 3, 4, 5].map((dIdx) => {
      const cluster = dayMap.get(dIdx) || [];
      const wr = calculateWinRate(cluster);
      let pnl = 0;
      cluster.forEach((t) => (pnl += t.netPnL ?? 0));
      return {
        dayName: days[dIdx],
        tradesCount: cluster.length,
        winRate: wr.winRate ?? 0,
        pnl,
      };
    });

    const byMonth = Array.from(monthMap.entries()).map(([mKey, cluster]) => {
      const wr = calculateWinRate(cluster);
      let pnl = 0;
      cluster.forEach((t) => (pnl += t.netPnL ?? 0));
      return {
        month: mKey,
        tradesCount: cluster.length,
        winRate: wr.winRate ?? 0,
        pnl,
      };
    });

    return { byDay, byMonth };
  }, [closedTrades]);

  const getScoreBadgeClass = (score: number) => {
    if (score >= 80) return 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/25';
    if (score >= 65) return 'text-[#7C3AED] dark:text-[#8B5CF6] bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 border-[#7C3AED]/25 dark:border-[#8B5CF6]/25';
    if (score >= 45) return 'text-amber-600 dark:text-[#F59E0B] bg-amber-500/10 border-amber-500/25';
    return 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/25';
  };

  return (
    <div className="space-y-6 text-[#1A1D23] dark:text-[#E6E8EB] font-sans select-none pb-12" id="view-analytics">
      {/* 1. HEADER */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/60 dark:border-[#1C2430] bg-white dark:bg-[#131820] p-4 sm:p-6 shadow-xs transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/20 dark:border-[#8B5CF6]/25 shadow-xs shrink-0">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold tracking-tight text-[#1A1D23] dark:text-[#E6E8EB] flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="truncate">Statistiques &amp; Analytics</span>
                <span className="text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#181F2A] text-[#6B7280] dark:text-[#8B92A0] font-medium border border-slate-200/60 dark:border-[#1C2430] shrink-0 font-mono">
                  {closedTrades.length} {closedTrades.length > 1 ? 'trades' : 'trade'}
                </span>
              </h1>
              <p className="text-[11px] sm:text-xs text-[#6B7280] dark:text-[#8B92A0] font-normal mt-0.5 truncate">
                Hiérarchie : Globale → Setup → Killzone → Paire → Edge
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. DYNAMIC FILTERS BAR (6 SYNCHRONIZED FILTERS) */}
      <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200/60 dark:border-[#1C2430] bg-white dark:bg-[#131820] shadow-xs transition-colors">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-[#1C2430]">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1A1D23] dark:text-[#E6E8EB]">
            <Filter className="w-3.5 h-3.5 text-[#7C3AED] dark:text-[#8B5CF6]" />
            <span>Filtres analytiques</span>
          </div>

          {(selectedPeriod !== 'ALL' ||
            selectedSymbol !== 'ALL' ||
            selectedSetup !== 'ALL' ||
            selectedSession !== 'ALL' ||
            selectedDirection !== 'ALL' ||
            selectedResult !== 'ALL') && (
            <button
              onClick={() => {
                setSelectedPeriod('ALL');
                setSelectedSymbol('ALL');
                setSelectedSetup('ALL');
                setSelectedSession('ALL');
                setSelectedDirection('ALL');
                setSelectedResult('ALL');
              }}
              className="text-[11px] text-[#7C3AED] dark:text-[#8B5CF6] hover:underline font-bold cursor-pointer"
            >
              Réinitialiser
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {/* 1. Period */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="w-full px-2.5 py-1.5 text-[11px] sm:text-xs font-medium rounded-xl border border-slate-200/60 dark:border-[#1C2430] bg-white dark:bg-[#181F2A] text-[#1A1D23] dark:text-[#E6E8EB] focus:ring-1 focus:ring-[#7C3AED] dark:focus:ring-[#8B5CF6] cursor-pointer outline-none transition-colors truncate"
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
            className="w-full px-2.5 py-1.5 text-[11px] sm:text-xs font-medium rounded-xl border border-slate-200/60 dark:border-[#1C2430] bg-white dark:bg-[#181F2A] text-[#1A1D23] dark:text-[#E6E8EB] focus:ring-1 focus:ring-[#7C3AED] dark:focus:ring-[#8B5CF6] cursor-pointer outline-none transition-colors truncate"
          >
            <option value="ALL">Paires ({availableSymbols.length})</option>
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
            className="w-full px-2.5 py-1.5 text-[11px] sm:text-xs font-medium rounded-xl border border-slate-200/60 dark:border-[#1C2430] bg-white dark:bg-[#181F2A] text-[#1A1D23] dark:text-[#E6E8EB] focus:ring-1 focus:ring-[#7C3AED] dark:focus:ring-[#8B5CF6] cursor-pointer outline-none transition-colors truncate"
          >
            <option value="ALL">Setups ({availableSetups.length})</option>
            {availableSetups.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          {/* 4. Killzone */}
          <select
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
            className="w-full px-2.5 py-1.5 text-[11px] sm:text-xs font-medium rounded-xl border border-slate-200/60 dark:border-[#1C2430] bg-white dark:bg-[#181F2A] text-[#1A1D23] dark:text-[#E6E8EB] focus:ring-1 focus:ring-[#7C3AED] dark:focus:ring-[#8B5CF6] cursor-pointer outline-none transition-colors truncate"
          >
            <option value="ALL">Killzones</option>
            <option value="LONDON">London Killzone</option>
            <option value="NEW_YORK">New York Killzone</option>
            <option value="TOKYO">Asian Killzone</option>
            <option value="SYDNEY">Sydney Killzone</option>
          </select>

          {/* 5. Direction */}
          <select
            value={selectedDirection}
            onChange={(e) => setSelectedDirection(e.target.value)}
            className="w-full px-2.5 py-1.5 text-[11px] sm:text-xs font-medium rounded-xl border border-slate-200/60 dark:border-[#1C2430] bg-white dark:bg-[#181F2A] text-[#1A1D23] dark:text-[#E6E8EB] focus:ring-1 focus:ring-[#7C3AED] dark:focus:ring-[#8B5CF6] cursor-pointer outline-none transition-colors truncate"
          >
            <option value="ALL">Directions</option>
            <option value="BUY">BUY (Achats)</option>
            <option value="SELL">SELL (Ventes)</option>
          </select>

          {/* 6. Result (WIN, LOSS, BE) */}
          <select
            value={selectedResult}
            onChange={(e) => setSelectedResult(e.target.value)}
            className="w-full px-2.5 py-1.5 text-[11px] sm:text-xs font-medium rounded-xl border border-slate-200/60 dark:border-[#1C2430] bg-white dark:bg-[#181F2A] text-[#1A1D23] dark:text-[#E6E8EB] focus:ring-1 focus:ring-[#7C3AED] dark:focus:ring-[#8B5CF6] cursor-pointer outline-none transition-colors truncate"
          >
            <option value="ALL">Résultats</option>
            <option value="WIN">WIN (Gagnants)</option>
            <option value="LOSS">LOSS (Perdants)</option>
            <option value="BREAKEVEN">BE (Neutres)</option>
          </select>
        </div>
      </div>

      {/* 3. LOGICAL PROGRESSION NAVIGATION TABS */}
      {/* Performance globale → Performance par Setup → Performance par Session → Performance par Paire → Edge */}
      <div className="flex items-center gap-1.5 sm:gap-2 border-b border-slate-200/60 dark:border-[#1C2430] pb-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'overview'
              ? 'bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/25 dark:border-[#8B5CF6]/30 shadow-xs font-bold'
              : 'text-[#6B7280] dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB] hover:bg-slate-100 dark:hover:bg-[#181F2A]'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>1. Globale</span>
        </button>

        <button
          onClick={() => setActiveTab('setups')}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'setups'
              ? 'bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/25 dark:border-[#8B5CF6]/30 shadow-xs font-bold'
              : 'text-[#6B7280] dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB] hover:bg-slate-100 dark:hover:bg-[#181F2A]'
          }`}
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span>2. Setups ({setupBreakdown.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'sessions'
              ? 'bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/25 dark:border-[#8B5CF6]/30 shadow-xs font-bold'
              : 'text-[#6B7280] dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB] hover:bg-slate-100 dark:hover:bg-[#181F2A]'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>3. Killzones ({sessionBreakdown.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('pairs')}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'pairs'
              ? 'bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/25 dark:border-[#8B5CF6]/30 shadow-xs font-bold'
              : 'text-[#6B7280] dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB] hover:bg-slate-100 dark:hover:bg-[#181F2A]'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>4. Paires ({pairBreakdown.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('edge')}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'edge'
              ? 'bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/25 dark:border-[#8B5CF6]/30 shadow-xs font-bold'
              : 'text-[#6B7280] dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB] hover:bg-slate-100 dark:hover:bg-[#181F2A]'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>5. Edge</span>
        </button>

        <button
          onClick={() => setActiveTab('directions')}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'directions'
              ? 'bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/25 dark:border-[#8B5CF6]/30 shadow-xs font-bold'
              : 'text-[#6B7280] dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB] hover:bg-slate-100 dark:hover:bg-[#181F2A]'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Buy / Sell</span>
        </button>

        <button
          onClick={() => setActiveTab('timeline')}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'timeline'
              ? 'bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/25 dark:border-[#8B5CF6]/30 shadow-xs font-bold'
              : 'text-[#6B7280] dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB] hover:bg-slate-100 dark:hover:bg-[#181F2A]'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Hebdo &amp; Timing</span>
        </button>
      </div>

      {/* 4. TAB 1: PERFORMANCE GLOBALE */}
      {activeTab === 'overview' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Top 6 KPI Cards with Responsive Typography and Overflow Protection */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            {/* KPI 1: Solde & P&L */}
            <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-xs flex flex-col justify-between interactive-card min-w-0">
              <span className="text-[10px] sm:text-[11px] font-medium text-[#6B7280] dark:text-[#8B92A0] truncate block">P&amp;L Net Total</span>
              <div className="text-sm sm:text-base md:text-lg font-bold tabular-nums font-mono mt-0.5 sm:mt-1 truncate block">
                <AnimatedNumber
                  value={globalMetrics.totalNetPnL}
                  format={(val) => formatCurrency(val, currency)}
                  colorizeSigned={true}
                  duration={850}
                />
              </div>
              <span className="text-[9px] sm:text-[10px] text-[#6B7280] dark:text-[#8B92A0] font-medium font-mono mt-0.5 sm:mt-1 truncate block">
                Rend. : {globalMetrics.netReturnPercent >= 0 ? '+' : ''}
                {formatPercent(globalMetrics.netReturnPercent)}
              </span>
            </div>

            {/* KPI 2: Win Rate */}
            <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-xs flex flex-col justify-between interactive-card min-w-0">
              <span className="text-[10px] sm:text-[11px] font-medium text-[#6B7280] dark:text-[#8B92A0] truncate block">Win Rate</span>
              <div className="text-sm sm:text-base md:text-lg font-bold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB] mt-0.5 sm:mt-1 truncate block">
                <AnimatedNumber
                  value={globalMetrics.winRate}
                  format={(val) => formatPercent(val)}
                  duration={850}
                />
              </div>
              <span className="text-[9px] sm:text-[10px] text-[#6B7280] dark:text-[#8B92A0] font-mono mt-0.5 sm:mt-1 truncate block" title={`${globalMetrics.wins}W / ${globalMetrics.losses}L (${globalMetrics.breakevens} BE)`}>
                {globalMetrics.wins}W / {globalMetrics.losses}L · {globalMetrics.breakevens} BE
              </span>
            </div>

            {/* KPI 3: Profit Factor */}
            <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-xs flex flex-col justify-between interactive-card min-w-0">
              <span className="text-[10px] sm:text-[11px] font-medium text-[#6B7280] dark:text-[#8B92A0] truncate block">Profit Factor</span>
              <div className="text-sm sm:text-base md:text-lg font-bold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB] mt-0.5 sm:mt-1 truncate block">
                <AnimatedNumber
                  value={globalMetrics.profitFactor > 0 ? globalMetrics.profitFactor : 0}
                  format={(val) => (val > 0 ? formatDecimal(val, 2) : '—')}
                  duration={800}
                />
              </div>
              <span className="text-[9px] sm:text-[10px] text-[#6B7280] dark:text-[#8B92A0] mt-0.5 sm:mt-1 truncate block">
                Gains / Pertes brutes
              </span>
            </div>

            {/* KPI 4: Expectancy */}
            <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-xs flex flex-col justify-between interactive-card min-w-0">
              <span className="text-[10px] sm:text-[11px] font-medium text-[#6B7280] dark:text-[#8B92A0] truncate block">Espérance (R)</span>
              <div className="text-sm sm:text-base md:text-lg font-bold tabular-nums font-mono mt-0.5 sm:mt-1 truncate block">
                {globalMetrics.rExpectancy !== null ? (
                  <AnimatedNumber
                    value={globalMetrics.rExpectancy}
                    format={(val) => `${val >= 0 ? '+' : ''}${formatRMultiple(val)}`}
                    colorizeSigned={true}
                    duration={850}
                  />
                ) : (
                  <AnimatedNumber
                    value={globalMetrics.monetaryExpectancy}
                    format={(val) => formatCurrency(val, currency)}
                    colorizeSigned={true}
                    duration={850}
                  />
                )}
              </div>
              <span className="text-[9px] sm:text-[10px] text-[#6B7280] dark:text-[#8B92A0] font-mono mt-0.5 sm:mt-1 truncate block" title={`Calculé sur ${globalMetrics.rCount}/${globalMetrics.totalClosed} trades clôturés`}>
                {globalMetrics.rCount > 0 ? (
                  <>
                    {globalMetrics.rCount}/{globalMetrics.totalClosed} trades
                    {globalMetrics.incompleteTradesCount > 0 && (
                      <span className="text-amber-500 dark:text-amber-400 font-medium"> ({globalMetrics.incompleteTradesCount} inc.)</span>
                    )}
                  </>
                ) : (
                  'Espérance nette'
                )}
              </span>
            </div>

            {/* KPI 5: Avg Win / Avg Loss */}
            <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-xs flex flex-col justify-between interactive-card min-w-0">
              <span className="text-[10px] sm:text-[11px] font-medium text-[#6B7280] dark:text-[#8B92A0] truncate block">Gain / Perte Moy.</span>
              <div className="text-xs sm:text-sm font-bold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB] mt-0.5 sm:mt-1 truncate block">
                <span className="text-[#10B981]">
                  <AnimatedNumber value={globalMetrics.avgWin} format={(v) => formatCurrency(v, currency)} duration={800} />
                </span>
                <span className="text-slate-400 dark:text-slate-600 mx-0.5 sm:mx-1">/</span>
                <span className="text-[#EF4444]">
                  <AnimatedNumber value={-Math.abs(globalMetrics.avgLoss)} format={(v) => formatCurrency(v, currency)} duration={800} />
                </span>
              </div>
              <span className="text-[9px] sm:text-[10px] text-[#6B7280] dark:text-[#8B92A0] font-mono mt-0.5 sm:mt-1 truncate block">
                R/R : {formatDecimal(globalMetrics.realizedRR, 2)}
              </span>
            </div>

            {/* KPI 6: Max Drawdown */}
            <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-xs flex flex-col justify-between interactive-card min-w-0">
              <span className="text-[10px] sm:text-[11px] font-medium text-[#6B7280] dark:text-[#8B92A0] truncate block">Max Drawdown</span>
              <div className="text-sm sm:text-base md:text-lg font-bold tabular-nums font-mono text-[#EF4444] mt-0.5 sm:mt-1 truncate block">
                -<AnimatedNumber value={globalMetrics.maxDrawdownPercent} format={(v) => formatPercent(v)} duration={850} />
              </div>
              <span className="text-[9px] sm:text-[10px] text-[#6B7280] dark:text-[#8B92A0] font-mono mt-0.5 sm:mt-1 truncate block">
                {formatCurrency(-Math.abs(globalMetrics.maxDrawdownMoney), currency)} pic
              </span>
            </div>
          </div>

          {/* 1. Interactive Equity Curve & Performance Chart */}
          <EquityCurveChart
            trades={filteredTrades}
            initialBalance={appInitialBalance}
            currency={currency}
          />

          {/* 2. Weekly & Daily Performance Diagram */}
          <WeeklyPerformanceChart
            trades={filteredTrades}
            currency={currency}
          />
        </div>
      )}

      {/* 5. TAB 2: PERFORMANCE PAR SETUP */}
      {activeTab === 'setups' && (
        <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#1A1D23] dark:text-[#E6E8EB] tracking-tight">
                Performance par Setup &amp; Modèle d&apos;Exécution ({setupBreakdown.length})
              </h2>
              <p className="text-[11px] sm:text-xs text-[#6B7280] dark:text-[#8B92A0]">
                Chaque setup reçoit un Edge Score objectif et transparent sur 100 points
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/60 dark:border-[#1C2430] text-[#6B7280] dark:text-[#8B92A0] uppercase text-[10px] tracking-wider font-mono">
                  <th className="pb-3 font-semibold">Nom du Setup</th>
                  <th className="pb-3 font-semibold text-center">Trades (n)</th>
                  <th className="pb-3 font-semibold text-center">Win Rate</th>
                  <th className="pb-3 font-semibold text-right">P&amp;L Net</th>
                  <th className="pb-3 font-semibold text-right">Total R</th>
                  <th className="pb-3 font-semibold text-center">Profit Factor</th>
                  <th className="pb-3 font-semibold text-right">Expectancy</th>
                  <th className="pb-3 font-semibold text-center">Edge Score</th>
                  <th className="pb-3 font-semibold text-right">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1C2430]">
                {setupBreakdown.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-[#181F2A] transition">
                    <td className="py-3 font-bold text-[#1A1D23] dark:text-[#E6E8EB]">{s.name}</td>
                    <td className="py-3 text-center font-bold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB]">
                      {s.tradesCount}
                    </td>
                    <td className="py-3 text-center font-bold tabular-nums font-mono text-[#7C3AED] dark:text-[#8B5CF6]">
                      {s.winRate.toFixed(1)}%
                    </td>
                    <td
                      className={`py-3 text-right font-bold tabular-nums font-mono ${
                        s.pnl >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                      }`}
                    >
                      {formatCurrency(s.pnl, currency)}
                    </td>
                    <td className="py-3 text-right font-bold tabular-nums font-mono text-[#6B7280] dark:text-[#8B92A0]">
                      {s.totalR !== null ? `${s.totalR > 0 ? '+' : ''}${s.totalR.toFixed(2)}R` : '—'}
                    </td>
                    <td className="py-3 text-center font-bold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB]">
                      {s.profitFactor ? s.profitFactor.toFixed(2) : '—'}
                    </td>
                    <td className="py-3 text-right font-semibold tabular-nums font-mono text-[#7C3AED] dark:text-[#8B5CF6]">
                      {s.rExpectancy !== null
                        ? `${s.rExpectancy > 0 ? '+' : ''}${s.rExpectancy.toFixed(2)}R`
                        : formatCurrency(s.monetaryExpectancy, currency)}
                    </td>
                    <td className="py-3 text-center font-mono">
                      <button
                        onClick={() =>
                          setSelectedScoreBreakdown({
                            title: s.name,
                            breakdown: s.edgeScore,
                          })
                        }
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border cursor-pointer transition ${getScoreBadgeClass(
                          s.edgeScore.totalScore
                        )}`}
                      >
                        {s.edgeScore.totalScore}/100
                      </button>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() =>
                          setSelectedScoreBreakdown({
                            title: s.name,
                            breakdown: s.edgeScore,
                          })
                        }
                        className="text-xs text-[#7C3AED] dark:text-[#8B5CF6] hover:underline font-semibold cursor-pointer"
                      >
                        Score →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. TAB 3: PERFORMANCE PAR KILLZONE */}
      {activeTab === 'sessions' && (
        <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-xs space-y-4">
          <h2 className="text-sm sm:text-base font-bold text-[#1A1D23] dark:text-[#E6E8EB] tracking-tight">
            Performance par Killzone ({sessionBreakdown.length})
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {sessionBreakdown.map((s, idx) => (
              <div
                key={idx}
                className="p-4 sm:p-5 rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] shadow-xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-[#6B7280] dark:text-[#8B92A0] font-medium">Killzone</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/20 dark:border-[#8B5CF6]/25">
                      n = {s.tradesCount}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#1A1D23] dark:text-[#E6E8EB]">{s.session}</h3>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-[#8B92A0]">Win Rate :</span>
                    <span className="font-bold tabular-nums font-mono text-[#7C3AED] dark:text-[#8B5CF6]">{s.winRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-[#8B92A0]">P&amp;L Net :</span>
                    <span
                      className={`font-bold tabular-nums font-mono ${
                        s.pnl >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                      }`}
                    >
                      {formatCurrency(s.pnl, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-[#8B92A0]">Profit Factor :</span>
                    <span className="font-semibold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB]">
                      {s.profitFactor ? s.profitFactor.toFixed(2) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-[#8B92A0]">Gains / Pertes :</span>
                    <span className="text-[#1A1D23] dark:text-[#E6E8EB] font-mono font-medium">
                      {s.wins}W / {s.losses}L
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. TAB 4: PERFORMANCE PAR PAIRE */}
      {activeTab === 'pairs' && (
        <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-xs space-y-4">
          <h2 className="text-sm sm:text-base font-bold text-[#1A1D23] dark:text-[#E6E8EB] tracking-tight">
            Classement de Performance par Paire ({pairBreakdown.length})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/60 dark:border-[#1C2430] text-[#6B7280] dark:text-[#8B92A0] uppercase text-[10px] tracking-wider font-mono">
                  <th className="pb-3 font-semibold">Symbole</th>
                  <th className="pb-3 font-semibold text-center">Trades (n)</th>
                  <th className="pb-3 font-semibold text-center">Win Rate</th>
                  <th className="pb-3 font-semibold text-right">P&amp;L Net</th>
                  <th className="pb-3 font-semibold text-right">Gains Bruts</th>
                  <th className="pb-3 font-semibold text-right">Pertes Brutes</th>
                  <th className="pb-3 font-semibold text-center">Profit Factor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1C2430]">
                {pairBreakdown.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-[#181F2A] transition">
                    <td className="py-3 font-bold text-[#1A1D23] dark:text-[#E6E8EB]">
                      <span className="px-2.5 py-1 rounded-lg bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/20 dark:border-[#8B5CF6]/25 font-mono font-bold">
                        {p.symbol}
                      </span>
                    </td>
                    <td className="py-3 text-center font-bold tabular-nums font-mono text-[#1A1D23] dark:text-[#E6E8EB]">
                      {p.tradesCount}
                    </td>
                    <td className="py-3 text-center font-bold tabular-nums font-mono text-[#7C3AED] dark:text-[#8B5CF6]">
                      {p.winRate.toFixed(1)}%
                    </td>
                    <td
                      className={`py-3 text-right font-bold tabular-nums font-mono ${
                        p.pnl >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                      }`}
                    >
                      {formatCurrency(p.pnl, currency)}
                    </td>
                    <td className="py-3 text-right font-medium text-[#10B981] tabular-nums font-mono">
                      {formatCurrency(p.grossProfit, currency)}
                    </td>
                    <td className="py-3 text-right font-medium text-[#EF4444] tabular-nums font-mono">
                      {formatCurrency(-Math.abs(p.grossLoss), currency)}
                    </td>
                    <td className="py-3 text-center font-bold text-[#1A1D23] dark:text-[#E6E8EB] tabular-nums font-mono">
                      {p.profitFactor ? p.profitFactor.toFixed(2) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. TAB 5: EDGE & SYNTHÈSE STRATÉGIQUE */}
      {activeTab === 'edge' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
              <div className="flex items-start gap-3">
                <Compass className="w-6 h-6 text-[#7C3AED] dark:text-[#8B5CF6] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] uppercase font-bold tracking-wider text-[#7C3AED] dark:text-[#8B5CF6] block font-mono">
                    Synthèse de l&apos;Edge Stratégique
                  </span>
                  <h3 className="text-base font-bold text-[#1A1D23] dark:text-[#E6E8EB] mt-1">
                    {edgeAudit.verdict.keyTakeaway}
                  </h3>
                </div>
              </div>

              {onNavigateToMyEdge && (
                <button
                  onClick={onNavigateToMyEdge}
                  className="px-4 py-2 rounded-xl bg-[#7C3AED] dark:bg-[#8B5CF6] hover:opacity-90 text-white text-xs font-bold transition cursor-pointer shrink-0 shadow-xs"
                >
                  Ouvrir My Edge complet →
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200/60 dark:border-[#1C2430]">
              {edgeAudit.verdict.recurringConditions.map((cond, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] flex items-start gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                  <span className="text-xs text-[#1A1D23] dark:text-[#E6E8EB] font-medium">{cond}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 9. TAB 6: BUY VS SELL */}
      {activeTab === 'directions' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-xs space-y-3 sm:space-y-4 min-w-0">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/25 font-mono">
                BUY (Positions Long)
              </span>
              <span className="text-xs text-[#6B7280] dark:text-[#8B92A0] font-medium font-mono">
                {directionBreakdown.buy.count} trades
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-3 sm:py-4 border-y border-slate-200/60 dark:border-[#1C2430] text-center">
              <div className="min-w-0">
                <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] block font-medium truncate">Win Rate</span>
                <span className="text-sm sm:text-base md:text-lg font-bold text-[#7C3AED] dark:text-[#8B5CF6] tabular-nums font-mono truncate block">
                  {directionBreakdown.buy.winRate.toFixed(1)}%
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] block font-medium truncate">Profit Factor</span>
                <span className="text-sm sm:text-base md:text-lg font-bold text-[#1A1D23] dark:text-[#E6E8EB] tabular-nums font-mono truncate block">
                  {directionBreakdown.buy.profitFactor ? directionBreakdown.buy.profitFactor.toFixed(2) : '—'}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] block font-medium truncate">P&amp;L Net</span>
                <span
                  className={`text-sm sm:text-base md:text-lg font-bold tabular-nums font-mono truncate block ${
                    directionBreakdown.buy.pnl >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                  }`}
                >
                  {formatCurrency(directionBreakdown.buy.pnl, currency)}
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-xs space-y-3 sm:space-y-4 min-w-0">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/25 font-mono">
                SELL (Positions Short)
              </span>
              <span className="text-xs text-[#6B7280] dark:text-[#8B92A0] font-medium font-mono">
                {directionBreakdown.sell.count} trades
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-3 sm:py-4 border-y border-slate-200/60 dark:border-[#1C2430] text-center">
              <div className="min-w-0">
                <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] block font-medium truncate">Win Rate</span>
                <span className="text-sm sm:text-base md:text-lg font-bold text-[#7C3AED] dark:text-[#8B5CF6] tabular-nums font-mono truncate block">
                  {directionBreakdown.sell.winRate.toFixed(1)}%
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] block font-medium truncate">Profit Factor</span>
                <span className="text-sm sm:text-base md:text-lg font-bold text-[#1A1D23] dark:text-[#E6E8EB] tabular-nums font-mono truncate block">
                  {directionBreakdown.sell.profitFactor ? directionBreakdown.sell.profitFactor.toFixed(2) : '—'}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] block font-medium truncate">P&amp;L Net</span>
                <span
                  className={`text-sm sm:text-base md:text-lg font-bold tabular-nums font-mono truncate block ${
                    directionBreakdown.sell.pnl >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                  }`}
                >
                  {formatCurrency(directionBreakdown.sell.pnl, currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 10. TAB 7: TIMING (JOURS & MOIS) */}
      {activeTab === 'timeline' && (
        <div className="space-y-6">
          {/* Visual Weekly & Daily Performance Diagram */}
          <WeeklyPerformanceChart
            trades={filteredTrades}
            currency={currency}
          />

          {/* Monthly Breakdown with clean responsive cards */}
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] shadow-xs space-y-3 sm:space-y-4 min-w-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-[#1A1D23] dark:text-[#E6E8EB] truncate">
                  Rentabilité par Mois
                </h2>
                <p className="text-[11px] sm:text-xs text-[#6B7280] dark:text-[#8B92A0]">
                  Historique mensuel consolidé de la performance
                </p>
              </div>
              <span className="text-[11px] text-[#6B7280] dark:text-[#8B92A0] font-medium font-mono">
                {timelineBreakdown.byMonth.length} mois enregistrés
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3">
              {timelineBreakdown.byMonth.map((m, idx) => (
                <div
                  key={idx}
                  className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] hover:border-violet-300 dark:hover:border-violet-800/60 transition-all flex flex-col gap-2 min-w-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1A1D23] dark:text-[#E6E8EB] text-sm">
                      {m.month}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border tabular-nums font-mono ${
                        m.winRate >= 50
                          ? 'bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border-[#7C3AED]/20 dark:border-[#8B5CF6]/25'
                          : 'bg-amber-500/10 text-amber-600 dark:text-[#F59E0B] border-amber-500/25'
                      }`}
                    >
                      {m.winRate.toFixed(1)}% WR
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-[#1C2430]">
                    <span className="text-[#6B7280] dark:text-[#8B92A0] font-mono">
                      {m.tradesCount} trades
                    </span>
                    <span
                      className={`font-bold tabular-nums font-mono text-sm ${
                        m.pnl >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                      }`}
                    >
                      {formatCurrency(m.pnl, currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 11. INDIVIDUAL SCORE BREAKDOWN POPUP */}
      {selectedScoreBreakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#131820] border border-slate-200/60 dark:border-[#1C2430] rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-[#1C2430] pb-4">
              <div>
                <span className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] uppercase font-semibold font-mono">
                  Décomposition de l&apos;Edge Score
                </span>
                <h3 className="text-lg font-bold text-[#1A1D23] dark:text-[#E6E8EB]">
                  {selectedScoreBreakdown.title}
                </h3>
              </div>
              <div
                className={`px-3 py-1 rounded-xl text-sm font-bold border font-mono ${getScoreBadgeClass(
                  selectedScoreBreakdown.breakdown.totalScore
                )}`}
              >
                {selectedScoreBreakdown.breakdown.totalScore} / 100 · {selectedScoreBreakdown.breakdown.ratingLabel}
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#1A1D23] dark:text-[#E6E8EB] font-semibold">1. Espérance Mathématique (Expectancy) :</span>
                  <span className="font-bold font-mono text-[#7C3AED] dark:text-[#8B5CF6]">
                    {selectedScoreBreakdown.breakdown.expectancyPoints} / 30 pts
                  </span>
                </div>
                <div className="w-full bg-slate-200/60 dark:bg-[#1C2430] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#7C3AED] dark:bg-[#8B5CF6] h-full rounded-full"
                    style={{ width: `${(selectedScoreBreakdown.breakdown.expectancyPoints / 30) * 100}%` }}
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#1A1D23] dark:text-[#E6E8EB] font-semibold">2. Facteur de Profit (Profit Factor) :</span>
                  <span className="font-bold font-mono text-[#7C3AED] dark:text-[#8B5CF6]">
                    {selectedScoreBreakdown.breakdown.profitFactorPoints} / 25 pts
                  </span>
                </div>
                <div className="w-full bg-slate-200/60 dark:bg-[#1C2430] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#7C3AED] dark:bg-[#8B5CF6] h-full rounded-full"
                    style={{ width: `${(selectedScoreBreakdown.breakdown.profitFactorPoints / 25) * 100}%` }}
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#1A1D23] dark:text-[#E6E8EB] font-semibold">3. Efficience Win Rate / RR :</span>
                  <span className="font-bold font-mono text-[#10B981]">
                    {selectedScoreBreakdown.breakdown.winRateEfficiencyPoints} / 25 pts
                  </span>
                </div>
                <div className="w-full bg-slate-200/60 dark:bg-[#1C2430] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#10B981] h-full rounded-full"
                    style={{ width: `${(selectedScoreBreakdown.breakdown.winRateEfficiencyPoints / 25) * 100}%` }}
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#1A1D23] dark:text-[#E6E8EB] font-semibold">4. Fiabilité Statistique (Sample Size) :</span>
                  <span className="font-bold font-mono text-amber-500">
                    {selectedScoreBreakdown.breakdown.sampleConfidencePoints} / 20 pts
                  </span>
                </div>
                <div className="w-full bg-slate-200/60 dark:bg-[#1C2430] h-1.5 rounded-full overflow-hidden">
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
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#181F2A] dark:hover:bg-[#1C2430] text-[#1A1D23] dark:text-[#E6E8EB] rounded-xl text-xs font-semibold cursor-pointer transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 12. TRADE DETAIL MODAL */}
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
