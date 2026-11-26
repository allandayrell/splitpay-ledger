import { DomainValidationError } from '../errors';
import type { Cents, CurrencyCode } from '../types';

const currencyCodes = new Set<unknown>(['BRL', 'USD', 'EUR', 'GBP']);
const decimalPattern = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return currencyCodes.has(value);
}

export function assertValidIntegerCents(cents: Cents, label = 'amountCents'): void {
  if (!Number.isSafeInteger(cents)) {
    throw new DomainValidationError(
      'INVALID_MONETARY_CENTS',
      `${label} must be a safe integer representing cents.`,
    );
  }
}

function decimalParts(value: string) {
  const [significand, exponent = '0'] = value.toLowerCase().split('e');
  const [whole, fraction = ''] = significand!.split('.');
  return {
    digits: BigInt(`${whole}${fraction}`),
    power: Number(exponent) - fraction.length,
  };
}

function roundScaledDecimal(value: string, minorUnits: number, multiplier: bigint, negative = false): Cents {
  const { digits, power } = decimalParts(value);
  const scaledPower = power + minorUnits;
  let rounded = digits * multiplier;
  if (scaledPower >= 0) {
    rounded *= 10n ** BigInt(scaledPower);
  } else {
    const divisor = 10n ** BigInt(-scaledPower);
    const twiceRemainder = (rounded % divisor) * 2n;
    rounded /= divisor;
    if (twiceRemainder > divisor || (twiceRemainder === divisor && !negative)) rounded += 1n;
  }
  const cents = negative ? -Number(rounded) : Number(rounded);
  assertValidIntegerCents(cents);
  return cents;
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
    if (parsed === 0) return parsed;
    const unsigned = trimmed.replace(/^[+-]/, '');
    const decimal = decimalPattern.test(unsigned) ? unsigned : String(Math.abs(parsed));
    return roundScaledDecimal(decimal, 2, 1n, parsed < 0);
  }

  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new DomainValidationError('INVALID_MONETARY_AMOUNT', 'Monetary amount must be a finite number.');
  }

  if (amount === 0) return amount;
  return roundScaledDecimal(String(Math.abs(amount)), 2, 1n, amount < 0);
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

export function formatCurrency(cents: Cents, currency: CurrencyCode): string {
  if (currency === 'BRL') return formatBRL(cents);
  assertValidIntegerCents(cents);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(cents / 100);
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

  return roundScaledDecimal(String(exchangeRate), 0, BigInt(originalAmountCents));
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

  const decimals = weights.map((weight) => {
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) {
      throw new DomainValidationError('INVALID_WEIGHT_VALUE', 'Each weight must be a non-negative finite number.');
    }
    return decimalParts(String(weight));
  });
  const commonPower = decimals.reduce((lowest, entry) => Math.min(lowest, entry.power), 0);
  const scaledWeights = decimals.map(({ digits, power }) => digits * 10n ** BigInt(power - commonPower));
  const totalWeight = scaledWeights.reduce((sum, weight) => sum + weight, 0n);

  if (totalWeight === 0n) {
    throw new DomainValidationError('INVALID_TOTAL_WEIGHT', 'Sum of weights must be greater than zero.');
  }

  const shares: Cents[] = [];
  let allocatedCents = 0;

  const total = BigInt(totalCents);
  for (const weight of scaledWeights) {
    const truncatedShare = Number((total * weight) / totalWeight);
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

