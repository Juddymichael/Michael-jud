import { Trade } from '../../types/trade';
import { CompactTradingContext } from './compactTradingContext';
import { executeCoachTool } from './coachTools';
import { calculateWinRate, calculateProfitFactor, calculateExpectancy } from '../calculations/statistics';
import { isTradeRRComplete } from '../calculations/riskReward';

export interface SmartCoachResponse {
  reply: string;
  toolInvocations: Array<{
    name: string;
    args: Record<string, any>;
    result?: Record<string, any>;
  }>;
  searchSources?: Array<{ title: string; url: string }>;
}

// Live financial news cache (5 minutes TTL)
let newsCache: {
  timestamp: number;
  headlines: Array<{ title: string; pubDate: string }>;
} | null = null;

async function fetchLiveFinancialHeadlines(): Promise<Array<{ title: string; pubDate: string }>> {
  const now = Date.now();
  if (newsCache && now - newsCache.timestamp < 5 * 60 * 1000) {
    return newsCache.headlines;
  }

  const headlines: Array<{ title: string; pubDate: string }> = [];
  const feedUrls = [
    'https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US',
    'https://feeds.finance.yahoo.com/rss/2.0/headline?s=EURUSD=X&region=US&lang=en-US',
  ];

  for (const url of feedUrls) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(3000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
      });

      if (response.ok) {
        const text = await response.text();
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;
        while ((match = itemRegex.exec(text)) !== null && headlines.length < 8) {
          const itemContent = match[1];
          const titleMatch = /<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/.exec(itemContent);
          const pubDateMatch = /<pubDate>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/pubDate>/.exec(itemContent);
          if (titleMatch && titleMatch[1]) {
            const cleanTitle = titleMatch[1]
              .replace(/&amp;/g, '&')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .trim();
            headlines.push({
              title: cleanTitle,
              pubDate: pubDateMatch ? pubDateMatch[1] : '',
            });
          }
        }
      }
    } catch {
      // Continue silently if feed is unreachable
    }
  }

  newsCache = {
    timestamp: now,
    headlines,
  };

  return headlines;
}

/**
 * Calculates macro releases based on date & timeframe (Today, Tomorrow, This Week, Next Week)
 */
export interface MacroEvent {
  time: string;
  currency: string;
  title: string;
  impact: 'HIGH' | 'MEDIUM';
  propFirmRule: string;
}

export interface DayMacroCalendar {
  dayName: string;
  dateStr: string;
  events: MacroEvent[];
}

function getEventsForDay(dayOfWeek: number, isNextWeek: boolean = false): MacroEvent[] {
  const events: MacroEvent[] = [];
  if (dayOfWeek === 1) {
    events.push({
      time: '10:00 CET',
      currency: 'EUR',
      title: 'Indicateur Ifo du Climat des Affaires en Allemagne & Flash PMI',
      impact: 'MEDIUM',
      propFirmRule: 'Vigilance sur paires EUR (volatilité modérée en London Killzone).',
    });
    events.push({
      time: '16:00 CET / 10:00 EST',
      currency: 'USD',
      title: 'Indice ISM Manufacturier & PMI préliminaires S&P Global',
      impact: 'HIGH',
      propFirmRule: 'Surveillance des spreads sur DXY et EUR/USD à l’Open New York.',
    });
  } else if (dayOfWeek === 2) {
    events.push({
      time: '09:15 - 10:00 CET',
      currency: 'EUR / GBP',
      title: 'Flash PMI Manufacturier & Services (Zone Euro & UK)',
      impact: 'HIGH',
      propFirmRule: 'Volatilité sur paires EUR & GBP durant la Killzone London.',
    });
    events.push({
      time: '16:00 CET / 10:00 EST',
      currency: 'USD',
      title: 'Rapport JOLTS (Ouvertures de postes) & Confiance des Consommateurs CB',
      impact: 'HIGH',
      propFirmRule: 'Catalyseur direct pour le dollar et les rendements obligataires.',
    });
  } else if (dayOfWeek === 3) {
    events.push({
      time: '14:15 - 14:30 CET',
      currency: 'USD',
      title: 'Rapport Emploi National ADP & Commandes de biens durables',
      impact: 'HIGH',
      propFirmRule: 'Précurseur du NFP : fort impact sur indices US (NQ/ES) et Gold.',
    });
    events.push({
      time: '16:30 CET / 10:30 EST',
      currency: 'USD',
      title: 'Stocks hebdomadaires de pétrole brut EIA',
      impact: 'MEDIUM',
      propFirmRule: 'Forte volatilité sur le Pétrole WTI.',
    });
  } else if (dayOfWeek === 4) {
    events.push({
      time: '14:30 CET / 08:30 EST',
      currency: 'USD',
      title: 'Inscriptions hebdomadaires au chômage (Jobless Claims) & Balance commerciale',
      impact: 'HIGH',
      propFirmRule: 'Impact direct sur le dollar et les rendements obligataires US.',
    });
    events.push({
      time: '16:00 CET / 10:00 EST',
      currency: 'USD',
      title: 'ISM Non-Manufacturier / Services PMI & Discours Fed',
      impact: 'HIGH',
      propFirmRule: 'Forte accélération sur Nasdaq (NQ) et S&P 500 (ES).',
    });
  } else if (dayOfWeek === 5) {
    events.push({
      time: '14:30 CET / 08:30 EST',
      currency: 'USD',
      title: 'Rapport NFP (Non-Farm Payrolls), Taux de Chômage US & Salaires Moyens Horaires',
      impact: 'HIGH',
      propFirmRule: '🔴 POINT D’ORGUE : Interdiction prop firm 2 min avant/après. Attendre 15 min.',
    });
  } else {
    events.push({
      time: 'Week-end',
      currency: 'ALL',
      title: 'Marchés traditionnels fermés - Clôture hebdomadaire',
      impact: 'MEDIUM',
      propFirmRule: 'Fermeture obligatoire des positions swing sur la plupart des prop firms.',
    });
  }
  return events;
}

function getTodayMacroCalendar(): DayMacroCalendar {
  const now = new Date();
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const dayName = days[now.getUTCDay()];
  const dateStr = now.toLocaleDateString('fr-FR', {
    timeZone: 'UTC',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return {
    dayName,
    dateStr,
    events: getEventsForDay(now.getUTCDay()),
  };
}

function getTomorrowMacroCalendar(): DayMacroCalendar {
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const dayName = days[tomorrow.getUTCDay()];
  const dateStr = tomorrow.toLocaleDateString('fr-FR', {
    timeZone: 'UTC',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return {
    dayName,
    dateStr,
    events: getEventsForDay(tomorrow.getUTCDay()),
  };
}

function getThisWeekMacroCalendar(): { startDateStr: string; endDateStr: string; days: DayMacroCalendar[] } {
  const now = new Date();
  const currentDay = now.getUTCDay();
  const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  const mondayTime = now.getTime() + diffToMonday * 24 * 3600 * 1000;
  const daysList: DayMacroCalendar[] = [];
  const daysNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

  for (let i = 0; i < 5; i++) {
    const d = new Date(mondayTime + i * 24 * 3600 * 1000);
    const dayOfWeek = d.getUTCDay();
    daysList.push({
      dayName: daysNames[dayOfWeek],
      dateStr: d.toLocaleDateString('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }),
      events: getEventsForDay(dayOfWeek),
    });
  }

  const startDateStr = new Date(mondayTime).toLocaleDateString('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'long' });
  const endDateStr = new Date(mondayTime + 4 * 24 * 3600 * 1000).toLocaleDateString('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });

  return { startDateStr, endDateStr, days: daysList };
}

function getNextWeekMacroCalendar(): { startDateStr: string; endDateStr: string; days: DayMacroCalendar[] } {
  const now = new Date();
  const currentDay = now.getUTCDay();
  const diffToMonday = currentDay === 0 ? 1 : 8 - currentDay;
  const nextMondayTime = now.getTime() + diffToMonday * 24 * 3600 * 1000;
  const daysList: DayMacroCalendar[] = [];
  const daysNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

  for (let i = 0; i < 5; i++) {
    const d = new Date(nextMondayTime + i * 24 * 3600 * 1000);
    const dayOfWeek = d.getUTCDay();
    daysList.push({
      dayName: daysNames[dayOfWeek],
      dateStr: d.toLocaleDateString('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }),
      events: getEventsForDay(dayOfWeek, true),
    });
  }

  const startDateStr = new Date(nextMondayTime).toLocaleDateString('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'long' });
  const endDateStr = new Date(nextMondayTime + 4 * 24 * 3600 * 1000).toLocaleDateString('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });

  return { startDateStr, endDateStr, days: daysList };
}

/**
 * Deep Trade Analytics for Thunder Edge
 */
export interface FullTradeAnalytics {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  netPnL: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number | null;
  avgWin: number;
  avgLoss: number;
  winLossRatio: number;
  expectedR: number | null;
  totalRealizedR: number;
  completeRRCount: number;
  incompleteRRCount: number;
  incompleteRatioPercent: number;
  maxDrawdownMoney: number;
  maxDrawdownPercent: number;
  currentStreak: { type: 'WIN' | 'LOSS' | 'NONE'; count: number };
  maxWinStreak: number;
  maxLossStreak: number;
  bestTrade: Trade | null;
  worstTrade: Trade | null;
  recentTrades: Trade[];
  sessionStats: Record<
    string,
    { count: number; wins: number; losses: number; winRate: number; netPnL: number; expectedR: number }
  >;
  setupStats: Record<
    string,
    { count: number; wins: number; losses: number; winRate: number; netPnL: number; profitFactor: number }
  >;
  symbolStats: Record<
    string,
    { count: number; wins: number; losses: number; winRate: number; netPnL: number }
  >;
  mistakeStats: Record<
    string,
    { count: number; totalCost: number; totalR: number }
  >;
  postLossStats: {
    tradesInWindow: number;
    winRateInWindow: number;
    tradesOutsideWindow: number;
    winRateOutsideWindow: number;
  };
  bestSession: string | null;
  worstSession: string | null;
  bestSetup: string | null;
  worstSetup: string | null;
  bestSymbol: string | null;
}

export function computeFullTradeAnalytics(trades: Trade[]): FullTradeAnalytics {
  const wrResult = calculateWinRate(trades);
  const pfResult = calculateProfitFactor(trades);
  const expResult = calculateExpectancy(trades);

  // Chronological sort
  const sorted = [...trades].sort((a, b) => {
    const da = a.openedAt ? new Date(a.openedAt).getTime() : 0;
    const db = b.openedAt ? new Date(b.openedAt).getTime() : 0;
    return da - db;
  });

  let runningEquity = 0;
  let peakEquity = 0;
  let maxDrawdownMoney = 0;
  let maxDrawdownPercent = 0;

  let currentStreakType: 'WIN' | 'LOSS' | 'NONE' = 'NONE';
  let currentStreakCount = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let tempWin = 0;
  let tempLoss = 0;

  let bestTrade: Trade | null = null;
  let worstTrade: Trade | null = null;
  let maxPnL = -Infinity;
  let minPnL = Infinity;

  let totalRealizedR = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let netPnL = 0;
  let winsTotalMoney = 0;
  let lossesTotalMoneyAbs = 0;

  const sessionStats: FullTradeAnalytics['sessionStats'] = {};
  const setupStats: FullTradeAnalytics['setupStats'] = {};
  const symbolStats: FullTradeAnalytics['symbolStats'] = {};
  const mistakeStats: FullTradeAnalytics['mistakeStats'] = {};

  // Post-loss (1 hour window) tracking for Revenge Trading detection
  let lastLossTimestamp: number | null = null;
  let tradesInWindow = 0;
  let winsInWindow = 0;
  let tradesOutsideWindow = 0;
  let winsOutsideWindow = 0;

  for (const t of sorted) {
    if (t.status !== 'CLOSED') continue;

    const pnl = Number(t.netPnL ?? 0);
    netPnL += pnl;

    if (pnl > 0) {
      grossProfit += pnl;
      winsTotalMoney += pnl;
    } else if (pnl < 0) {
      grossLoss += Math.abs(pnl);
      lossesTotalMoneyAbs += Math.abs(pnl);
    }

    if (typeof t.rMultiple === 'number' && !isNaN(t.rMultiple)) {
      totalRealizedR += t.rMultiple;
    }

    // Extremes
    if (pnl > maxPnL) {
      maxPnL = pnl;
      bestTrade = t;
    }
    if (pnl < minPnL) {
      minPnL = pnl;
      worstTrade = t;
    }

    // Equity curve & Drawdown
    runningEquity += pnl;
    if (runningEquity > peakEquity) {
      peakEquity = runningEquity;
    }
    const currentDdMoney = peakEquity - runningEquity;
    if (currentDdMoney > maxDrawdownMoney) {
      maxDrawdownMoney = currentDdMoney;
      if (peakEquity > 0) {
        maxDrawdownPercent = (currentDdMoney / peakEquity) * 100;
      }
    }

    // Streaks
    if (pnl > 0) {
      tempWin++;
      tempLoss = 0;
      if (tempWin > maxWinStreak) maxWinStreak = tempWin;
      currentStreakType = 'WIN';
      currentStreakCount = tempWin;
    } else if (pnl < 0) {
      tempLoss++;
      tempWin = 0;
      if (tempLoss > maxLossStreak) maxLossStreak = tempLoss;
      currentStreakType = 'LOSS';
      currentStreakCount = tempLoss;
    }

    // Session stats
    const rawSession = t.session || 'Inconnue';
    const sKey =
      rawSession.toUpperCase().includes('LONDON') && rawSession.toUpperCase().includes('CLOSE')
        ? 'London Close'
        : rawSession.toUpperCase().includes('LONDON')
        ? 'London'
        : rawSession.toUpperCase().includes('NEW YORK') || rawSession.toUpperCase().includes('NY')
        ? 'New York'
        : rawSession.toUpperCase().includes('ASIA') || rawSession.toUpperCase().includes('ASIE')
        ? 'Asia'
        : rawSession;

    if (!sessionStats[sKey]) {
      sessionStats[sKey] = { count: 0, wins: 0, losses: 0, winRate: 0, netPnL: 0, expectedR: 0 };
    }
    sessionStats[sKey].count++;
    sessionStats[sKey].netPnL += pnl;
    if (pnl > 0) sessionStats[sKey].wins++;
    else if (pnl < 0) sessionStats[sKey].losses++;

    // Setup stats
    const setupName = t.setup ? t.setup.trim() : 'Sans Setup Spécifié';
    if (!setupStats[setupName]) {
      setupStats[setupName] = { count: 0, wins: 0, losses: 0, winRate: 0, netPnL: 0, profitFactor: 0 };
    }
    setupStats[setupName].count++;
    setupStats[setupName].netPnL += pnl;
    if (pnl > 0) setupStats[setupName].wins++;
    else if (pnl < 0) setupStats[setupName].losses++;

    // Symbol stats
    const sym = t.symbol ? t.symbol.trim().toUpperCase() : 'AUTRE';
    if (!symbolStats[sym]) {
      symbolStats[sym] = { count: 0, wins: 0, losses: 0, winRate: 0, netPnL: 0 };
    }
    symbolStats[sym].count++;
    symbolStats[sym].netPnL += pnl;
    if (pnl > 0) symbolStats[sym].wins++;
    else if (pnl < 0) symbolStats[sym].losses++;

    // Mistake tracking
    if (t.mistake && t.mistake !== 'NONE') {
      const mName = t.mistake;
      if (!mistakeStats[mName]) {
        mistakeStats[mName] = { count: 0, totalCost: 0, totalR: 0 };
      }
      mistakeStats[mName].count++;
      if (pnl < 0) {
        mistakeStats[mName].totalCost += Math.abs(pnl);
      }
      if (typeof t.rMultiple === 'number' && t.rMultiple < 0) {
        mistakeStats[mName].totalR += Math.abs(t.rMultiple);
      }
    }

    // Post-loss analysis (1 hour window)
    const openedTime = t.openedAt ? new Date(t.openedAt).getTime() : 0;
    if (lastLossTimestamp && openedTime > 0 && openedTime - lastLossTimestamp <= 60 * 60 * 1000) {
      tradesInWindow++;
      if (pnl > 0) winsInWindow++;
    } else if (openedTime > 0) {
      tradesOutsideWindow++;
      if (pnl > 0) winsOutsideWindow++;
    }

    if (pnl < 0 && t.closedAt) {
      lastLossTimestamp = new Date(t.closedAt).getTime();
    }
  }

  // Finalize session calculations
  let bestSession: string | null = null;
  let worstSession: string | null = null;
  let maxSessionPnL = -Infinity;
  let minSessionPnL = Infinity;
  for (const [key, s] of Object.entries(sessionStats)) {
    s.winRate = s.count > 0 ? (s.wins / s.count) * 100 : 0;
    if (s.netPnL > maxSessionPnL) {
      maxSessionPnL = s.netPnL;
      bestSession = key;
    }
    if (s.netPnL < minSessionPnL) {
      minSessionPnL = s.netPnL;
      worstSession = key;
    }
  }

  // Finalize setup calculations
  let bestSetup: string | null = null;
  let worstSetup: string | null = null;
  let maxSetupPnL = -Infinity;
  let minSetupPnL = Infinity;
  for (const [key, s] of Object.entries(setupStats)) {
    s.winRate = s.count > 0 ? (s.wins / s.count) * 100 : 0;
    if (s.netPnL > maxSetupPnL) {
      maxSetupPnL = s.netPnL;
      bestSetup = key;
    }
    if (s.netPnL < minSetupPnL) {
      minSetupPnL = s.netPnL;
      worstSetup = key;
    }
  }

  // Finalize symbol calculations
  let bestSymbol: string | null = null;
  let maxSymPnL = -Infinity;
  for (const [key, s] of Object.entries(symbolStats)) {
    s.winRate = s.count > 0 ? (s.wins / s.count) * 100 : 0;
    if (s.netPnL > maxSymPnL) {
      maxSymPnL = s.netPnL;
      bestSymbol = key;
    }
  }

  const closed = wrResult.closed;
  const avgWin = wrResult.wins > 0 ? winsTotalMoney / wrResult.wins : 0;
  const avgLoss = wrResult.losses > 0 ? lossesTotalMoneyAbs / wrResult.losses : 0;
  const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 99 : 0;

  const incompleteRRCount = expResult.incompleteTradesCount;
  const completeRRCount = expResult.validRTradesCount;
  const incompleteRatioPercent = closed > 0 ? (incompleteRRCount / closed) * 100 : 0;

  // Recent 5 trades (latest first)
  const recentTrades = [...sorted].reverse().slice(0, 5);

  return {
    totalTrades: trades.length,
    closedTrades: closed,
    openTrades: wrResult.open,
    wins: wrResult.wins,
    losses: wrResult.losses,
    breakevens: wrResult.breakeven,
    winRate: wrResult.winRate ?? 0,
    netPnL,
    grossProfit,
    grossLoss,
    profitFactor: pfResult.profitFactor,
    avgWin,
    avgLoss,
    winLossRatio,
    expectedR: expResult.rExpectancy,
    totalRealizedR,
    completeRRCount,
    incompleteRRCount,
    incompleteRatioPercent,
    maxDrawdownMoney,
    maxDrawdownPercent,
    currentStreak: { type: currentStreakType, count: currentStreakCount },
    maxWinStreak,
    maxLossStreak,
    bestTrade,
    worstTrade,
    recentTrades,
    sessionStats,
    setupStats,
    symbolStats,
    mistakeStats,
    postLossStats: {
      tradesInWindow,
      winRateInWindow: tradesInWindow > 0 ? (winsInWindow / tradesInWindow) * 100 : 0,
      tradesOutsideWindow,
      winRateOutsideWindow: tradesOutsideWindow > 0 ? (winsOutsideWindow / tradesOutsideWindow) * 100 : 0,
    },
    bestSession,
    worstSession,
    bestSetup,
    worstSetup,
    bestSymbol,
  };
}

const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export interface PeriodAnalysis {
  periodKey: 'LAST_MONTH' | 'CURRENT_MONTH' | 'LAST_WEEK' | 'THIS_WEEK' | 'TODAY' | 'YESTERDAY' | 'RECENT' | 'SPECIFIC_MONTH' | 'ALL';
  periodLabel: string;
  filteredTrades: Trade[];
  isPeriodSpecific: boolean;
  isComparison: boolean;
  comparePeriodLabel?: string;
  compareTrades?: Trade[];
}

/**
 * Parses user prompt for temporal period intent and filters trades with intelligent historical fallback
 */
export function detectPeriodAndFilterTrades(trades: Trade[], prompt: string): PeriodAnalysis {
  const lower = prompt.toLowerCase();
  const now = new Date();

  // Find latest trade date to anchor historical journals
  let latestDate = now;
  if (trades.length > 0) {
    const validDates = trades
      .map(t => (t.openedAt ? new Date(t.openedAt).getTime() : 0))
      .filter(t => !isNaN(t) && t > 0);
    if (validDates.length > 0) {
      latestDate = new Date(Math.max(...validDates));
    }
  }

  // 1. COMPARISON: "compare ce mois et le mois dernier", "comparaison", etc.
  const isComparison =
    /(compar|différence|versus|vs|évolution).*mois/i.test(lower) ||
    (lower.includes('compare') && (lower.includes('mois') || lower.includes('période')));

  if (isComparison) {
    const curYear = now.getUTCFullYear();
    const curMonth = now.getUTCMonth();
    const curStart = new Date(Date.UTC(curYear, curMonth, 1, 0, 0, 0)).getTime();
    const curEnd = new Date(Date.UTC(curYear, curMonth + 1, 0, 23, 59, 59, 999)).getTime();

    const lastYear = curMonth === 0 ? curYear - 1 : curYear;
    const lastMonth = curMonth === 0 ? 11 : curMonth - 1;
    const lastStart = new Date(Date.UTC(lastYear, lastMonth, 1, 0, 0, 0)).getTime();
    const lastEnd = new Date(Date.UTC(lastYear, lastMonth + 1, 0, 23, 59, 59, 999)).getTime();

    let curTrades = trades.filter(t => {
      const ts = t.openedAt ? new Date(t.openedAt).getTime() : 0;
      return ts >= curStart && ts <= curEnd;
    });

    let prevTrades = trades.filter(t => {
      const ts = t.openedAt ? new Date(t.openedAt).getTime() : 0;
      return ts >= lastStart && ts <= lastEnd;
    });

    if (curTrades.length === 0 && prevTrades.length === 0 && trades.length > 0) {
      const lYear = latestDate.getUTCFullYear();
      const lMonth = latestDate.getUTCMonth();
      const lCurStart = new Date(Date.UTC(lYear, lMonth, 1, 0, 0, 0)).getTime();
      const lCurEnd = new Date(Date.UTC(lYear, lMonth + 1, 0, 23, 59, 59, 999)).getTime();

      const pYear = lMonth === 0 ? lYear - 1 : lYear;
      const pMonth = lMonth === 0 ? 11 : lMonth - 1;
      const pStart = new Date(Date.UTC(pYear, pMonth, 1, 0, 0, 0)).getTime();
      const pEnd = new Date(Date.UTC(pYear, pMonth + 1, 0, 23, 59, 59, 999)).getTime();

      curTrades = trades.filter(t => {
        const ts = t.openedAt ? new Date(t.openedAt).getTime() : 0;
        return ts >= lCurStart && ts <= lCurEnd;
      });
      prevTrades = trades.filter(t => {
        const ts = t.openedAt ? new Date(t.openedAt).getTime() : 0;
        return ts >= pStart && ts <= pEnd;
      });

      return {
        periodKey: 'CURRENT_MONTH',
        periodLabel: `${MONTH_NAMES_FR[lMonth]} ${lYear}`,
        filteredTrades: curTrades,
        isPeriodSpecific: true,
        isComparison: true,
        comparePeriodLabel: `${MONTH_NAMES_FR[pMonth]} ${pYear}`,
        compareTrades: prevTrades,
      };
    }

    return {
      periodKey: 'CURRENT_MONTH',
      periodLabel: `${MONTH_NAMES_FR[curMonth]} ${curYear}`,
      filteredTrades: curTrades,
      isPeriodSpecific: true,
      isComparison: true,
      comparePeriodLabel: `${MONTH_NAMES_FR[lastMonth]} ${lastYear}`,
      compareTrades: prevTrades,
    };
  }

  // 2. LAST MONTH: "mois dernier", "le mois dernier", "mois passé", "mois précédent", "dernier mois"
  const isLastMonth = /(mois dernier|dernier mois|mois passé|mois precedent|mois précédent|mois d'avant)/i.test(lower);
  if (isLastMonth) {
    const curYear = now.getUTCFullYear();
    const curMonth = now.getUTCMonth();
    const targetYear = curMonth === 0 ? curYear - 1 : curYear;
    const targetMonth = curMonth === 0 ? 11 : curMonth - 1;

    const start = new Date(Date.UTC(targetYear, targetMonth, 1, 0, 0, 0)).getTime();
    const end = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59, 999)).getTime();

    let matched = trades.filter(t => {
      const ts = t.openedAt ? new Date(t.openedAt).getTime() : 0;
      return ts >= start && ts <= end;
    });

    let label = `${MONTH_NAMES_FR[targetMonth]} ${targetYear}`;

    // Historical fallback if calendar month yields 0 but trades exist
    if (matched.length === 0 && trades.length > 0) {
      const lYear = latestDate.getUTCFullYear();
      const lMonth = latestDate.getUTCMonth();

      const altYear = lMonth === 0 ? lYear - 1 : lYear;
      const altMonth = lMonth === 0 ? 11 : lMonth - 1;

      const altStart1 = new Date(Date.UTC(lYear, lMonth, 1, 0, 0, 0)).getTime();
      const altEnd1 = new Date(Date.UTC(lYear, lMonth + 1, 0, 23, 59, 59, 999)).getTime();
      const altMatched1 = trades.filter(t => {
        const ts = t.openedAt ? new Date(t.openedAt).getTime() : 0;
        return ts >= altStart1 && ts <= altEnd1;
      });

      const altStart2 = new Date(Date.UTC(altYear, altMonth, 1, 0, 0, 0)).getTime();
      const altEnd2 = new Date(Date.UTC(altYear, altMonth + 1, 0, 23, 59, 59, 999)).getTime();
      const altMatched2 = trades.filter(t => {
        const ts = t.openedAt ? new Date(t.openedAt).getTime() : 0;
        return ts >= altStart2 && ts <= altEnd2;
      });

      if (altMatched1.length > 0 && lMonth === targetMonth) {
        matched = altMatched1;
        label = `${MONTH_NAMES_FR[lMonth]} ${lYear}`;
      } else if (altMatched2.length > 0) {
        matched = altMatched2;
        label = `${MONTH_NAMES_FR[altMonth]} ${altYear}`;
      } else if (altMatched1.length > 0) {
        matched = altMatched1;
        label = `${MONTH_NAMES_FR[lMonth]} ${lYear}`;
      }
    }

    return {
      periodKey: 'LAST_MONTH',
      periodLabel: label,
      filteredTrades: matched,
      isPeriodSpecific: true,
      isComparison: false,
    };
  }

  // 3. THIS MONTH: "ce mois-ci", "ce mois", "du mois", "mois en cours"
  const isThisMonth = /(ce mois-ci|ce mois|du mois|mois en cours)/i.test(lower);
  if (isThisMonth) {
    const curYear = now.getUTCFullYear();
    const curMonth = now.getUTCMonth();
    const start = new Date(Date.UTC(curYear, curMonth, 1, 0, 0, 0)).getTime();
    const end = new Date(Date.UTC(curYear, curMonth + 1, 0, 23, 59, 59, 999)).getTime();

    let matched = trades.filter(t => {
      const ts = t.openedAt ? new Date(t.openedAt).getTime() : 0;
      return ts >= start && ts <= end;
    });

    let label = `${MONTH_NAMES_FR[curMonth]} ${curYear}`;

    if (matched.length === 0 && trades.length > 0) {
      const lYear = latestDate.getUTCFullYear();
      const lMonth = latestDate.getUTCMonth();
      const lStart = new Date(Date.UTC(lYear, lMonth, 1, 0, 0, 0)).getTime();
      const lEnd = new Date(Date.UTC(lYear, lMonth + 1, 0, 23, 59, 59, 999)).getTime();
      const lMatched = trades.filter(t => {
        const ts = t.openedAt ? new Date(t.openedAt).getTime() : 0;
        return ts >= lStart && ts <= lEnd;
      });
      if (lMatched.length > 0) {
        matched = lMatched;
        label = `${MONTH_NAMES_FR[lMonth]} ${lYear}`;
      }
    }

    return {
      periodKey: 'CURRENT_MONTH',
      periodLabel: label,
      filteredTrades: matched,
      isPeriodSpecific: true,
      isComparison: false,
    };
  }

  // 4. THIS WEEK / LAST WEEK
  const isThisWeek = /(cette semaine|de la semaine)/i.test(lower);
  if (isThisWeek) {
    const day = now.getUTCDay() || 7;
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - day + 1);
    monday.setUTCHours(0, 0, 0, 0);

    const matched = trades.filter(t => {
      const ts = t.openedAt ? new Date(t.openedAt).getTime() : 0;
      return ts >= monday.getTime();
    });

    return {
      periodKey: 'THIS_WEEK',
      periodLabel: 'Cette semaine',
      filteredTrades: matched,
      isPeriodSpecific: true,
      isComparison: false,
    };
  }

  const isLastWeek = /(semaine dernière|semaine passée|la semaine dernière)/i.test(lower);
  if (isLastWeek) {
    const day = now.getUTCDay() || 7;
    const lastMonday = new Date(now);
    lastMonday.setUTCDate(now.getUTCDate() - day - 6);
    lastMonday.setUTCHours(0, 0, 0, 0);

    const lastSunday = new Date(lastMonday);
    lastSunday.setUTCDate(lastMonday.getUTCDate() + 6);
    lastSunday.setUTCHours(23, 59, 59, 999);

    const matched = trades.filter(t => {
      const ts = t.openedAt ? new Date(t.openedAt).getTime() : 0;
      return ts >= lastMonday.getTime() && ts <= lastSunday.getTime();
    });

    return {
      periodKey: 'LAST_WEEK',
      periodLabel: 'Semaine dernière',
      filteredTrades: matched,
      isPeriodSpecific: true,
      isComparison: false,
    };
  }

  // 5. TODAY / YESTERDAY
  const isToday = /(aujourd'hui|ce jour)/i.test(lower);
  if (isToday) {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    const matched = trades.filter(t => {
      const ts = t.openedAt ? new Date(t.openedAt).getTime() : 0;
      return ts >= start.getTime();
    });
    return {
      periodKey: 'TODAY',
      periodLabel: "Aujourd'hui",
      filteredTrades: matched,
      isPeriodSpecific: true,
      isComparison: false,
    };
  }

  const isYesterday = /\b(hier)\b/i.test(lower);
  if (isYesterday) {
    const start = new Date(now);
    start.setUTCDate(now.getUTCDate() - 1);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCHours(23, 59, 59, 999);

    const matched = trades.filter(t => {
      const ts = t.openedAt ? new Date(t.openedAt).getTime() : 0;
      return ts >= start.getTime() && ts <= end.getTime();
    });
    return {
      periodKey: 'YESTERDAY',
      periodLabel: 'Hier',
      filteredTrades: matched,
      isPeriodSpecific: true,
      isComparison: false,
    };
  }

  // 6. LAST N TRADES: "10 derniers trades", "derniers trades", etc.
  const lastNMatch = lower.match(/(\d+)\s*derniers?\s*trades?/i) || lower.match(/derniers?\s*trades?/i);
  if (lastNMatch) {
    const n = lastNMatch[1] ? parseInt(lastNMatch[1], 10) : 10;
    const sorted = [...trades].sort((a, b) => new Date(b.openedAt || 0).getTime() - new Date(a.openedAt || 0).getTime());
    const matched = sorted.slice(0, n);
    return {
      periodKey: 'RECENT',
      periodLabel: `Vos ${matched.length} derniers trades`,
      filteredTrades: matched,
      isPeriodSpecific: true,
      isComparison: false,
    };
  }

  // 7. SPECIFIC MONTH NAME
  const monthsFR = [
    { name: 'janvier', idx: 0 },
    { name: 'février', idx: 1 },
    { name: 'fevrier', idx: 1 },
    { name: 'mars', idx: 2 },
    { name: 'avril', idx: 3 },
    { name: 'mai', idx: 4 },
    { name: 'juin', idx: 5 },
    { name: 'juillet', idx: 6 },
    { name: 'août', idx: 7 },
    { name: 'aout', idx: 7 },
    { name: 'septembre', idx: 8 },
    { name: 'octobre', idx: 9 },
    { name: 'novembre', idx: 10 },
    { name: 'décembre', idx: 11 },
    { name: 'decembre', idx: 11 },
  ];
  for (const m of monthsFR) {
    const reg = new RegExp(`\\b(en|du mois de|mois de)\\s+${m.name}\\b|\\b${m.name}\\b`, 'i');
    if (reg.test(lower)) {
      const targetYear = latestDate.getUTCFullYear();
      const start = new Date(Date.UTC(targetYear, m.idx, 1, 0, 0, 0)).getTime();
      const end = new Date(Date.UTC(targetYear, m.idx + 1, 0, 23, 59, 59, 999)).getTime();
      const matched = trades.filter(t => {
        const ts = t.openedAt ? new Date(t.openedAt).getTime() : 0;
        return ts >= start && ts <= end;
      });
      return {
        periodKey: 'SPECIFIC_MONTH',
        periodLabel: `${MONTH_NAMES_FR[m.idx]} ${targetYear}`,
        filteredTrades: matched,
        isPeriodSpecific: true,
        isComparison: false,
      };
    }
  }

  return {
    periodKey: 'ALL',
    periodLabel: 'Historique Complet',
    filteredTrades: trades,
    isPeriodSpecific: false,
    isComparison: false,
  };
}

/**
 * Intelligent Master Coach Engine
 */
export async function generateSmartCoachResponse(
  userPrompt: string,
  trades: Trade[],
  currency: string = 'USD',
  compactContext?: CompactTradingContext,
  history?: Array<{ role: string; content: string }>
): Promise<SmartCoachResponse> {
  const p = userPrompt.trim();
  const lower = p.toLowerCase();
  const toolInvocations: SmartCoachResponse['toolInvocations'] = [];

  // Helper formatting
  const fmtMoney = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val)) return `0.00 ${currency}`;
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  };

  const fmtR = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val)) return 'N/A';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}R`;
  };

  const fmtPct = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val)) return '0.0%';
    return `${val.toFixed(1)}%`;
  };

  // 1. ECONOMIC NEWS & MACRO CALENDAR (Multi-Timeframe: Next Week, This Week, Tomorrow, Today, or Specific Indicator)
  const isNextWeek = /(semaine prochaine|la semaine pro|prochaine semaine|next week|semaine d'après|semaine qui arrive)/i.test(lower);
  const isThisWeek = /(cette semaine|toute la semaine|sur la semaine|cette sem|this week)/i.test(lower) && !isNextWeek;
  const isTomorrow = /(demain|lendemain|tomorrow)/i.test(lower) && !isNextWeek && !isThisWeek;

  const isSpecificIndicatorQuery =
    (/(c['’ ]?est quoi|qu['’ ]?est[- ]ce que|c[- ]est quoi|définition|definition|comment trader|comment fonctionne|pourquoi|expliqu.*|règle.*prop firm|quel impact)/i.test(lower) &&
      /(cpi|nfp|fomc|fed|pce|pmi|taux|inflation|chomage|chômage)/i.test(lower)) ||
    /^(cpi|nfp|fomc|fed|pce|pmi)[\s\?!\.]*$/i.test(lower);

  const isGeneralNewsQuery =
    /(news|nouvelle|calendrier|annonce|cpi|nfp|fomc|fed|inflation|chomage|chômage|taux|bce|ecb|pmi|macro|agenda|catalyseur)/i.test(
      lower
    ) &&
    !/(mes trades|mes positions|mes résultats|mon pnl|mon journal|mon espérance|mon winrate)/i.test(lower);

  if (isNextWeek || isThisWeek || isTomorrow || isSpecificIndicatorQuery || isGeneralNewsQuery) {
    const liveHeadlines = await fetchLiveFinancialHeadlines();
    const searchSources = [
      { title: 'Forex Factory - Calendrier Économique', url: 'https://www.forexfactory.com/calendar' },
      { title: 'Trading Economics - Données Macro & Banques Centrales', url: 'https://tradingeconomics.com/calendar' },
      { title: 'Investing.com - Calendrier des Marchés Financiers', url: 'https://www.investing.com/economic-calendar/' },
    ];

    // CASE A: NEXT WEEK CALENDAR
    if (isNextWeek) {
      const nw = getNextWeekMacroCalendar();
      let text = `### 📅 Calendrier Économique & Actualités Macro — Semaine Prochaine\n`;
      text += `**Période : Du ${nw.startDateStr} au ${nw.endDateStr}**\n\n`;
      text += `Voici le programme institutionnel complet et les catalyseurs de volatilité prévus pour la semaine prochaine :\n\n`;

      for (const day of nw.days) {
        text += `#### 🗓️ ${day.dayName} (${day.dateStr})\n`;
        for (const ev of day.events) {
          const badge = ev.impact === 'HIGH' ? '🔴 **IMPACT ÉLEVÉ**' : '🟠 **IMPACT MODÉRÉ**';
          text += `- **${ev.time}** | **[${ev.currency}]** ${badge} : **${ev.title}**\n  - 🛡️ *Recommandation :* ${ev.propFirmRule}\n`;
        }
        text += `\n`;
      }

      text += `#### 🎯 Événement Clé de la Semaine Prochaine :\n`;
      text += `- Le **Rapport NFP (Non-Farm Payrolls)** et le **Taux de Chômage US** du vendredi à 14:30 CET / 08:30 EST constituent le catalyseur n°1 de liquidité du mois pour les indices US (NQ, ES) et le Dollar.\n`;
      text += `- 🛡️ **Règles Prop Firm (Topstep & FTMO)** : Interdiction absolue de prendre de nouvelles positions ou d'exécuter des ordres limites 2 minutes avant et 2 minutes après l'annonce rouge. Ne cherchez jamais à deviner le chiffre brut.\n\n`;

      if (liveHeadlines.length > 0) {
        text += `#### 📰 Derniers Titres des Marchés Financiers :\n`;
        for (const h of liveHeadlines.slice(0, 4)) {
          text += `- **${h.title}**\n`;
        }
        text += `\n`;
      }

      text += `#### 💡 Stratégie SMC Recommandée pour la Semaine Prochaine :\n`;
      text += `1. **Lundi - Mardi** : Marchés en phase de création de liquidité (accumulation et création de swings). Évitez l'overtrading.\n`;
      text += `2. **Mercredi - Jeudi** : Première impulsion directionnelle après les rapports ADP et Inscriptions au chômage.\n`;
      text += `3. **Vendredi (NFP)** : Laissez passer le balayage de liquidité initial (Judas Swing de 14:30 à 14:45), puis observez la structure M5/M15 pour entrer sur un FVG confirmé lors de la New York Killzone.\n`;

      return { reply: text, toolInvocations, searchSources };
    }

    // CASE B: THIS WEEK CALENDAR (5 DAYS)
    if (isThisWeek) {
      const tw = getThisWeekMacroCalendar();
      let text = `### 📅 Calendrier Économique & Macro — Toute la Semaine en Cours\n`;
      text += `**Période : Du ${tw.startDateStr} au ${tw.endDateStr}**\n\n`;

      for (const day of tw.days) {
        text += `#### 🗓️ ${day.dayName} (${day.dateStr})\n`;
        for (const ev of day.events) {
          const badge = ev.impact === 'HIGH' ? '🔴 **IMPACT ÉLEVÉ**' : '🟠 **IMPACT MODÉRÉ**';
          text += `- **${ev.time}** | **[${ev.currency}]** ${badge} : **${ev.title}**\n  - 🛡️ *Recommandation :* ${ev.propFirmRule}\n`;
        }
        text += `\n`;
      }

      if (liveHeadlines.length > 0) {
        text += `#### 📰 Dernières Dépêches de Marché :\n`;
        for (const h of liveHeadlines.slice(0, 4)) {
          text += `- **${h.title}**\n`;
        }
        text += `\n`;
      }

      text += `#### 💡 Discipline Prop Firm Hebdomadaire :\n`;
      text += `- Respectez scrupuleusement la **Daily Loss Limit**. Même sur les journées de forte volatilité, votre perte quotidienne ne doit jamais excéder votre seuil prédéfini.\n`;

      return { reply: text, toolInvocations, searchSources };
    }

    // CASE C: TOMORROW CALENDAR
    if (isTomorrow) {
      const tm = getTomorrowMacroCalendar();
      let text = `### 📅 Calendrier Économique & Actualités Macro — Demain (${tm.dayName} ${tm.dateStr})\n\n`;
      text += `Voici les catalyseurs de volatilité prévus pour la journée de demain :\n\n`;

      text += `#### 🔴 Annonces Prévues Demain\n`;
      for (const ev of tm.events) {
        const badge = ev.impact === 'HIGH' ? '🔴 **IMPACT ÉLEVÉ**' : '🟠 **IMPACT MODÉRÉ**';
        text += `- **${ev.time}** | **[${ev.currency}]** ${badge} : **${ev.title}**\n  - 🛡️ *Recommandation :* ${ev.propFirmRule}\n`;
      }

      if (liveHeadlines.length > 0) {
        text += `\n#### 📰 Actualités de Clôture & Anticipations :\n`;
        for (const h of liveHeadlines.slice(0, 3)) {
          text += `- **${h.title}**\n`;
        }
      }

      text += `\n#### 💡 Recommandation d'Exécution pour Demain :\n`;
      text += `- Marquez vos niveaux clés (High & Low de la veille) avant l'Open London (09h00 CET / 10h00 Madagascar) et attendez la digestion des premières annonces avant de valider vos entrées.\n`;

      return { reply: text, toolInvocations, searchSources };
    }

    // CASE D: SPECIFIC INDICATOR EXPLANATION (CPI, NFP, FOMC, etc.)
    if (isSpecificIndicatorQuery) {
      let targetInd = 'Annonces Macro';
      if (/cpi|inflation/i.test(lower)) targetInd = 'CPI (Indice des Prix à la Consommation)';
      else if (/nfp|chomage|chômage/i.test(lower)) targetInd = 'NFP (Non-Farm Payrolls & Emploi)';
      else if (/fomc|fed|taux/i.test(lower)) targetInd = 'FOMC & Décisions de Taux de la Fed';
      else if (/pce/i.test(lower)) targetInd = 'Indice PCE (Mesure d’inflation préférée de la Fed)';
      else if (/pmi/i.test(lower)) targetInd = 'PMI (Indices d’activité manufacturière & services)';

      let text = `### 🧠 Comprendre & Trader : **${targetInd}**\n\n`;
      text += `En méthodologie ICT / SMC, les annonces macroéconomiques ne sont pas analysées pour prévoir les chiffres, mais pour comprendre **comment les algorithmes interbancaires utilisent l'injection de liquidité**.\n\n`;

      text += `#### 1. Le Rôle Institutionnel de la News (Liquidity Injection) :\n`;
      text += `- Les grands institutionnels (banques centrales, hedge funds) ont des volumes trop colossaux pour entrer sur le marché en conditions normales sans provoquer de slippage destructeur.\n`;
      text += `- La news rouge sert d'**accélérateur de liquidité** : les ordres Stop Loss des traders particuliers sont massivement déclenchés dans un sens (Judas Swing), ce qui offre la contrepartie exacte dont les algorithmes ont besoin pour accumuler ou distribuer à prix préférentiel.\n\n`;

      text += `#### 2. Protocole d'Exécution SMC en 4 Étapes :\n`;
      text += `1. **Interdiction d'exécuter à la publication** : Ne cliquez jamais à 14:30:00. Les spreads s'écartent et le risque de slippage est maximal.\n`;
      text += `2. **Attente du Balayage (Liquidity Sweep)** : Laissez l'impulsion initiale chasser la liquidité au-dessus d'un ancien sommet (BSL) ou en dessous d'un creux (SSL).\n`;
      text += `3. **Confirmation LTF (M1/M5)** : Attendez qu'un chandelier franc vienne briser la structure opposée (**MSS - Market Structure Shift**) en laissant un déséquilibre net (**FVG - Fair Value Gap**).\n`;
      text += `4. **Entrée Retracement** : Placez votre ordre limite sur le FVG avec un Stop Loss protégé derrière l'extrême du balayage de la news.\n\n`;

      text += `#### 3. Règles Prop Firm (Topstep & FTMO) :\n`;
      text += `- **Topstep & FTMO Swing** : Il est strictement recommandé ou obligatoire de ne pas détenir de positions 2 minutes avant et 2 minutes après une annonce rouge.\n`;
      text += `- Une violation peut entraîner un avertissement formel ou la clôture immédiate de votre compte de test ou compte financé.\n`;

      return { reply: text, toolInvocations, searchSources };
    }

    // CASE E: TODAY'S CALENDAR (DEFAULT NEWS)
    const calendar = getTodayMacroCalendar();
    let text = `### 📅 Calendrier Économique & Actualités Macro (${calendar.dateStr})\n\n`;
    text += `Voici les catalyseurs de volatilité et les annonces économiques majeures pour aujourd'hui :\n\n`;

    text += `#### 🔴 Annonces Majeures Prévues Aujourd'hui\n`;
    for (const ev of calendar.events) {
      const badge = ev.impact === 'HIGH' ? '🔴 **IMPACT ÉLEVÉ**' : '🟠 **IMPACT MODÉRÉ**';
      text += `- **${ev.time}** | **[${ev.currency}]** ${badge} : **${ev.title}**\n  - 🛡️ *Recommandation :* ${ev.propFirmRule}\n`;
    }

    if (liveHeadlines.length > 0) {
      text += `\n#### 📰 Derniers Titres des Marchés Financiers\n`;
      for (const h of liveHeadlines.slice(0, 4)) {
        text += `- **${h.title}**\n`;
      }
    }

    text += `\n#### 💡 Conseil de Gestion du Risque pendant les News :\n`;
    text += `- Lors des annonces à fort impact (CPI, NFP, Décisions de taux), les spreads s'écartent fortement et le slippage peut être important.\n`;
    text += `- Si vous tradez des indices US (NQ, ES) ou des paires majeures (EUR/USD, GBP/USD), patientez 10 à 15 minutes après l'annonce pour laisser passer le balayage de liquidité initial et attendre une structure confirmée.\n`;

    return { reply: text, toolInvocations, searchSources };
  }

  // 2. RISK MANAGEMENT & POSITION SIZING FORMULAS
  const isRiskCalcQuery =
    /(calcul.*lot|taille.*position|risk management|gestion du risque|calculer mon lot|combien risquer|formule.*lot)/i.test(
      lower
    );

  if (isRiskCalcQuery) {
    let text = `### 📐 Calcul de Taille de Position & Gestion du Risque\n\n`;
    text += `Le dimensionnement de position est la clé mathématique absolue de la survie et de la rentabilité en trading.\n\n`;

    text += `#### 1. La Formule Universelle du Lot :\n`;
    text += `$$\\text{Taille du lot} = \\frac{\\text{Montant en risque (\\$)}}{\\text{Distance du Stop Loss (pips/points)} \\times \\text{Valeur du pip par lot standard}}$$\n\n`;

    text += `#### Exemple Concret :\n`;
    text += `- **Capital** : 10,000 $ avec un risque fixé à **1%** = **100 $** de risque maximal.\n`;
    text += `- **Actif** : EUR/USD (1 pip = 10 $ par lot standard de 1.00).\n`;
    text += `- **Distance du Stop Loss** : 20 pips.\n`;
    text += `- **Calcul** : $100 / (20 \\times 10) = 100 / 200 = \\mathbf{0.50\\text{ lot}}$.\n\n`;

    text += `#### 2. Les Règles d'Or Institutionnelles :\n`;
    text += `1. **Risque par trade** : Ne risquez jamais plus de **0.5% à 1%** de votre capital par position.\n`;
    text += `2. **Stop Loss inviolable** : Le Stop Loss se place sur un niveau technique d'invalidation (au-delà d'un swing high/low ou d'un Order Block), JAMAIS au hasard.\n`;
    text += `3. **Asymétrie R:R** : Visez au minimum **1:2** (risquer 1R pour gagner 2R). Avec un R:R de 1:2, un simple taux de réussite de 40% vous rend largement gagnant sur le long terme.\n`;

    return { reply: text, toolInvocations };
  }

  // 3. SMART MONEY CONCEPTS (SMC / ICT) METHODOLOGY
  const isSmcMethodQuery =
    /(smc|smart money|ict|order block|ob\b|fvg|fair value gap|liquidity sweep|choch|mss|bos|breaker|ote|inducement)/i.test(
      lower
    ) &&
    !/(mes trades|mes positions|mon bilan|mes résultats|mes stats)/i.test(lower);

  if (isSmcMethodQuery) {
    let text = `### 🧠 Méthodologie Smart Money Concepts (SMC & ICT)\n\n`;
    text += `La méthode institutionnelle repose sur la compréhension des flux d'ordres des banques et algorithmes interbancaires.\n\n`;

    text += `#### 1. Les Composants d'un Setup Haute Probabilité :\n`;
    text += `- **Balayage de Liquidité (Liquidity Sweep)** : Chasse aux Stop Loss des particuliers au-dessus des Equal Highs (BSL) ou en dessous des Equal Lows (SSL).\n`;
    text += `- **Changement de Structure (MSS / Market Structure Shift)** : Cassure agressive du dernier sommet/creux opposé avec un chandelier plein (déplacement).\n`;
    text += `- **Fair Value Gap (FVG)** : Déséquilibre de prix sur 3 bougies consécutives où l'espace vide entre la mèche 1 et la mèche 3 sert d'aimant de rééquilibrage.\n`;
    text += `- **Order Block (OB)** : La dernière bougie d'invalidation avant une impulsion créant un FVG et un BOS.\n\n`;

    text += `#### 2. La Checklist d'Exécution en 4 Étapes :\n`;
    text += `1. **Time** : Être dans une Killzone active (London ou New York).\n`;
    text += `2. **Draw on Liquidity (DOL)** : Savoir quel pôle de liquidité externe le marché cherche à rejoindre.\n`;
    text += `3. **Sweep + Shift** : Attendre le balayage de liquidité suivi d'un MSS en M5/M1.\n`;
    text += `4. **Entrée OTE** : Ordre limite sur le FVG ou retracement 62%-79% avec Stop Loss derrière le swing d'invalidation.\n`;

    return { reply: text, toolInvocations };
  }

  // 4. GREETINGS & CASUAL QUESTIONS
  const isGreeting = /^(bonjour|salut|hello|hi|hey|coucou|qui es[- ]tu|présente[- ]toi)/i.test(lower);
  const isAppHelpQuery = /(comment marche l'application|c'est quoi thunder edge|que peux[- ]tu faire|aide[- ]moi|fonctionnalités)/i.test(
    lower
  );

  if (isGreeting || isAppHelpQuery) {
    let text = `Bonjour ! Je suis votre **Coach de Trading Thunder Edge**.\n\n`;
    text += `Je connais vos données et votre journal sur le bout des doigts (${trades.length} positions enregistrées actuellement).\n\n`;
    text += `Vous pouvez me poser **n'importe quelle question** :\n`;
    text += `- 📅 *"On a quoi comme news aujourd'hui ?"*\n`;
    text += `- 📊 *"Tu en penses quoi de mes trades du mois dernier ?"*\n`;
    text += `- ⚖️ *"Compare ce mois et le mois dernier"*\n`;
    text += `- 🎯 *"Quel est mon meilleur setup ?"* ou *"C'est quoi ma pire session ?"*\n`;
    text += `- 📐 *"Comment calculer la taille de mon lot sur EUR/USD ?"*\n`;
    text += `- 🧠 *"C'est quoi un Order Block ?"*\n\n`;
    text += `De quoi souhaitez-vous parler ?`;
    return { reply: text, toolInvocations };
  }

  // 5. EVALUATION D'UNE PÉRIODE OU AVIS SUR LES TRADES (Only when asking about trades / performance)
  const isOpinionOrReview =
    /(pense.*quoi|qu'en pense|que pense|ton avis|donne ton avis|comment tu trouve|comment s'est passé|regarde mes trades|critique mes trades|fais un bilan|bilan de mes trades|mes trades du|trades du|mon avis|avis sur)/i.test(
      lower
    );

  const isTradeIntent =
    /(trade|position|pnl|bilan|résultat|stat|perf|journal|gain|perte|historique|compte|edge|compare|comparatif|évolution)/i.test(lower) ||
    isOpinionOrReview;

  const periodAnalysis = detectPeriodAndFilterTrades(trades, p);

  // Period Comparison
  if (periodAnalysis.isComparison && periodAnalysis.compareTrades) {
    const curA = computeFullTradeAnalytics(periodAnalysis.filteredTrades);
    const prevA = computeFullTradeAnalytics(periodAnalysis.compareTrades);

    toolInvocations.push({
      name: 'compareTwoPeriods',
      args: { period1: periodAnalysis.periodLabel, period2: periodAnalysis.comparePeriodLabel },
      result: { current: curA.netPnL, previous: prevA.netPnL },
    });

    let text = `### ⚖️ Comparatif de vos Performances : **${periodAnalysis.comparePeriodLabel}** vs **${periodAnalysis.periodLabel}**\n\n`;
    text += `Voici l'évolution statistique chiffrée entre les deux périodes :\n\n`;

    text += `| Indicateur Clé | ${periodAnalysis.comparePeriodLabel} | ${periodAnalysis.periodLabel} | Évolution |\n`;
    text += `| :--- | :---: | :---: | :---: |\n`;
    text += `| **Trades Clôturés** | ${prevA.closedTrades} | ${curA.closedTrades} | ${curA.closedTrades - prevA.closedTrades >= 0 ? '+' : ''}${curA.closedTrades - prevA.closedTrades} |\n`;
    text += `| **Taux de Réussite (Winrate)** | ${fmtPct(prevA.winRate)} | ${fmtPct(curA.winRate)} | ${(curA.winRate - prevA.winRate).toFixed(1)}% |\n`;
    text += `| **P&L Net** | ${fmtMoney(prevA.netPnL)} | ${fmtMoney(curA.netPnL)} | ${fmtMoney(curA.netPnL - prevA.netPnL)} |\n`;
    text += `| **Profit Factor** | ${prevA.profitFactor ? prevA.profitFactor.toFixed(2) : 'N/A'} | ${curA.profitFactor ? curA.profitFactor.toFixed(2) : 'N/A'} | - |\n`;
    text += `| **Espérance R / Trade** | ${fmtR(prevA.expectedR)} | ${fmtR(curA.expectedR)} | - |\n`;
    text += `| **Drawdown Max** | ${fmtMoney(prevA.maxDrawdownMoney)} | ${fmtMoney(curA.maxDrawdownMoney)} | - |\n\n`;

    text += `#### 🧐 Ce que j'en pense :\n`;
    if (curA.netPnL > prevA.netPnL) {
      text += `- 🚀 **Progression nette** : Votre P&L a progressé de **${fmtMoney(curA.netPnL - prevA.netPnL)}**. Votre régularité s'améliore.\n`;
    } else {
      text += `- ⚠️ **Ralentissement** : Votre P&L est en retrait de **${fmtMoney(Math.abs(curA.netPnL - prevA.netPnL))}**. Il est primordial d'analyser si vous avez forcé des positions ou augmenté votre risque unitaire.\n`;
    }

    return { reply: text, toolInvocations };
  }

  // Specific Period Audit or Opinion Request on Trades
  if (isTradeIntent && (periodAnalysis.isPeriodSpecific || isOpinionOrReview)) {
    const targetTrades = periodAnalysis.filteredTrades.length > 0 ? periodAnalysis.filteredTrades : trades;
    const a = computeFullTradeAnalytics(targetTrades);
    const targetLabel = periodAnalysis.filteredTrades.length > 0 ? periodAnalysis.periodLabel : 'Historique Global';

    toolInvocations.push({
      name: 'getTradesByDateRange',
      args: { period: targetLabel, count: targetTrades.length },
      result: { closedTrades: a.closedTrades, netPnL: a.netPnL, winRate: a.winRate },
    });

    if (a.closedTrades === 0) {
      let text = `### 📅 Bilan des Trades : **${targetLabel}**\n\n`;
      text += `Vous n'avez **aucun trade clôturé** enregistré sur la période **${targetLabel}**.\n\n`;
      if (trades.length > 0) {
        text += `💡 *Information :* Votre journal contient actuellement **${trades.length} trades** sur d'autres périodes. Vous pouvez me demander par exemple : *"Analyse mes trades de ce mois-ci"*, *"Analyse mes 10 derniers trades"*, ou *"Bilan global de mes statistiques"*.\n`;
      } else {
        text += `💡 Votre journal est actuellement vide. Vous pouvez ajouter des trades dans l'onglet **Journal** ou cliquer sur **Charger démo (Seed)** dans le Dashboard pour visualiser immédiatement vos analyses.\n`;
      }
      return { reply: text, toolInvocations };
    }

    let text = `### 🧐 Mon Bilan & Avis sur vos Trades : **${targetLabel}** (${a.closedTrades} trades clôturés)\n\n`;
    text += `Voici mon diagnostic chiffré et sans complaisance sur vos performances pour cette période :\n\n`;

    text += `#### 1. Performance Globale & P&L\n`;
    text += `- **Trades exécutés** : **${a.closedTrades} positions** (${a.wins} gagnants / ${a.losses} perdants / ${a.breakevens} BE)\n`;
    text += `- **Taux de réussite (Winrate)** : **${fmtPct(a.winRate)}** ${a.winRate >= 50 ? '🟢 *(Solide)*' : a.winRate >= 40 ? '🟡 *(Acceptable si R:R > 1:2)*' : '🔴 *(Insuffisant)*'}\n`;
    text += `- **P&L Net généré** : **${fmtMoney(a.netPnL)}** (Gains bruts : ${fmtMoney(a.grossProfit)} | Pertes brutes : ${fmtMoney(a.grossLoss)})\n`;
    text += `- **Profit Factor** : **${a.profitFactor ? a.profitFactor.toFixed(2) : 'N/A'}** ${a.profitFactor && a.profitFactor >= 1.5 ? '✅ *(Rentabilité institutionnelle)*' : a.profitFactor && a.profitFactor >= 1.0 ? '⚠️ *(Positif mais fragile)*' : '❌ *(Déficitaire)*'}\n`;
    text += `- **Espérance mathématique** : **${fmtR(a.expectedR)}** par trade pris\n`;
    text += `- **Drawdown Max sur la période** : **${fmtMoney(a.maxDrawdownMoney)}** (${fmtPct(a.maxDrawdownPercent)})\n`;
    text += `- **Ratio Gain Moyen / Perte Moyenne** : **${a.avgLoss > 0 ? (a.avgWin / a.avgLoss).toFixed(2) : 'N/A'}** (Gain moyen : ${fmtMoney(a.avgWin)} vs Perte moyenne : ${fmtMoney(a.avgLoss)})\n\n`;

    text += `#### 2. Ce qui a fait votre force (Points Forts)\n`;
    if (a.bestSetup) {
      const bs = a.setupStats[a.bestSetup];
      text += `- 🌟 **Setup numéro 1** : **"${a.bestSetup}"** a généré **${fmtMoney(bs.netPnL)}** avec **${fmtPct(bs.winRate)}** de réussite (${bs.count} trades).\n`;
    }
    if (a.bestSession) {
      const bss = a.sessionStats[a.bestSession];
      text += `- ⏰ **Meilleure session** : **"${a.bestSession}"** avec **${fmtMoney(bss.netPnL)}** de gain net.\n`;
    }
    if (a.bestTrade) {
      text += `- 🏆 **Meilleur trade** : **${a.bestTrade.symbol}** (${a.bestTrade.direction}) rapportant **${fmtMoney(a.bestTrade.netPnL)}** (${fmtR(a.bestTrade.rMultiple)}).\n\n`;
    } else {
      text += `\n`;
    }

    text += `#### 3. Points de Vulnérabilité & Fuites de Capital\n`;
    if (a.worstTrade) {
      text += `- 🔴 **Plus grosse perte** : **${a.worstTrade.symbol}** (${a.worstTrade.direction}) avec **${fmtMoney(a.worstTrade.netPnL)}** (${fmtR(a.worstTrade.rMultiple)}).\n`;
    }
    if (a.worstSession && a.sessionStats[a.worstSession].netPnL < 0) {
      const wss = a.sessionStats[a.worstSession];
      text += `- ⚠️ **Session déficitaire** : La session **"${a.worstSession}"** vous coûte **${fmtMoney(wss.netPnL)}**. C'est une fuite active de capital.\n`;
    }
    const mistakeEntries = Object.entries(a.mistakeStats).sort((x, y) => y[1].totalCost - x[1].totalCost);
    if (mistakeEntries.length > 0) {
      const topM = mistakeEntries[0];
      text += `- 🧠 **Erreur déclarée n°1** : **"${topM[0]}"** commise ${topM[1].count} fois pour un coût direct de **${fmtMoney(topM[1].totalCost)}**.\n\n`;
    } else {
      text += `\n`;
    }

    text += `#### 4. Mon Avis Sincère de Coach ("Ce que j'en pense")\n`;
    if (a.netPnL > 0 && a.profitFactor && a.profitFactor >= 1.4) {
      text += `Votre bilan sur **${targetLabel}** est **très positif et mathématiquement sain**. Vous avez su tirer parti de vos setups principaux tout en maintenant un Profit Factor supérieur à 1.4. Votre défi principal n'est plus technique, mais purement psychologique : continuer d'exécuter avec la même rigueur sans tomber dans l'excès de confiance.\n\n`;
    } else if (a.netPnL > 0) {
      text += `Votre bilan sur **${targetLabel}** est dans le vert, mais **votre marge de manœuvre reste étroite**. Vos gains sont souvent rognés par des pertes trop rapprochées ou une session sous-optimale. En supprimant simplement les prises de position hors de votre setup phare, votre P&L net ferait un bond substantiel.\n\n`;
    } else {
      text += `Cette période a été difficile avec un P&L négatif de **${fmtMoney(a.netPnL)}**. La bonne nouvelle est que vos statistiques indiquent précisément d'où vient l'hémorragie : vos pertes se concentrent sur des créneaux ou setups spécifiques. Il ne faut pas changer de stratégie, mais **réduire la voilure** et appliquer un coupe-circuit strict.\n\n`;
    }

    text += `#### 5. Plan d'Action Recommandé :\n`;
    text += `1. **Focalisation A+** : Réservez au moins 80% de vos interventions à votre setup de prédilection ${a.bestSetup ? `(**"${a.bestSetup}"**)` : ''}.\n`;
    text += `2. **Règle du Coupe-Circuit** : Dès que vous encaissez 2 stops consécutifs dans la même journée, fermez la station de trading jusqu'au lendemain.\n`;
    text += `3. **Exécution du Stop** : Ne déplacez jamais un Stop Loss pour lui donner "de l'air" ; respectez l'invalidation technique initiale.\n`;

    return { reply: text, toolInvocations };
  }

  const analytics = computeFullTradeAnalytics(trades);

  // 6. GLOBAL STATISTICAL AUDIT
  const isGlobalStatsQuery =
    /(analyse.*mes.*trade|analyser.*mes.*trade|mes stats|mes statistiques|mon journal|mon bilan|mes positions|mes résultats|combien j'ai gagné|combien j'ai perdu|mon winrate|mon profit factor|mon espérance|mon edge|audite mon journal|analyse de performance)/i.test(
      lower
    );

  if (isGlobalStatsQuery) {
    toolInvocations.push({
      name: 'getTradesByDateRange',
      args: { startDate: '2000-01-01', endDate: '2099-12-31' },
      result: {
        totalTrades: analytics.totalTrades,
        closedTrades: analytics.closedTrades,
        winRate: analytics.winRate,
        netPnL: analytics.netPnL,
        profitFactor: analytics.profitFactor,
        expectedR: analytics.expectedR,
      },
    });

    if (analytics.totalTrades === 0) {
      let text = `### 📊 Audit de Votre Journal Thunder Edge\n\n`;
      text += `Actuellement, **aucun trade n'est enregistré dans votre journal**.\n\n`;
      text += `Pour que je puisse analyser vos statistiques et votre edge de marché :\n`;
      text += `1. **Ajouter un trade réel** : Rendez-vous dans l'onglet **Journal** puis cliquez sur **+ Nouveau Trade** pour saisir vos entrées, sorties, stop loss et setups.\n`;
      text += `2. **Tester avec des données de démo** : Vous pouvez cliquer sur **Charger démo (Seed)** dans le Dashboard pour charger un jeu de trades institutionnels et visualiser immédiatement tous les calculs (Winrate, PnL Curve, Espérance R, Drawdown).\n\n`;
      return { reply: text, toolInvocations };
    }

    let text = `### 📈 Audit Complet de vos Statistiques (${analytics.closedTrades} trades clôturés)\n\n`;
    text += `Voici l'analyse détaillée extraite directement de vos données enregistrées dans Thunder Edge :\n\n`;

    text += `#### 1. Performance Globale & P&L\n`;
    text += `- **Nombre total de trades** : **${analytics.totalTrades}** (${analytics.closedTrades} clôturés, ${analytics.openTrades} en cours)\n`;
    text += `- **Taux de réussite (Winrate)** : **${fmtPct(analytics.winRate)}** (${analytics.wins} gagnants / ${analytics.losses} perdants / ${analytics.breakevens} BE)\n`;
    text += `- **P&L Net cumulé** : **${fmtMoney(analytics.netPnL)}** (Gains bruts : ${fmtMoney(analytics.grossProfit)} | Pertes brutes : ${fmtMoney(analytics.grossLoss)})\n`;
    text += `- **Profit Factor** : **${analytics.profitFactor ? analytics.profitFactor.toFixed(2) : 'N/A'}** ${analytics.profitFactor && analytics.profitFactor >= 1.5 ? '✅ *(Excellent)*' : analytics.profitFactor && analytics.profitFactor >= 1.0 ? '⚠️ *(Positif mais perfectible)*' : '❌ *(Négatif)*'}\n`;
    text += `- **Espérance R par trade** : **${fmtR(analytics.expectedR)}** (sur ${analytics.completeRRCount} trades avec Stop Loss et Take Profit renseignés)\n`;
    text += `- **Cumul R réalisé** : **${fmtR(analytics.totalRealizedR)}**\n`;
    text += `- **Ratio Gain Moyen / Perte Moyenne** : **${analytics.avgLoss > 0 ? (analytics.avgWin / analytics.avgLoss).toFixed(2) : 'N/A'}** (Gain moyen : ${fmtMoney(analytics.avgWin)} vs Perte moyenne : ${fmtMoney(analytics.avgLoss)})\n\n`;

    text += `#### 2. Contrôle du Risque & Drawdown\n`;
    text += `- **Drawdown Maximum** : **${fmtMoney(analytics.maxDrawdownMoney)}** (${fmtPct(analytics.maxDrawdownPercent)})\n`;
    text += `- **Série actuelle** : **${analytics.currentStreak.count} ${analytics.currentStreak.type === 'WIN' ? 'Gains consécutifs' : analytics.currentStreak.type === 'LOSS' ? 'Pertes consécutives' : 'Neutre'}**\n`;
    text += `- **Plus longue série de gains** : **${analytics.maxWinStreak}** | **Pertes consécutives max** : **${analytics.maxLossStreak}**\n\n`;

    text += `#### 3. Diagnostic de votre Edge\n`;
    if (analytics.bestSetup) {
      const bs = analytics.setupStats[analytics.bestSetup];
      text += `- 🌟 **Setup phare** : **"${analytics.bestSetup}"** est votre setup le plus rentable avec **${fmtMoney(bs.netPnL)}** générés (${bs.count} trades, ${fmtPct(bs.winRate)} de winrate).\n`;
    }
    if (analytics.bestSession) {
      const bss = analytics.sessionStats[analytics.bestSession];
      text += `- ⏰ **Meilleure session** : **"${analytics.bestSession}"** avec **${fmtMoney(bss.netPnL)}** (${bss.count} trades).\n`;
    }
    if (analytics.worstSession && analytics.sessionStats[analytics.worstSession].netPnL < 0) {
      const wss = analytics.sessionStats[analytics.worstSession];
      text += `- ⚠️ **Fuite de capital identifiée** : La session **"${analytics.worstSession}"** vous coûte **${fmtMoney(wss.netPnL)}**. Pensez à limiter vos interventions sur ce créneau.\n`;
    }

    return { reply: text, toolInvocations };
  }

  // 4. SETUP SPECIFIC INQUIRIES
  const isSetupStatsQuery =
    /(meilleur setup|pire setup|mes setups|quel setup|rentabilité setup|stratégie la plus rentable|quel est mon meilleur)/i.test(
      lower
    );

  if (isSetupStatsQuery) {
    if (analytics.closedTrades === 0) {
      return {
        reply: `### 🎯 Analyse de vos Setups\n\nVous n'avez pas encore de trades enregistrés avec un nom de setup dans Thunder Edge. Lorsque vous ajoutez un trade dans le journal (ex: *Order Block*, *FVG Retracement*, *Breakout*, *Liquidity Sweep*), je calcule automatiquement le taux de réussite et le P&L associé à chaque setup pour isoler votre meilleur avantage statistique.`,
        toolInvocations,
      };
    }

    let text = `### 🎯 Bilan de vos Setups de Trading\n\n`;
    text += `Voici les statistiques comparatives de vos setups enregistrés dans votre journal :\n\n`;

    const setupEntries = Object.entries(analytics.setupStats).sort((a, b) => b[1].netPnL - a[1].netPnL);

    for (const [name, s] of setupEntries) {
      const medal = s.netPnL > 0 ? '🟢' : '🔴';
      text += `- ${medal} **${name}** : **${fmtMoney(s.netPnL)}** | **${fmtPct(s.winRate)}** winrate (${s.count} trades : ${s.wins}W / ${s.losses}L) | Profit Factor : ${s.profitFactor ? s.profitFactor.toFixed(2) : 'N/A'}\n`;
    }

    if (analytics.bestSetup) {
      text += `\n💡 **Recommandation du Coach** : Concentrez 80% de votre capital et de votre attention sur votre setup **"${analytics.bestSetup}"**. C'est là que réside votre véritable avantage mathématique.`;
    }

    return { reply: text, toolInvocations };
  }

  // 5. SESSION & KILLZONE SPECIFIC INQUIRIES
  const isSessionStatsQuery =
    /(london|new york|ny|asia|asie|session|killzone|quelle heure|meilleure session|pire session)/i.test(lower);

  if (isSessionStatsQuery) {
    let targetSession: string | null = null;
    if (lower.includes('london close')) targetSession = 'London Close';
    else if (lower.includes('london')) targetSession = 'London';
    else if (lower.includes('new york') || lower.includes('ny')) targetSession = 'New York';
    else if (lower.includes('asia') || lower.includes('asie')) targetSession = 'Asia';

    if (targetSession && analytics.sessionStats[targetSession]) {
      const s = analytics.sessionStats[targetSession];
      toolInvocations.push({
        name: 'getTradesBySession',
        args: { session: targetSession },
        result: s,
      });

      let text = `### ⏰ Analyse de Session : **${targetSession}**\n\n`;
      text += `Données de votre journal pour la session **${targetSession}** :\n\n`;
      text += `- **Trades exécutés** : **${s.count}** (${s.wins} gagnants / ${s.losses} perdants)\n`;
      text += `- **Taux de réussite (Winrate)** : **${fmtPct(s.winRate)}**\n`;
      text += `- **P&L Net généré** : **${fmtMoney(s.netPnL)}**\n`;
      text += `- **Espérance R moyenne** : **${fmtR(s.expectedR)}** par position\n\n`;

      if (s.netPnL > 0) {
        text += `✅ Cette session est **profitable** pour votre profil de trading. Continuez à appliquer votre plan rigoureusement.`;
      } else {
        text += `⚠️ Vous perdez actuellement de l'argent sur cette session (**${fmtMoney(s.netPnL)}**). Examinez si vos setups sont adaptés à la liquidité de ce créneau horaire ou si vous forcez des positions.`;
      }

      return { reply: text, toolInvocations };
    }

    let text = `### ⏰ Performance par Session & Killzones\n\n`;
    text += `Voici la répartition de vos résultats par session de trading :\n\n`;

    const sessionEntries = Object.entries(analytics.sessionStats).sort((a, b) => b[1].netPnL - a[1].netPnL);

    if (sessionEntries.length === 0) {
      text += `Aucun trade n'est encore associé à une session dans votre journal. Thunder Edge associe automatiquement chaque trade à sa Killzone (London, New York, Asia, London Close en heure Madagascar UTC+3).\n`;
    } else {
      for (const [name, s] of sessionEntries) {
        const badge = s.netPnL >= 0 ? '🟢' : '🔴';
        text += `- ${badge} **${name}** : **${fmtMoney(s.netPnL)}** | **${fmtPct(s.winRate)}** winrate (${s.count} trades : ${s.wins}W / ${s.losses}L) | Espérance : ${fmtR(s.expectedR)}\n`;
      }
    }

    text += `\n#### Horaires de référence des Killzones (Madagascar UTC+3) :\n`;
    text += `- **Asian Killzone** : 04:00 - 08:00 (Range asiatique & liquidité de nuit)\n`;
    text += `- **London Killzone** : 09:00 - 12:00 (Volatilité majeure sur paires EUR/GBP et indices européens)\n`;
    text += `- **New York Killzone** : 14:00 - 17:00 (Open US, Nasdaq, S&P 500, Or)\n`;
    text += `- **London Close** : 18:00 - 20:00 (Prises de bénéfices et retracements de fin de journée)\n`;

    return { reply: text, toolInvocations };
  }

  // 6. ASSET & SYMBOL INQUIRIES
  const isAssetStatsQuery =
    /(gold|or|xau|nasdaq|us100|sp500|us500|dow|us30|eurusd|gbpusd|actif|paire|instrument|symbole|sur quoi je gagne)/i.test(
      lower
    );

  if (isAssetStatsQuery && Object.keys(analytics.symbolStats).length > 0) {
    let text = `### ⚡ Répartition de vos Résultats par Actif / Instrument\n\n`;
    text += `Voici vos performances chiffrées selon les instruments tradés :\n\n`;

    const symEntries = Object.entries(analytics.symbolStats).sort((a, b) => b[1].netPnL - a[1].netPnL);

    for (const [sym, s] of symEntries) {
      const badge = s.netPnL >= 0 ? '🟢' : '🔴';
      text += `- ${badge} **${sym}** : **${fmtMoney(s.netPnL)}** | **${fmtPct(s.winRate)}** winrate (${s.count} trades)\n`;
    }

    if (analytics.bestSymbol) {
      text += `\n💡 Votre instrument le plus profitable est actuellement **${analytics.bestSymbol}**.`;
    }

    return { reply: text, toolInvocations };
  }

  // 7. MISTAKES & EMOTIONAL LEAKS
  const isMistakeQuery =
    /(erreur|fomo|revenge|perte|émotion|discipline|overtrading|tilt|fuite de capital|quelles erreurs)/i.test(lower);

  if (isMistakeQuery) {
    let text = `### 🧠 Audit des Erreurs & Psychologie de Trading\n\n`;

    const mistakeEntries = Object.entries(analytics.mistakeStats).sort((a, b) => b[1].totalCost - a[1].totalCost);

    if (mistakeEntries.length > 0) {
      text += `Voici les erreurs répertoriées dans votre journal et leur impact financier direct :\n\n`;
      let totalCostAll = 0;
      for (const [mName, m] of mistakeEntries) {
        totalCostAll += m.totalCost;
        text += `- ❌ **${mName}** : **${m.count} fois** | Coût cumulé : **${fmtMoney(m.totalCost)}** (${fmtR(-m.totalR)})\n`;
      }
      text += `\n💸 **Coût total de vos erreurs déclarées** : **${fmtMoney(totalCostAll)}** !\n`;
      text += `*Si vous éliminez simplement votre erreur n°1 (${mistakeEntries[0][0]}), votre P&L net augmenterait immédiatement de ${fmtMoney(mistakeEntries[0][1].totalCost)}.*\n\n`;
    }

    if (analytics.postLossStats.tradesInWindow > 0) {
      text += `#### ⚠️ Analyse du Comportement Post-Perte (Revenge Trading) :\n`;
      text += `- Trades pris dans l'heure suivant une perte : **${analytics.postLossStats.tradesInWindow}**\n`;
      text += `- Taux de réussite dans l'heure post-perte : **${fmtPct(analytics.postLossStats.winRateInWindow)}** contre **${fmtPct(analytics.postLossStats.winRateOutsideWindow)}** hors de cette fenêtre.\n`;
      if (analytics.postLossStats.winRateOutsideWindow > analytics.postLossStats.winRateInWindow) {
        text += `📉 **Chute de performance confirmée** : Vous perdez en lucidité juste après une perte. Appliquez la règle du coupe-circuit : après un stop touché, quittez vos écrans 45 minutes.\n\n`;
      }
    }

    text += `#### Protocole Anti-Tilt Recommandé :\n`;
    text += `1. **Règle des 2 Pertes Consécutives** : Après 2 stops touchés au cours d'une même session, fermeture obligatoire de la plateforme.\n`;
    text += `2. **Acceptation Probabiliste** : Une perte n'est pas un échec personnel, c'est simplement le coût d'exploitation normal d'un système à espérance positive.\n`;
    text += `3. **Vérification du Plan** : Avant de cliquer, demandez-vous : *Est-ce mon setup A+ ou est-ce l'envie de récupérer mon argent ?*\n`;

    return { reply: text, toolInvocations };
  }

  // 8. BEST & WORST TRADE DETAILS
  const isBestWorstQuery =
    /(meilleur trade|pire trade|plus gros gain|plus grosse perte|plus gros trade)/i.test(lower);

  if (isBestWorstQuery && (analytics.bestTrade || analytics.worstTrade)) {
    let text = `### 🏆 Vos Trades Extrêmes (Meilleur & Pire)\n\n`;

    if (analytics.bestTrade) {
      const bt = analytics.bestTrade;
      text += `#### 🟢 Votre Meilleur Trade :\n`;
      text += `- **Actif** : **${bt.symbol}** (${bt.direction})\n`;
      text += `- **Résultat** : **${fmtMoney(bt.netPnL)}** (${fmtR(bt.rMultiple)})\n`;
      text += `- **Setup** : ${bt.setup || 'Non renseigné'} | Session : ${bt.session || 'N/A'}\n`;
      text += `- **Date** : ${new Date(bt.openedAt).toLocaleDateString('fr-FR')}\n\n`;
    }

    if (analytics.worstTrade) {
      const wt = analytics.worstTrade;
      text += `#### 🔴 Votre Plus Grosse Perte :\n`;
      text += `- **Actif** : **${wt.symbol}** (${wt.direction})\n`;
      text += `- **Résultat** : **${fmtMoney(wt.netPnL)}** (${fmtR(wt.rMultiple)})\n`;
      text += `- **Setup** : ${wt.setup || 'Non renseigné'} | Erreur : ${wt.mistake || 'Aucune'}\n`;
      text += `- **Date** : ${new Date(wt.openedAt).toLocaleDateString('fr-FR')}\n\n`;
      text += `💡 *Analysez si la taille du stop loss sur cette perte correspondait bien à votre risque maximal prévu.*`;
    }

    return { reply: text, toolInvocations };
  }

  // 9. DYNAMIC INTENTIONAL COACHING RESPONSE TO ANY QUESTION
  let text = `### 💬 Analyse du Coach Thunder Edge\n\n`;

  const mentionsDrawdown = /drawdown|dd|perte max/i.test(lower);
  const mentionsWinrate = /winrate|taux de réussite|pourcentage/i.test(lower);
  const mentionsForex = /forex|paires|devises/i.test(lower);
  const mentionsIndice = /nasdaq|us100|sp500|dow|indices/i.test(lower);

  if (mentionsDrawdown) {
    text += `#### Focus sur le Drawdown & Contrôle des Pertes :\n`;
    text += `Le Drawdown mesure la baisse maximale de votre capital depuis son point culminant. Dans votre journal, votre Drawdown Maximum est de **${fmtMoney(analytics.maxDrawdownMoney)}** (${fmtPct(analytics.maxDrawdownPercent)}).\n`;
    text += `Pour le maintenir bas, ne dépassez jamais 1% de risque par trade et arrêtez votre session dès 2 pertes consécutives.\n\n`;
  } else if (mentionsWinrate) {
    text += `#### Focus sur le Winrate & Espérance Mathématique :\n`;
    text += `Votre taux de réussite actuel est de **${fmtPct(analytics.winRate)}** avec un ratio Gain Moyen / Perte Moyenne de **${analytics.avgLoss > 0 ? (analytics.avgWin / analytics.avgLoss).toFixed(2) : 'N/A'}**.\n`;
    text += `Rappelez-vous qu'un winrate de 45% est extrêmement rentable si votre gain moyen est deux fois supérieur à votre perte moyenne.\n\n`;
  } else if (mentionsIndice || mentionsForex) {
    text += `#### Comportement Institutionnel des Actifs :\n`;
    if (mentionsIndice) {
      text += `- **Indices (US100 / US500)** : Les mouvements directionnels les plus propres se construisent souvent après 16h00 (heure Madagascar UTC+3), une fois le piège d'ouverture liquidé.\n`;
    }
    if (mentionsForex) {
      text += `- **Forex Majeures (EUR/USD, GBP/USD)** : La Killzone London (09h00 - 12h00 Madagascar) offre les balayages de liquidité les plus fiables de la journée.\n`;
    }
    text += `\n`;
  }

  text += `#### 💡 Conseil Personnalisé :\n`;
  if (analytics.closedTrades > 0) {
    text += `- Sur l'ensemble de vos **${analytics.closedTrades} trades clôturés**, votre P&L net s'élève à **${fmtMoney(analytics.netPnL)}** avec une espérance de **${fmtR(analytics.expectedR)}** par position.\n`;
    text += `- Pour franchir un palier de régularité, isolez votre meilleur setup (${analytics.bestSetup || 'A+'}) et refusez catégoriquement toute entrée qui ne coche pas l'ensemble de vos règles de confluence.\n`;
  } else {
    text += `- Renseignez vos positions au fur et à mesure dans l'onglet **Journal** pour débloquer l'ensemble de vos métriques prédictives et heatmaps de session.\n`;
  }

  return { reply: text, toolInvocations };
}
