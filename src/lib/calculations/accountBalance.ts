import { Trade } from '../../types/trade';
import { safeAdd } from './precision';

/**
 * Derives the most recent account balance from trade history:
 * 1. Takes all closed trades with valid dates and netPnL
 * 2. Sorts them chronologically (closedAt || openedAt)
 * 3. If the most recent trade has an explicit balanceAfter > 0, returns it.
 * 4. Otherwise, calculates defaultBalance + sum(netPnL).
 */
export function getLatestAccountBalance(
  trades: Trade[] = [],
  initialBalance: number = 10000
): number {
  if (!trades || trades.length === 0) {
    return initialBalance;
  }

  const closedTrades = trades
    .filter((t) => t.status !== 'OPEN')
    .sort((a, b) => {
      const timeA = new Date(a.closedAt || a.openedAt).getTime();
      const timeB = new Date(b.closedAt || b.openedAt).getTime();
      return timeA - timeB;
    });

  if (closedTrades.length === 0) {
    return initialBalance;
  }

  const latestTrade = closedTrades[closedTrades.length - 1];

  // If latest trade has an explicit non-zero balanceAfter recorded (e.g. from broker export)
  if (
    latestTrade.balanceAfter !== null &&
    latestTrade.balanceAfter !== undefined &&
    latestTrade.balanceAfter > 0
  ) {
    return latestTrade.balanceAfter;
  }

  // Otherwise, calculate cumulative Net PnL + initial balance
  let currentBalance = initialBalance;
  for (const trade of closedTrades) {
    if (trade.netPnL !== null && trade.netPnL !== undefined) {
      currentBalance = safeAdd(currentBalance, trade.netPnL);
    }
  }

  return currentBalance;
}

/**
 * Checks if historical trades ever had separate, non-zero commissions recorded.
 * Returns false if all trades have empty, null, or 0 commissions.
 */
export function hasHistoricalCommissions(trades: Trade[] = []): boolean {
  if (!trades || trades.length === 0) return false;
  return trades.some(
    (t) =>
      t.commission !== null &&
      t.commission !== undefined &&
      Math.abs(t.commission) > 0
  );
}
