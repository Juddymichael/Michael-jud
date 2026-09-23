/**
 * Standardized Financial Formatting Engine for Thunder Edge
 * Provides crisp, institutional-grade number formatting with tabular alignment and clear +/- signs.
 */

export interface FormatOptions {
  currency?: string;
  showSign?: boolean;
  decimals?: number;
  fallback?: string;
}

/**
 * Formats a currency amount into standard European / International notation:
 * Examples:
 *  +1439.96 -> "+€1,439.96" (or "+$1,439.96")
 *  -421.50  -> "-€421.50"
 *  0        -> "€0.00"
 *  null     -> "Not recorded" or custom fallback
 */
export function formatCurrency(
  value: number | null | undefined,
  currency = 'EUR',
  options: { showSign?: boolean; fallback?: string; decimals?: number } = {}
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return options.fallback ?? '—';
  }

  const decimals = options.decimals ?? 2;
  const showSign = options.showSign ?? true;
  const symbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€';

  const absVal = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  if (Math.abs(value) < 0.000001) {
    return `${symbol}0.00`;
  }

  if (value > 0) {
    return showSign ? `+${symbol}${absVal}` : `${symbol}${absVal}`;
  }

  return `-${symbol}${absVal}`;
}

/**
 * Formats R-Multiple with sign and unit:
 * Examples:
 *  +2.43 -> "+2.43R"
 *  -1.00 -> "-1.00R"
 *  0     -> "0.00R"
 *  null  -> "—"
 */
export function formatRMultiple(
  value: number | null | undefined,
  options: { showSign?: boolean; fallback?: string } = {}
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return options.fallback ?? '—';
  }

  const showSign = options.showSign ?? true;
  const absVal = Math.abs(value).toFixed(2);

  if (Math.abs(value) < 0.000001) {
    return '0.00R';
  }

  if (value > 0) {
    return showSign ? `+${absVal}R` : `${absVal}R`;
  }

  return `-${absVal}R`;
}

/**
 * Formats percentages with clean decimal precision:
 * Examples:
 *  68.4  -> "68.4%"
 *  null  -> "—"
 */
export function formatPercent(
  value: number | null | undefined,
  decimals = 1,
  fallback = '—'
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return fallback;
  }
  return `${value.toFixed(decimals)}%`;
}

/**
 * Formats generic numerical metrics (Profit Factor, Win/Loss Ratio, Expectancy):
 * Examples:
 *  1.82 -> "1.82"
 *  null -> "—"
 */
export function formatDecimal(
  value: number | null | undefined,
  decimals = 2,
  fallback = '—'
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return fallback;
  }
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Formats Killzones into human-readable, institutional-grade titles.
 * Converts raw SNAKE_CASE codes (e.g. 'LONDON_OPEN', 'HORS_KILLZONE') to clean labels.
 */
export function formatKillzone(
  raw: string | null | undefined,
  fallback: string = 'Hors Killzone'
): string {
  if (!raw || typeof raw !== 'string') return fallback;
  const upper = raw.trim().toUpperCase();
  if (upper === 'LONDON_OPEN' || upper === 'LONDON' || upper === 'LONDON KILLZONE') return 'London Killzone';
  if (
    upper === 'NY' ||
    upper === 'NEW_YORK' ||
    upper === 'NEW YORK' ||
    upper === 'NY_AM' ||
    upper === 'NEW_YORK_AM' ||
    upper === 'NY_PM' ||
    upper === 'NEW_YORK_PM' ||
    upper === 'NEW YORK KILLZONE'
  ) {
    return 'New York Killzone';
  }
  if (upper === 'LONDON_CLOSE' || upper === 'LONDON CLOSE' || upper === 'LONDON CLOSE KILLZONE') return 'London Close Killzone';
  if (upper === 'ASIA' || upper === 'TOKYO' || upper === 'ASIAN KILLZONE') return 'Asian Killzone';
  if (upper === 'SYDNEY') return 'Sydney';
  if (
    upper === 'OFF_HOURS' ||
    upper === 'HORS_KILLZONE' ||
    upper === 'HORS KILLZONE' ||
    upper === 'HORS_SESSION' ||
    upper === 'HORS SESSION' ||
    upper === 'NONE' ||
    upper === 'NIL'
  ) {
    return fallback;
  }
  // Replace underscores and format title case
  return raw
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
}

/**
 * Formats trade status into human-friendly French terms.
 */
export function formatTradeStatus(
  status: string | null | undefined,
  fallback: string = '—'
): string {
  if (!status) return fallback;
  const upper = status.trim().toUpperCase();
  if (upper === 'CLOSED') return 'Clôturé';
  if (upper === 'OPEN') return 'En cours';
  if (upper === 'PENDING') return 'En attente';
  if (upper === 'CANCELLED') return 'Annulé';
  return status;
}

/**
 * Formats Market Structure / IRL-ERL framework values.
 */
export function formatIrlErl(
  raw: string | null | undefined,
  fallback: string = '—'
): string {
  if (!raw) return fallback;
  const upper = raw.trim().toUpperCase();
  if (upper === 'IRL_TO_ERL') return 'IRL vers ERL (Interne → Externe)';
  if (upper === 'ERL_TO_IRL') return 'ERL vers IRL (Externe → Interne)';
  if (upper === 'CONSOLIDATION') return 'Consolidation';
  return raw;
}

/**
 * Formats HTF Bias values.
 */
export function formatHtfBias(
  raw: string | null | undefined,
  fallback: string = '—'
): string {
  if (!raw) return fallback;
  const upper = raw.trim().toUpperCase();
  if (upper === 'BULLISH') return 'Haussier (Bullish)';
  if (upper === 'BEARISH') return 'Baissier (Bearish)';
  if (upper === 'NEUTRAL') return 'Neutre';
  return raw;
}

/**
 * General formatter for technical fields or booleans.
 */
export function formatTechnicalValue(
  val: unknown,
  fallback: string = '—'
): string {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'boolean') return val ? 'Validé' : 'Non';
  if (typeof val === 'string') {
    const upper = val.trim().toUpperCase();
    if (upper === 'IRL_TO_ERL') return 'IRL vers ERL';
    if (upper === 'ERL_TO_IRL') return 'ERL vers IRL';
    if (upper === 'CONSOLIDATION') return 'Consolidation';
    if (upper === 'LONDON_OPEN' || upper === 'LONDON') return 'London Killzone';
    if (upper === 'NY' || upper === 'NEW_YORK' || upper === 'NY_AM' || upper === 'NY_PM') return 'New York Killzone';
    if (upper === 'LONDON_CLOSE') return 'London Close Killzone';
    if (upper === 'ASIA' || upper === 'TOKYO') return 'Asian Killzone';
    if (upper === 'OFF_HOURS' || upper === 'HORS_KILLZONE') return 'Hors Killzone';
    if (upper === 'BULLISH') return 'Haussier';
    if (upper === 'BEARISH') return 'Baissier';
    if (upper === 'NEUTRAL') return 'Neutre';
    if (upper === 'CLOSED') return 'Clôturé';
    if (upper === 'OPEN') return 'En cours';
    if (upper === 'BUY') return 'Achat (Long)';
    if (upper === 'SELL') return 'Vente (Short)';
    return val.replace(/_/g, ' ');
  }
  return String(val);
}
