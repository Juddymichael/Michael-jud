import { TradeDirection } from '../../types/trade';

export interface RiskRewardResult {
  plannedRR: number | null; // Take profit based
  realizedRR: number | null; // Exit price based
  riskDistance: number | null;
  rewardDistance: number | null;
  isValidRisk: boolean;
  warning?: string | null;
}

/**
 * Calculates planned and realized Risk/Reward ratios.
 *
 * Rules:
 * Long (BUY):
 *   RR visé = (Take Profit - Entry Price) / (Entry Price - Stop Loss)
 *   RR réalisé = (Exit Price - Entry Price) / (Entry Price - Stop Loss)
 *
 * Short (SELL):
 *   RR visé = (Entry Price - Take Profit) / (Stop Loss - Entry Price)
 *   RR réalisé = (Entry Price - Exit Price) / (Stop Loss - Entry Price)
 */
export function calculateRiskReward(params: {
  direction: TradeDirection;
  entryPrice: number | null | undefined;
  stopLoss: number | null | undefined;
  takeProfit: number | null | undefined;
  exitPrice?: number | null | undefined;
}): RiskRewardResult {
  const { direction, entryPrice, stopLoss, takeProfit, exitPrice } = params;

  if (
    entryPrice === null ||
    entryPrice === undefined ||
    isNaN(entryPrice) ||
    entryPrice <= 0 ||
    stopLoss === null ||
    stopLoss === undefined ||
    isNaN(stopLoss) ||
    stopLoss <= 0
  ) {
    return {
      plannedRR: null,
      realizedRR: null,
      riskDistance: null,
      rewardDistance: null,
      isValidRisk: true,
      warning: null,
    };
  }

  // Risk Distance
  const riskDistance =
    direction === 'BUY'
      ? entryPrice - stopLoss
      : stopLoss - entryPrice;

  // Validation: SMC / ICT rules for Stop Loss position
  if (riskDistance <= 0) {
    return {
      plannedRR: null,
      realizedRR: null,
      riskDistance: null,
      rewardDistance: null,
      isValidRisk: false,
      warning:
        direction === 'BUY'
          ? 'En position acheteuse (BUY), le stopLoss doit être inférieur à entryPrice.'
          : 'En position vendeuse (SELL), le stopLoss doit être supérieur à entryPrice.',
    };
  }

  // Planned RR (RR visé)
  let plannedRR: number | null = null;
  let rewardDistance: number | null = null;
  if (
    takeProfit !== null &&
    takeProfit !== undefined &&
    !isNaN(takeProfit) &&
    takeProfit > 0
  ) {
    rewardDistance =
      direction === 'BUY'
        ? takeProfit - entryPrice
        : entryPrice - takeProfit;

    if (rewardDistance <= 0) {
      return {
        plannedRR: null,
        realizedRR: null,
        riskDistance: Math.round(riskDistance * 100000) / 100000,
        rewardDistance: null,
        isValidRisk: false,
        warning:
          direction === 'BUY'
            ? 'En position acheteuse (BUY), le stopLoss doit être inférieur à entryPrice, qui doit être inférieur à takeProfit.'
            : 'En position vendeuse (SELL), le stopLoss doit être supérieur à entryPrice, qui doit être supérieur à takeProfit.',
      };
    }

    const rawPlanned = rewardDistance / riskDistance;
    plannedRR = Math.round(rawPlanned * 100) / 100;
  }

  // Realized RR (RR réalisé)
  let realizedRR: number | null = null;
  if (
    exitPrice !== null &&
    exitPrice !== undefined &&
    !isNaN(exitPrice) &&
    exitPrice > 0
  ) {
    const exitDistance =
      direction === 'BUY'
        ? exitPrice - entryPrice
        : entryPrice - exitPrice;

    const rawRealized = exitDistance / riskDistance;
    realizedRR = Math.round(rawRealized * 100) / 100;
  }

  return {
    plannedRR,
    realizedRR,
    riskDistance: Math.round(riskDistance * 100000) / 100000,
    rewardDistance: rewardDistance !== null ? Math.round(rewardDistance * 100000) / 100000 : null,
    isValidRisk: true,
    warning: null,
  };
}

/**
 * Determines whether a trade has complete and consistent Risk/Reward data.
 * Rules:
 * - If status === 'OPEN': complete if entryPrice, stopLoss, and takeProfit are valid positive numbers.
 * - If status === 'CLOSED': complete only if entryPrice, stopLoss, and exitPrice are valid positive numbers.
 */
export function isTradeRRComplete(trade: {
  status?: string | null;
  entryPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  exitPrice?: number | null;
  isRRComplete?: boolean | null;
}): boolean {
  if (trade.isRRComplete !== undefined && trade.isRRComplete !== null) {
    return trade.isRRComplete;
  }

  const hasEntry = typeof trade.entryPrice === 'number' && !isNaN(trade.entryPrice) && trade.entryPrice > 0;
  const hasSL = typeof trade.stopLoss === 'number' && !isNaN(trade.stopLoss) && trade.stopLoss > 0;

  if (trade.status === 'OPEN') {
    const hasTP = typeof trade.takeProfit === 'number' && !isNaN(trade.takeProfit) && trade.takeProfit > 0;
    return hasEntry && hasSL && hasTP;
  }

  // CLOSED trade
  const hasExit = typeof trade.exitPrice === 'number' && !isNaN(trade.exitPrice) && trade.exitPrice > 0;
  return hasEntry && hasSL && hasExit;
}

