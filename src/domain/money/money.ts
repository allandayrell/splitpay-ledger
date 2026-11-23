import { DomainValidationError } from '../errors';
import type { Cents } from '../types';

export function assertValidIntegerCents(cents: Cents, label = 'amountCents'): void {
  if (typeof cents !== 'number' || !Number.isFinite(cents) || !Number.isInteger(cents)) {
    throw new DomainValidationError(
      'INVALID_MONETARY_CENTS',
      `${label} must be a finite integer representing cents.`,
    );
  }
}

export function toCents(amount: number | string): Cents {
  if (typeof amount === 'string') {
    const trimmed = amount.trim().replace(',', '.');
    if (trimmed.length === 0) {
      throw new DomainValidationError('INVALID_MONETARY_AMOUNT', 'Monetary amount cannot be empty.');
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      throw new DomainValidationError('INVALID_MONETARY_AMOUNT', 'Monetary amount must be a valid number.');
    }
    return Math.round(parsed * 100);
  }

  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new DomainValidationError('INVALID_MONETARY_AMOUNT', 'Monetary amount must be a finite number.');
  }

  return Math.round(amount * 100);
}

export function formatBRL(cents: Cents): string {
  assertValidIntegerCents(cents);
  const isNegative = cents < 0;
  const absCents = Math.abs(cents);
  const reais = Math.floor(absCents / 100);
  const centavos = absCents % 100;

  const formattedReais = reais.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const formattedCentavos = centavos.toString().padStart(2, '0');
  const prefix = isNegative ? '-R$ ' : 'R$ ';

  return `${prefix}${formattedReais},${formattedCentavos}`;
}

export function convertCurrencyToBRL(originalAmountCents: Cents, exchangeRate: number): Cents {
  assertValidIntegerCents(originalAmountCents, 'originalAmountCents');
  if (originalAmountCents <= 0) {
    throw new DomainValidationError(
      'INVALID_ORIGINAL_AMOUNT',
      'Original currency amount must be greater than zero.',
    );
  }
  if (typeof exchangeRate !== 'number' || !Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    throw new DomainValidationError(
      'INVALID_EXCHANGE_RATE',
      'Exchange rate must be a finite positive number.',
    );
  }

  return Math.round(originalAmountCents * exchangeRate);
}
