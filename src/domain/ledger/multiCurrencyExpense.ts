import { DomainValidationError } from '../errors';
import { assertValidIntegerCents, convertCurrencyToBRL } from '../money/money';
import type { Cents, CurrencyCode } from '../types';

export interface MultiCurrencyAmountInput {
  amountCents: Cents;
  currency?: CurrencyCode;
  exchangeRate?: number;
}

export interface NormalizedExpenseAmount {
  amountCents: Cents;
  originalAmountCents?: Cents;
  currency: CurrencyCode;
  exchangeRate?: number;
}

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  BRL: 'R$',
  USD: 'US$',
  EUR: '€',
  GBP: '£',
};

export function normalizeExpenseCurrencyAmount(
  input: MultiCurrencyAmountInput,
): NormalizedExpenseAmount {
  assertValidIntegerCents(input.amountCents, 'amountCents');
  if (input.amountCents <= 0) {
    throw new DomainValidationError(
      'INVALID_EXPENSE_TOTAL',
      'Expense amount in cents must be greater than zero.',
    );
  }

  const currency = input.currency ?? 'BRL';

  if (currency === 'BRL') {
    return {
      amountCents: input.amountCents,
      currency: 'BRL',
    };
  }

  if (input.exchangeRate === undefined) {
    throw new DomainValidationError(
      'MISSING_EXCHANGE_RATE',
      `Exchange rate is required when currency is ${currency}.`,
    );
  }

  const convertedBRLCents = convertCurrencyToBRL(input.amountCents, input.exchangeRate);

  return {
    amountCents: convertedBRLCents,
    originalAmountCents: input.amountCents,
    currency,
    exchangeRate: input.exchangeRate,
  };
}

export function formatOriginalCurrencyBadge(
  originalAmountCents: Cents,
  currency: CurrencyCode,
  exchangeRate?: number,
): string {
  assertValidIntegerCents(originalAmountCents, 'originalAmountCents');
  const symbol = CURRENCY_SYMBOLS[currency];
  const major = Math.floor(Math.abs(originalAmountCents) / 100);
  const minor = (Math.abs(originalAmountCents) % 100).toString().padStart(2, '0');
  const rateSuffix =
    exchangeRate !== undefined ? ` (câmbio ${exchangeRate.toFixed(2).replace('.', ',')})` : '';

  return `${symbol} ${major},${minor}${rateSuffix}`;
}
