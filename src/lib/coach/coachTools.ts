import { FunctionDeclaration, Type } from '@google/genai';
import { Trade } from '../../types/trade';
import { isTradeRRComplete } from '../calculations/riskReward';
import { calculateWinRate, calculateProfitFactor, calculateExpectancy } from '../calculations/statistics';
import { getTradeKillzone, ComputedKillzone } from '../sessionCalculator';

/**
 * 1. getTradesByDateRange Tool Declaration
 */
export const getTradesByDateRangeDeclaration: FunctionDeclaration = {
  name: 'getTradesByDateRange',
  description:
    "Retourne les trades dont la date d'ouverture (openedAt) ou de clôture (closedAt) est comprise entre startDate et endDate, avec métriques de performance et détail des positions.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      startDate: {
        type: Type.STRING,
        description: "Date de début au format ISO (ex: '2026-01-01' ou '2026-01-01T00:00:00Z').",
      },
      endDate: {
        type: Type.STRING,
        description: "Date de fin au format ISO (ex: '2026-01-31' ou '2026-01-31T23:59:59Z').",
      },
    },
    required: ['startDate', 'endDate'],
  },
};

/**
 * 2. getTradesBySession Tool Declaration
 * Restreint aux 4 Killzones officielles de Thunder Edge
 */
export const getTradesBySessionDeclaration: FunctionDeclaration = {
  name: 'getTradesBySession',
  description:
    'Retourne les trades exécutés dans une killzone spécifique (London, New York, Asia, ou London Close) avec métriques agrégées.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      session: {
        type: Type.STRING,
        description: 'La killzone officielle parmi les 4 sessions de référence.',
        enum: ['London', 'New York', 'Asia', 'London Close'],
      },
      limit: {
        type: Type.INTEGER,
        description: 'Nombre maximal de trades récents à renvoyer dans la liste (par défaut 50).',
      },
    },
    required: ['session'],
  },
};

/**
 * 3. compareTwoPeriods Tool Declaration
 */
export const compareTwoPeriodsDeclaration: FunctionDeclaration = {
  name: 'compareTwoPeriods',
  description:
    'Compare directement les métriques de performance (winrate, P&L net, profit factor, Espérance R et complétude) entre deux périodes temporelles distinctes A et B.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      periodAStart: {
        type: Type.STRING,
        description: 'Date de début de la période A (format ISO).',
      },
      periodAEnd: {
        type: Type.STRING,
        description: 'Date de fin de la période A (format ISO).',
      },
      periodBStart: {
        type: Type.STRING,
        description: 'Date de début de la période B (format ISO).',
      },
      periodBEnd: {
        type: Type.STRING,
        description: 'Date de fin de la période B (format ISO).',
      },
    },
    required: ['periodAStart', 'periodAEnd', 'periodBStart', 'periodBEnd'],
  },
};

export const COACH_TOOLS = [
  getTradesByDateRangeDeclaration,
  getTradesBySessionDeclaration,
  compareTwoPeriodsDeclaration,
];

/**
 * Normalizes a date string or timestamp to milliseconds.
 * If the input is just YYYY-MM-DD, handles start/end of day appropriately.
 */
function parseDateRangeBoundary(dateStr: string, isEnd: boolean = false): number {
  if (!dateStr) return isEnd ? Infinity : -Infinity;
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed + (isEnd ? 'T23:59:59.999Z' : 'T00:00:00.000Z'));
    return d.getTime();
  }
  return new Date(trimmed).getTime();
}

/**
 * Filter trades that fall within [startMs, endMs] based on openedAt or closedAt
 */
function filterTradesByDateRange(trades: Trade[], startDate: string, endDate: string): Trade[] {
  const startMs = parseDateRangeBoundary(startDate, false);
  const endMs = parseDateRangeBoundary(endDate, true);

  return trades.filter((t) => {
    const openedTime = t.openedAt ? new Date(t.openedAt).getTime() : NaN;
    const closedTime = t.closedAt ? new Date(t.closedAt).getTime() : NaN;

    const openedInRange = !isNaN(openedTime) && openedTime >= startMs && openedTime <= endMs;
    const closedInRange = !isNaN(closedTime) && closedTime >= startMs && closedTime <= endMs;

    return openedInRange || closedInRange;
  });
}

/**
 * Helper to compute standardized metrics for a slice of trades.
 * Strictly uses calculateWinRate, calculateProfitFactor, and calculateExpectancy.
 */
function computePeriodMetrics(trades: Trade[], periodLabel?: { start: string; end: string }) {
  const closedTrades = trades.filter(
    (t) =>
      t.status === 'CLOSED' ||
      (!t.status && Boolean(t.closedAt)) ||
      (t.status as string) === 'WIN' ||
      (t.status as string) === 'LOSS' ||
      (t.status as string) === 'BE'
  );
  const winRateRes = calculateWinRate(trades);
  const pfRes = calculateProfitFactor(trades);
  const expRes = calculateExpectancy(trades);

  let totalR: number | null = null;
  const completeList = closedTrades.filter(
    (t) => isTradeRRComplete(t) && t.rMultiple !== null && t.rMultiple !== undefined && !isNaN(t.rMultiple)
  );
  if (completeList.length > 0) {
    totalR = completeList.reduce((acc, t) => acc + (t.rMultiple || 0), 0);
  }

  const netPnL = closedTrades.reduce((acc, t) => acc + (t.netPnL || 0), 0);

  const incompleteRatioPercent =
    expRes.totalClosedTradesCount > 0
      ? Math.round((expRes.incompleteTradesCount / expRes.totalClosedTradesCount) * 1000) / 10
      : 0;

  return {
    period: periodLabel,
    totalTrades: trades.length,
    closedTrades: closedTrades.length,
    completeTrades: expRes.validRTradesCount,
    incompleteTrades: expRes.incompleteTradesCount,
    incompleteRatioPercent,
    isSmallSample: trades.length < 15,
    wins: winRateRes.wins,
    losses: winRateRes.losses,
    breakevens: winRateRes.breakeven,
    winRate: winRateRes.winRate !== null ? Math.round(winRateRes.winRate * 10) / 10 : 0,
    netPnL: Math.round(netPnL * 100) / 100,
    grossProfit: Math.round(pfRes.grossProfit * 100) / 100,
    grossLoss: Math.round(pfRes.grossLoss * 100) / 100,
    profitFactor: pfRes.profitFactor !== null && isFinite(pfRes.profitFactor) ? Math.round(pfRes.profitFactor * 100) / 100 : null,
    expectedR: expRes.rExpectancy !== null ? Math.round(expRes.rExpectancy * 100) / 100 : null,
    totalR: totalR !== null ? Math.round(totalR * 100) / 100 : null,
  };
}

/**
 * Execution handler for getTradesByDateRange
 */
export function executeGetTradesByDateRange(trades: Trade[], args: { startDate: string; endDate: string }) {
  const { startDate, endDate } = args;
  const filtered = filterTradesByDateRange(trades, startDate, endDate);
  const metrics = computePeriodMetrics(filtered, { start: startDate, end: endDate });

  const safeList = filtered.slice(0, 50).map((t) => ({
    id: t.id,
    ticket: t.ticket || t.id,
    symbol: t.symbol,
    direction: t.direction,
    status: t.status,
    openedAt: t.openedAt,
    closedAt: t.closedAt,
    netPnL: t.netPnL !== null && t.netPnL !== undefined ? Math.round(t.netPnL * 100) / 100 : null,
    rMultiple: t.rMultiple !== null && t.rMultiple !== undefined ? Math.round(t.rMultiple * 100) / 100 : null,
    plannedRR: t.plannedRR !== null && t.plannedRR !== undefined ? Math.round(t.plannedRR * 100) / 100 : null,
    setup: t.setup || 'Sans setup',
    session: getTradeKillzone(t, 'Indian/Antananarivo'),
    isRRComplete: isTradeRRComplete(t),
    mistake: t.mistake || 'NONE',
  }));

  return {
    ...metrics,
    tradesSampleCount: safeList.length,
    trades: safeList,
    note: filtered.length > 50 ? `Affichage limité aux 50 premiers trades sur ${filtered.length} trouvés.` : undefined,
  };
}

/**
 * Execution handler for getTradesBySession
 */
export function executeGetTradesBySession(trades: Trade[], args: { session: string; limit?: number }) {
  const { session, limit = 50 } = args;

  // Map enum to canonical Killzone
  let targetCanonical: ComputedKillzone = 'Hors Killzone';
  const norm = (session || '').toLowerCase().trim();
  if (norm.includes('london close')) {
    targetCanonical = 'London Close Killzone';
  } else if (norm.includes('london')) {
    targetCanonical = 'London Killzone';
  } else if (norm.includes('new york') || norm.includes('ny')) {
    targetCanonical = 'New York Killzone';
  } else if (norm.includes('asia') || norm.includes('tokyo')) {
    targetCanonical = 'Asian Killzone';
  }

  const sessionTrades = trades.filter((t) => {
    const kz = getTradeKillzone(t, 'Indian/Antananarivo');
    if (kz === targetCanonical) return true;
    if (t.session && typeof t.session === 'string') {
      const sLower = t.session.toLowerCase();
      if (norm.includes('london close') && sLower.includes('london close')) return true;
      if (norm.includes('london') && !norm.includes('close') && sLower.includes('london') && !sLower.includes('close')) return true;
      if ((norm.includes('new york') || norm.includes('ny')) && (sLower.includes('new york') || sLower.includes('ny'))) return true;
      if ((norm.includes('asia') || norm.includes('tokyo')) && (sLower.includes('asia') || sLower.includes('tokyo'))) return true;
    }
    return false;
  });

  const metrics = computePeriodMetrics(sessionTrades);
  const sampleList = sessionTrades.slice(0, limit).map((t) => ({
    id: t.id,
    ticket: t.ticket || t.id,
    symbol: t.symbol,
    direction: t.direction,
    status: t.status,
    openedAt: t.openedAt,
    closedAt: t.closedAt,
    netPnL: t.netPnL !== null && t.netPnL !== undefined ? Math.round(t.netPnL * 100) / 100 : null,
    rMultiple: t.rMultiple !== null && t.rMultiple !== undefined ? Math.round(t.rMultiple * 100) / 100 : null,
    setup: t.setup || 'Sans setup',
    session: targetCanonical,
    isRRComplete: isTradeRRComplete(t),
  }));

  return {
    requestedSession: session,
    matchedKillzone: targetCanonical,
    ...metrics,
    recentTradesCount: sampleList.length,
    recentTrades: sampleList,
  };
}

/**
 * Execution handler for compareTwoPeriods
 */
export function executeCompareTwoPeriods(
  trades: Trade[],
  args: { periodAStart: string; periodAEnd: string; periodBStart: string; periodBEnd: string }
) {
  const { periodAStart, periodAEnd, periodBStart, periodBEnd } = args;

  const tradesA = filterTradesByDateRange(trades, periodAStart, periodAEnd);
  const tradesB = filterTradesByDateRange(trades, periodBStart, periodBEnd);

  const metricsA = computePeriodMetrics(tradesA, { start: periodAStart, end: periodAEnd });
  const metricsB = computePeriodMetrics(tradesB, { start: periodBStart, end: periodBEnd });

  const winRateDelta = Math.round((metricsB.winRate - metricsA.winRate) * 10) / 10;
  const netPnLDelta = Math.round((metricsB.netPnL - metricsA.netPnL) * 100) / 100;

  const pfA = metricsA.profitFactor;
  const pfB = metricsB.profitFactor;
  const profitFactorDelta = pfA !== null && pfB !== null ? Math.round((pfB - pfA) * 100) / 100 : null;

  const expA = metricsA.expectedR;
  const expB = metricsB.expectedR;
  const expectedRDelta = expA !== null && expB !== null ? Math.round((expB - expA) * 100) / 100 : null;

  let sampleDifferenceNote: string | undefined = undefined;
  if (metricsA.isSmallSample && metricsB.isSmallSample) {
    sampleDifferenceNote = 'Attention : les deux périodes ont un échantillon restreint (< 15 trades).';
  } else if (metricsA.isSmallSample) {
    sampleDifferenceNote = `Attention : la période A ne compte que ${metricsA.totalTrades} trades (échantillon restreint).`;
  } else if (metricsB.isSmallSample) {
    sampleDifferenceNote = `Attention : la période B ne compte que ${metricsB.totalTrades} trades (échantillon restreint).`;
  }

  return {
    periodA: metricsA,
    periodB: metricsB,
    comparison: {
      winRateDelta,
      netPnLDelta,
      profitFactorDelta,
      expectedRDelta,
      sampleDifferenceNote,
    },
  };
}

/**
 * Central tool dispatcher
 */
export function executeCoachTool(toolName: string, args: Record<string, any>, trades: Trade[]) {
  switch (toolName) {
    case 'getTradesByDateRange':
      return executeGetTradesByDateRange(trades, args as { startDate: string; endDate: string });
    case 'getTradesBySession':
      return executeGetTradesBySession(trades, args as { session: string; limit?: number });
    case 'compareTwoPeriods':
      return executeCompareTwoPeriods(
        trades,
        args as { periodAStart: string; periodAEnd: string; periodBStart: string; periodBEnd: string }
      );
    default:
      throw new Error(`Outil inconnu : ${toolName}`);
  }
}
