import { Trade } from '../../types/trade';
import { WinRateResult, ProfitFactorResult, ExpectancyResult } from '../../types/calculations';
import { safeAdd, safeDivide } from './precision';
import { isTradeRRComplete } from './riskReward';

const EPSILON = 0.00001;

/**
 * Calculates Win Rate strictly excluding open trades.
 */
export function calculateWinRate(trades: Trade[]): WinRateResult {
  let wins = 0;
  let losses = 0;
  let breakeven = 0;
  let open = 0;

  for (const t of trades) {
    if (t.status === 'OPEN') {
      open++;
      continue;
    }

    if (t.netPnL === null || t.netPnL === undefined) {
      continue;
    }

    if (t.netPnL > EPSILON) {
      wins++;
    } else if (t.netPnL < -EPSILON) {
      losses++;
    } else {
      breakeven++;
    }
  }

  const closed = wins + losses + breakeven;
  const winRate = closed > 0 ? (wins / closed) * 100 : null;

  return {
    winRate,
    wins,
    losses,
    breakeven,
    open,
    closed,
    total: trades.length,
  };
}

/**
 * Calculates Profit Factor = grossProfit / absoluteGrossLoss.
 * Handles edge cases (zero loss, zero profit).
 */
export function calculateProfitFactor(trades: Trade[]): ProfitFactorResult {
  let grossProfit = 0;
  let grossLoss = 0;

  for (const t of trades) {
    if (t.status === 'OPEN' || t.netPnL === null || t.netPnL === undefined) {
      continue;
    }

    if (t.netPnL > 0) {
      grossProfit = safeAdd(grossProfit, t.netPnL);
    } else if (t.netPnL < 0) {
      grossLoss = safeAdd(grossLoss, Math.abs(t.netPnL));
    }
  }

  if (grossLoss === 0) {
    if (grossProfit > 0) {
      return { profitFactor: Infinity, grossProfit, grossLoss };
    }
    return { profitFactor: null, grossProfit: 0, grossLoss: 0 };
  }

  const profitFactor = safeDivide(grossProfit, grossLoss);
  return {
    profitFactor,
    grossProfit,
    grossLoss,
  };
}

/**
 * Calculates Expectancy in R and in Currency.
 * Strictly uses complete closed trades where isTradeRRComplete is true.
 * Formula: Espérance (R) = (WinrateR * AvgR_wins) - (LossrateR * |AvgR_losses|)
 */
export function calculateExpectancy(trades: Trade[]): ExpectancyResult {
  let sumMoney = 0;
  let closedTradesCount = 0;

  let completeRTradesCount = 0;
  let rWinsCount = 0;
  let rLossesCount = 0;
  let sumRWins = 0;
  let sumRLossesAbs = 0;
  let sumR = 0;

  for (const t of trades) {
    if (t.status === 'OPEN') continue;

    closedTradesCount++;

    if (t.netPnL !== null && t.netPnL !== undefined && !isNaN(t.netPnL)) {
      sumMoney = safeAdd(sumMoney, t.netPnL);
    }

    // Check if this closed trade has complete RR
    const isComplete = isTradeRRComplete(t);
    if (isComplete && t.rMultiple !== null && t.rMultiple !== undefined && !isNaN(t.rMultiple)) {
      completeRTradesCount++;
      sumR = safeAdd(sumR, t.rMultiple);

      if (t.rMultiple > EPSILON) {
        rWinsCount++;
        sumRWins = safeAdd(sumRWins, t.rMultiple);
      } else if (t.rMultiple < -EPSILON) {
        rLossesCount++;
        sumRLossesAbs = safeAdd(sumRLossesAbs, Math.abs(t.rMultiple));
      }
    }
  }

  let rExpectancy: number | null = null;
  if (completeRTradesCount > 0) {
    const winrateR = rWinsCount / completeRTradesCount;
    const lossrateR = rLossesCount / completeRTradesCount;
    const avgRWin = rWinsCount > 0 ? sumRWins / rWinsCount : 0;
    const avgRLossAbs = rLossesCount > 0 ? sumRLossesAbs / rLossesCount : 0;

    // Mathematical identity: (winrateR * avgRWin) - (lossrateR * avgRLossAbs) === sumR / completeRTradesCount
    rExpectancy = safeDivide(sumR, completeRTradesCount);
  }

  const moneyExpectancy = closedTradesCount > 0 ? safeDivide(sumMoney, closedTradesCount) : null;
  const incompleteTradesCount = Math.max(0, closedTradesCount - completeRTradesCount);

  return {
    rExpectancy,
    moneyExpectancy,
    validRTradesCount: completeRTradesCount,
    totalClosedTradesCount: closedTradesCount,
    incompleteTradesCount,
  };
}
