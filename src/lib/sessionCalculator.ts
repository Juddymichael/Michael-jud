import { Trade } from '../types/trade';

export type ComputedKillzone =
  | 'Asian Killzone'
  | 'London Killzone'
  | 'New York Killzone'
  | 'London Close Killzone'
  | 'Hors Killzone'
  | string;
export type ComputedSession = ComputedKillzone;

export interface KillzoneDefinition {
  code: 'LONDON_OPEN' | 'NY' | 'NY_AM' | 'LONDON_CLOSE' | 'NY_PM' | 'ASIA' | 'OFF_HOURS';
  label: string;
  name: string;
  madagascarHours: string;
  nyHours: string;
}

export const MADAGASCAR_KILLZONES: KillzoneDefinition[] = [
  {
    code: 'LONDON_OPEN',
    label: 'London Killzone (09:00 - 12:00 Madagascar)',
    name: 'London Killzone',
    madagascarHours: '09:00 - 12:00',
    nyHours: '01:00 - 04:00 GMT-5',
  },
  {
    code: 'NY',
    label: 'New York Killzone (14:00 - 17:00 Madagascar)',
    name: 'New York Killzone',
    madagascarHours: '14:00 - 17:00',
    nyHours: '06:00 - 09:00 GMT-5',
  },
  {
    code: 'ASIA',
    label: 'Asian Killzone (04:00 - 08:00 Madagascar • 20:00 - 00:00 NY)',
    name: 'Asian Killzone',
    madagascarHours: '04:00 - 08:00',
    nyHours: '20:00 - 00:00 GMT-5',
  },
  {
    code: 'LONDON_CLOSE',
    label: 'London Close Killzone (18:00 - 20:00 Madagascar)',
    name: 'London Close Killzone',
    madagascarHours: '18:00 - 20:00',
    nyHours: '10:00 - 12:00 GMT-5',
  },
  {
    code: 'OFF_HOURS',
    label: 'Off Hours / Hors Killzone',
    name: 'Hors Killzone',
    madagascarHours: 'Hors horaires',
    nyHours: 'Hors horaires',
  },
];

/**
 * Derives the Killzone code and name directly from a date in Madagascar Time (UTC+3).
 * Custom Killzone settings:
 * - London Killzone: 09:00 à 12:00 Madagascar
 * - New York Killzone: 14:00 à 17:00 Madagascar (Killzone NY unique, pas de AM/PM)
 * - Asian Killzone: 04:00 à 08:00 Madagascar
 * - London Close Killzone: 18:00 à 20:00 Madagascar
 */
export function getKillzoneInfoFromDate(
  date: Date,
  userTimezone: string = 'Indian/Antananarivo'
): KillzoneDefinition {
  const offHours = MADAGASCAR_KILLZONES[MADAGASCAR_KILLZONES.length - 1];
  if (isNaN(date.getTime())) {
    return offHours;
  }

  let targetTz = userTimezone;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: targetTz });
  } catch {
    targetTz = 'Indian/Antananarivo';
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: targetTz,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  let hour = 0;
  let minute = 0;

  for (const part of parts) {
    if (part.type === 'hour') hour = parseInt(part.value, 10) % 24;
    if (part.type === 'minute') minute = parseInt(part.value, 10);
  }

  const totalMinutes = hour * 60 + minute;

  // 1. Asian Killzone : 04:00 - 08:00
  if (totalMinutes >= 4 * 60 && totalMinutes < 8 * 60) {
    return MADAGASCAR_KILLZONES[2]; // ASIA
  }

  // 2. London Killzone : 09:00 - 12:00 Madagascar
  if (totalMinutes >= 9 * 60 && totalMinutes < 12 * 60) {
    return MADAGASCAR_KILLZONES[0]; // LONDON_OPEN
  }

  // 3. New York Killzone : 14:00 - 17:00 Madagascar (juste Killzone NY, sans AM/PM)
  if (totalMinutes >= 14 * 60 && totalMinutes < 17 * 60) {
    return MADAGASCAR_KILLZONES[1]; // NY
  }

  // 4. London Close Killzone : 18:00 - 20:00 Madagascar
  if (totalMinutes >= 18 * 60 && totalMinutes < 20 * 60) {
    return MADAGASCAR_KILLZONES[3]; // LONDON_CLOSE
  }

  return offHours;
}

/**
 * Calculates or retrieves the trading Killzone for a trade (ICT / SMC methodology).
 * 
 * Rules Madagascar Time (GMT+3 / UTC+3):
 * - London Killzone : 09h00 à 12h00
 * - New York Killzone : 14h00 à 17h00 (Killzone NY globale unique)
 * - Asian Killzone : 04h00 à 08h00
 * - London Close Killzone : 18h00 à 20h00
 * - Hors Killzone : reste
 * 
 * Prioritizes trade.killzone then trade.session, and falls back to openedAt calculation.
 * UNKNOWN is never returned.
 */
export function getTradeKillzone(trade: Partial<Trade>, userTimezone: string = 'Indian/Antananarivo'): ComputedKillzone {
  // 1. Check if killzone is explicitly set
  if (trade.killzone && typeof trade.killzone === 'string' && trade.killzone.trim() !== '') {
    const rawKz = trade.killzone.trim().toUpperCase();
    if (rawKz === 'LONDON_OPEN' || rawKz === 'LONDON') return 'London Killzone';
    if (
      rawKz === 'NY' ||
      rawKz === 'NEW_YORK' ||
      rawKz === 'NY_AM' ||
      rawKz === 'NY_PM' ||
      rawKz === 'NEW_YORK_AM' ||
      rawKz === 'NEW_YORK_PM'
    ) {
      return 'New York Killzone';
    }
    if (rawKz === 'ASIA' || rawKz === 'TOKYO') return 'Asian Killzone';
    if (rawKz === 'LONDON_CLOSE') return 'London Close Killzone';
    if (rawKz === 'OFF_HOURS' || rawKz === 'HORS KILLZONE' || rawKz === 'HORS_SESSION') return 'Hors Killzone';
    return trade.killzone;
  }

  // 2. Check if manually specified via session
  if (trade.session && typeof trade.session === 'string' && trade.session.trim() !== '') {
    const raw = trade.session.trim().toUpperCase();
    if (raw !== 'UNKNOWN' && raw !== 'NULL' && raw !== 'UNDEFINED' && raw !== 'NON RENSEIGNÉ') {
      if (raw === 'LONDON' || raw === 'LONDRES' || raw === 'LONDON_OPEN') return 'London Killzone';
      if (
        raw === 'NEW_YORK' ||
        raw === 'NEW YORK' ||
        raw === 'NY' ||
        raw === 'NY_AM' ||
        raw === 'NY_PM' ||
        raw === 'NEW YORK AM' ||
        raw === 'NEW YORK PM' ||
        raw === 'NEW YORK AM KILLZONE' ||
        raw === 'NEW YORK PM KILLZONE'
      ) {
        return 'New York Killzone';
      }
      if (raw === 'TOKYO' || raw === 'ASIA' || raw === 'ASIE') return 'Asian Killzone';
      if (raw === 'LONDON_CLOSE' || raw === 'LONDON CLOSE') return 'London Close Killzone';
      if (raw === 'SYDNEY') return 'Sydney Killzone';
      if (raw === 'CUSTOM') return 'Custom Killzone';
      if (raw === 'OFF_HOURS' || raw === 'HORS_SESSION') return 'Hors Killzone';
      return trade.session.includes('Killzone') ? trade.session : `${trade.session} Killzone`;
    }
  }

  // 3. Compute from openedAt timestamp
  const dateStr = trade.openedAt || trade.closedAt;
  if (!dateStr) {
    return 'Hors Killzone';
  }

  try {
    const date = new Date(dateStr);
    const info = getKillzoneInfoFromDate(date, userTimezone);
    return info.name;
  } catch {
    return 'Hors Killzone';
  }
}

/**
 * Backward-compatible alias for getTradeKillzone
 */
export const getTradeSession = getTradeKillzone;

