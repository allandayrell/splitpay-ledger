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

export function allocatePenniesEqual(totalCents: Cents, count: number): Cents[] {
  assertValidIntegerCents(totalCents, 'totalCents');
  if (totalCents <= 0) {
    throw new DomainValidationError('INVALID_TOTAL_AMOUNT', 'Total amount in cents must be greater than zero.');
  }
  if (!Number.isInteger(count) || count <= 0) {
    throw new DomainValidationError('INVALID_PARTICIPANT_COUNT', 'Participant count must be a positive integer.');
  }

  const baseShare = Math.floor(totalCents / count);
  const remainder = totalCents - baseShare * count;

  const shares: Cents[] = [];
  for (let index = 0; index < count; index += 1) {
    shares.push(index < remainder ? baseShare + 1 : baseShare);
  }

  return shares;
}

export function allocatePenniesWeighted(totalCents: Cents, weights: readonly number[]): Cents[] {
  assertValidIntegerCents(totalCents, 'totalCents');
  if (totalCents <= 0) {
    throw new DomainValidationError('INVALID_TOTAL_AMOUNT', 'Total amount in cents must be greater than zero.');
  }
  if (weights.length === 0) {
    throw new DomainValidationError('EMPTY_WEIGHTS', 'Weights array cannot be empty.');
  }

  let totalWeight = 0;
  for (const weight of weights) {
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) {
      throw new DomainValidationError('INVALID_WEIGHT_VALUE', 'Each weight must be a non-negative finite number.');
    }
    totalWeight += weight;
  }

  if (totalWeight <= 0) {
    throw new DomainValidationError('INVALID_TOTAL_WEIGHT', 'Sum of weights must be greater than zero.');
  }

  const shares: Cents[] = [];
  let allocatedCents = 0;

  for (const weight of weights) {
    const exactShare = (totalCents * weight) / totalWeight;
    const truncatedShare = Math.floor(exactShare);
    shares.push(truncatedShare);
    allocatedCents += truncatedShare;
  }

  let remainder = totalCents - allocatedCents;

  for (let index = 0; index < shares.length && remainder > 0; index += 1) {
    if ((weights[index] ?? 0) > 0) {
      shares[index] = (shares[index] ?? 0) + 1;
      remainder -= 1;
    }
  }

  return shares;
}

