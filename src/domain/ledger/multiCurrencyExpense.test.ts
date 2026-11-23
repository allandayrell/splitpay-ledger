import { describe, expect, it } from 'vitest';
import {
  formatOriginalCurrencyBadge,
  normalizeExpenseCurrencyAmount,
} from './multiCurrencyExpense';
import { calculateWeightedSharesSplit } from '../split/exactAndSharesSplit';
import { DomainValidationError } from '../errors';
import type { Participant } from '../types';

const participants: Participant[] = [
  { id: 'p_alice', name: 'Alice', defaultWeight: 1 },
  { id: 'p_bruno', name: 'Bruno', defaultWeight: 1 },
  { id: 'p_carla', name: 'Carla', defaultWeight: 1 },
];

describe('Multi-Currency Expense Domain Support', () => {
  it('keeps domestic BRL expense amount unchanged without exchange rate metadata', () => {
    const normalized = normalizeExpenseCurrencyAmount({
      amountCents: 15000,
      currency: 'BRL',
    });

    expect(normalized).toEqual({
      amountCents: 15000,
      currency: 'BRL',
    });
  });

  it('converts foreign currency expense to base BRL cents and integrates cleanly with penny split', () => {
    const normalized = normalizeExpenseCurrencyAmount({
      amountCents: 10000,
      currency: 'USD',
      exchangeRate: 5.5,
    });

    expect(normalized).toEqual({
      amountCents: 55000,
      originalAmountCents: 10000,
      currency: 'USD',
      exchangeRate: 5.5,
    });

    const splits = calculateWeightedSharesSplit(normalized.amountCents, participants, [
      { participantId: 'p_alice', value: 1 },
      { participantId: 'p_bruno', value: 1 },
      { participantId: 'p_carla', value: 1 },
    ]);

    expect(splits).toEqual([
      { participantId: 'p_alice', amountCents: 18334 },
      { participantId: 'p_bruno', amountCents: 18333 },
      { participantId: 'p_carla', amountCents: 18333 },
    ]);

    expect(formatOriginalCurrencyBadge(10000, 'USD', 5.5)).toBe('US$ 100,00 (câmbio 5,50)');
    expect(formatOriginalCurrencyBadge(2550, 'EUR')).toBe('€ 25,50');
  });

  it('rejects foreign currency expense when exchange rate is missing or amount is non-positive', () => {
    expect(() =>
      normalizeExpenseCurrencyAmount({
        amountCents: 5000,
        currency: 'EUR',
      }),
    ).toThrow(DomainValidationError);

    expect(() =>
      normalizeExpenseCurrencyAmount({
        amountCents: 0,
        currency: 'BRL',
      }),
    ).toThrow(DomainValidationError);
  });
});
