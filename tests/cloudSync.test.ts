import { describe, it, expect } from 'vitest';
import { sanitizeForFirestore } from '../src/lib/firebase/syncService';

describe('CloudSyncService & Firestore Sanitization Tests', () => {
  it('1. Converts undefined fields to null in flat objects', () => {
    const input = {
      id: 'trade_123',
      symbol: 'EURUSD',
      notes: undefined,
      screenshotBefore: null,
      grossPnL: 250,
    };

    const sanitized = sanitizeForFirestore(input);

    expect(sanitized.id).toBe('trade_123');
    expect(sanitized.symbol).toBe('EURUSD');
    expect(sanitized.notes).toBeNull();
    expect(sanitized.screenshotBefore).toBeNull();
    expect(sanitized.grossPnL).toBe(250);
    expect(sanitized).not.toHaveProperty('notes', undefined);
  });

  it('2. Deeply sanitizes nested objects and arrays with undefined values', () => {
    const input = {
      id: 'setup_1',
      tags: ['SMC', undefined, 'FVG'],
      nested: {
        fieldA: 'value',
        fieldB: undefined,
        deep: {
          sub: undefined,
          valid: 42,
        },
      },
    };

    const sanitized = sanitizeForFirestore(input);

    expect(sanitized.tags[0]).toBe('SMC');
    expect(sanitized.tags[1]).toBeNull();
    expect(sanitized.tags[2]).toBe('FVG');
    expect(sanitized.nested.fieldA).toBe('value');
    expect(sanitized.nested.fieldB).toBeNull();
    expect(sanitized.nested.deep.sub).toBeNull();
    expect(sanitized.nested.deep.valid).toBe(42);
  });

  it('3. Preserves primitive values and null correctly', () => {
    expect(sanitizeForFirestore(null)).toBeNull();
    expect(sanitizeForFirestore(undefined)).toBeNull();
    expect(sanitizeForFirestore('EURUSD')).toBe('EURUSD');
    expect(sanitizeForFirestore(1234.56)).toBe(1234.56);
    expect(sanitizeForFirestore(true)).toBe(true);
  });
});
