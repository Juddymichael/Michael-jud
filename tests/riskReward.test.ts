import { describe, it, expect } from 'vitest';
import { calculateRiskReward } from '../src/lib/calculations/riskReward';

describe('calculateRiskReward', () => {
  it('calculates planned RR accurately for Long (BUY)', () => {
    const res = calculateRiskReward({
      direction: 'BUY',
      entryPrice: 2420,
      stopLoss: 2412,
      takeProfit: 2440,
    });

    expect(res.isValidRisk).toBe(true);
    expect(res.riskDistance).toBe(8);
    expect(res.rewardDistance).toBe(20);
    expect(res.plannedRR).toBe(2.5); // 20 / 8 = 2.5
    expect(res.realizedRR).toBeNull();
  });

  it('calculates realized RR accurately for Long (BUY)', () => {
    const res = calculateRiskReward({
      direction: 'BUY',
      entryPrice: 2420,
      stopLoss: 2412,
      takeProfit: 2440,
      exitPrice: 2438,
    });

    expect(res.isValidRisk).toBe(true);
    expect(res.plannedRR).toBe(2.5);
    expect(res.realizedRR).toBe(2.25); // (2438 - 2420) / 8 = 18 / 8 = 2.25
  });

  it('calculates planned and realized RR accurately for Short (SELL)', () => {
    const res = calculateRiskReward({
      direction: 'SELL',
      entryPrice: 2420,
      stopLoss: 2428,
      takeProfit: 2400,
      exitPrice: 2404,
    });

    expect(res.isValidRisk).toBe(true);
    expect(res.riskDistance).toBe(8); // 2428 - 2420 = 8
    expect(res.rewardDistance).toBe(20); // 2420 - 2400 = 20
    expect(res.plannedRR).toBe(2.5); // 20 / 8 = 2.5
    expect(res.realizedRR).toBe(2); // (2420 - 2404) / 8 = 16 / 8 = 2
  });

  it('detects invalid Stop Loss for Long (BUY) when SL >= Entry', () => {
    const res = calculateRiskReward({
      direction: 'BUY',
      entryPrice: 2420,
      stopLoss: 2425,
      takeProfit: 2440,
    });

    expect(res.isValidRisk).toBe(false);
    expect(res.plannedRR).toBeNull();
    expect(res.warning).toContain('Stop Loss doit être inférieur');
  });

  it('detects invalid Stop Loss for Short (SELL) when SL <= Entry', () => {
    const res = calculateRiskReward({
      direction: 'SELL',
      entryPrice: 2420,
      stopLoss: 2415,
      takeProfit: 2400,
    });

    expect(res.isValidRisk).toBe(false);
    expect(res.plannedRR).toBeNull();
    expect(res.warning).toContain('Stop Loss doit être supérieur');
  });

  it('handles null and undefined prices gracefully without throwing', () => {
    const res = calculateRiskReward({
      direction: 'BUY',
      entryPrice: null,
      stopLoss: null,
      takeProfit: null,
    });

    expect(res.isValidRisk).toBe(true);
    expect(res.plannedRR).toBeNull();
    expect(res.realizedRR).toBeNull();
  });
});
