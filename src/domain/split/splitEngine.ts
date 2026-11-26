import { DomainValidationError } from '../errors';
import { allocatePenniesEqual } from '../money/money';
import type { Cents, ExpenseSplit, Participant, SplitShareInput, SplitType } from '../types';
import {
  assertKnownParticipants,
  calculateExactSplit,
  calculateWeightedSharesSplit,
} from './exactAndSharesSplit';

const FULL_PERCENTAGE = 10_000;

export function percentageToBasisPoints(raw: string): number {
  const input = raw.trim();
  if (!/^\d{1,3}(?:[.,]\d{1,2})?$/.test(input)) {
    throw new DomainValidationError('INVALID_PERCENTAGE', 'Use porcentagens com até duas casas decimais.');
  }
  const [whole, fraction = ''] = input.replace(',', '.').split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

function calculateEqualSplit(
  totalCents: Cents,
  participants: readonly Participant[],
  inputs: readonly SplitShareInput[],
): ExpenseSplit[] {
  assertKnownParticipants(participants, inputs);
  const cents = allocatePenniesEqual(totalCents, inputs.length);
  return inputs
    .map(({ participantId }, index) => ({ participantId, amountCents: cents[index]! }))
    .filter(({ amountCents }) => amountCents > 0);
}

function calculatePercentageSplit(
  totalCents: Cents,
  participants: readonly Participant[],
  inputs: readonly SplitShareInput[],
): ExpenseSplit[] {
  let sum = 0;
  const percentages = inputs.map(({ participantId, value = 0 }) => {
    if (!Number.isInteger(value) || value < 0 || value > FULL_PERCENTAGE) {
      throw new DomainValidationError('INVALID_PERCENTAGE', 'Cada porcentagem deve estar entre 0 e 100%.');
    }
    sum += value;
    return { participantId, value };
  });
  if (sum !== FULL_PERCENTAGE) {
    throw new DomainValidationError(
      'PERCENTAGE_SUM_MISMATCH',
      `A soma das porcentagens deve ser 100% (total atual: ${(sum / 100).toFixed(2)}%).`,
    );
  }
  return calculateWeightedSharesSplit(totalCents, participants, percentages);
}

export function calculateExpenseSplit(
  totalCents: Cents,
  participants: readonly Participant[],
  mode: SplitType,
  inputs: readonly SplitShareInput[],
): ExpenseSplit[] {
  switch (mode) {
    case 'EQUAL': return calculateEqualSplit(totalCents, participants, inputs);
    case 'PERCENTAGE': return calculatePercentageSplit(totalCents, participants, inputs);
    case 'EXACT': return calculateExactSplit(totalCents, participants, inputs);
    case 'SHARES': return calculateWeightedSharesSplit(totalCents, participants, inputs);
  }
}
