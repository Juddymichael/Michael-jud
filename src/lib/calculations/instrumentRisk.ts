import { normalizeSymbol } from '../normalization/normalizeSymbol';
import { safeRound } from './precision';

export interface InstrumentRiskResult {
  riskAmount: number | null;
  multiplier: number;
  pipOrPointSize: number;
  instrumentType: 'METAL' | 'FOREX' | 'INDEX' | 'CRYPTO' | 'COMMODITY' | 'OTHER';
  specLabel: string;
}

/**
 * Calculates Initial Risk ($) in real-time according to institutional standards:
 * Risque Initial ($) = |Prix d'entrée - Stop Loss| × taille de position × valeur du point/pip
 *
 * Handles Gold (XAUUSD), Silver (XAGUSD), Forex (EURUSD, USDJPY...), Indices (US30, NAS100...),
 * Crypto (BTCUSD...), and Commodities (USOIL...).
 */
export function calculateInstrumentRisk(params: {
  symbolRaw: string;
  entryPrice: number | null | undefined;
  stopLoss: number | null | undefined;
  quantity: number | null | undefined;
}): InstrumentRiskResult {
  const { symbolRaw, entryPrice, stopLoss, quantity } = params;

  const symbol = normalizeSymbol(symbolRaw).toUpperCase();
  const validEntry = entryPrice !== null && entryPrice !== undefined && entryPrice > 0;
  const validSL = stopLoss !== null && stopLoss !== undefined && stopLoss > 0;
  const validQty = quantity !== null && quantity !== undefined && quantity > 0;

  // 1. Determine instrument specifications
  let multiplier = 100000;
  let pipOrPointSize = 0.0001;
  let instrumentType: InstrumentRiskResult['instrumentType'] = 'FOREX';
  let specLabel = 'Forex standard (1 lot = 100 000 unités)';

  if (symbol.includes('XAU') || symbol.includes('GOLD')) {
    multiplier = 100;
    pipOrPointSize = 0.01;
    instrumentType = 'METAL';
    specLabel = 'Or / XAUUSD (1 lot = 100 oz)';
  } else if (symbol.includes('XAG') || symbol.includes('SILVER')) {
    multiplier = 5000;
    pipOrPointSize = 0.001;
    instrumentType = 'METAL';
    specLabel = 'Argent / XAGUSD (1 lot = 5 000 oz)';
  } else if (
    symbol.includes('US30') ||
    symbol.includes('DJIA') ||
    symbol.includes('DOW') ||
    symbol.includes('WS30')
  ) {
    multiplier = 1;
    pipOrPointSize = 1.0;
    instrumentType = 'INDEX';
    specLabel = 'Dow Jones / US30 (1 lot = 1 point = 1 $)';
  } else if (
    symbol.includes('NAS') ||
    symbol.includes('US100') ||
    symbol.includes('NDX') ||
    symbol.includes('USTEC')
  ) {
    multiplier = 1;
    pipOrPointSize = 1.0;
    instrumentType = 'INDEX';
    specLabel = 'Nasdaq / NAS100 (1 lot = 1 point = 1 $)';
  } else if (
    symbol.includes('SPX') ||
    symbol.includes('US500') ||
    symbol.includes('SP500')
  ) {
    multiplier = 1;
    pipOrPointSize = 1.0;
    instrumentType = 'INDEX';
    specLabel = 'S&P 500 / SPX500 (1 lot = 1 point = 1 $)';
  } else if (
    symbol.includes('GER') ||
    symbol.includes('DAX') ||
    symbol.includes('DE40') ||
    symbol.includes('DE30')
  ) {
    multiplier = 1;
    pipOrPointSize = 1.0;
    instrumentType = 'INDEX';
    specLabel = 'DAX 40 / GER40 (1 lot = 1 point)';
  } else if (
    symbol.includes('BTC') ||
    symbol.includes('ETH') ||
    symbol.includes('SOL')
  ) {
    multiplier = 1;
    pipOrPointSize = 1.0;
    instrumentType = 'CRYPTO';
    specLabel = 'Crypto (1 lot = 1 unité)';
  } else if (
    symbol.includes('USOIL') ||
    symbol.includes('UKOIL') ||
    symbol.includes('BRENT') ||
    symbol.includes('WTI') ||
    symbol.includes('CL')
  ) {
    multiplier = 100;
    pipOrPointSize = 0.01;
    instrumentType = 'COMMODITY';
    specLabel = 'Pétrole / Oil (1 lot = 100 barils)';
  } else if (symbol.includes('JPY')) {
    pipOrPointSize = 0.01;
    instrumentType = 'FOREX';
    specLabel = 'Forex JPY (1 lot = 100 000 unités • 1 pip = 0.01)';
  }

  if (!validEntry || !validSL || !validQty) {
    return {
      riskAmount: null,
      multiplier,
      pipOrPointSize,
      instrumentType,
      specLabel,
    };
  }

  const priceDiff = Math.abs(entryPrice - stopLoss);
  if (priceDiff === 0) {
    return {
      riskAmount: 0,
      multiplier,
      pipOrPointSize,
      instrumentType,
      specLabel,
    };
  }

  let calculatedRisk: number;

  if (instrumentType === 'METAL' || instrumentType === 'INDEX' || instrumentType === 'CRYPTO' || instrumentType === 'COMMODITY') {
    // Direct point multiplier: |Entry - SL| × Quantity × Multiplier
    calculatedRisk = priceDiff * quantity * multiplier;
  } else if (symbol.includes('JPY') && (symbol.startsWith('USD') || symbol === 'USDJPY')) {
    // USD base, JPY quote: (|Entry - SL| / Entry) × Quantity × 100,000
    calculatedRisk = (priceDiff / entryPrice) * quantity * 100000;
  } else if (symbol.endsWith('JPY')) {
    // Cross pair JPY (EURJPY, GBPJPY): convert quote JPY to USD approx (at ~150 JPY/USD)
    calculatedRisk = (priceDiff * quantity * 100000) / (entryPrice > 50 ? entryPrice : 150);
  } else if (symbol.startsWith('USD') && (symbol.endsWith('CAD') || symbol.endsWith('CHF'))) {
    // USD base, non-USD quote: (|Entry - SL| / Entry) × Quantity × 100,000
    calculatedRisk = (priceDiff / entryPrice) * quantity * 100000;
  } else {
    // Standard USD quote Forex (EURUSD, GBPUSD, AUDUSD, NZDUSD) or direct 100,000
    calculatedRisk = priceDiff * quantity * 100000;
  }

  const finalRisk = safeRound(calculatedRisk, 2);

  return {
    riskAmount: finalRisk > 0 && isFinite(finalRisk) ? finalRisk : null,
    multiplier,
    pipOrPointSize,
    instrumentType,
    specLabel,
  };
}
