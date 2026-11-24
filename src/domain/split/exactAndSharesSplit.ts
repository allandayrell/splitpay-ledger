import { DomainValidationError } from '../errors';
import { assertValidIntegerCents } from '../money/money';
import type { Cents, ExpenseSplit, Participant, SplitShareInput } from '../types';

export function assertKnownParticipants(
  groupParticipants: readonly Participant[],
  inputs: readonly SplitShareInput[],
): void {
  if (inputs.length === 0) {
    throw new DomainValidationError(
      'EMPTY_SPLIT_PARTICIPANTS',
      'At least one participant must be included in the expense split.',
    );
  }

  const validIds = new Set(groupParticipants.map((p) => p.id));
  const seenIds = new Set<string>();

  for (const item of inputs) {
    if (!validIds.has(item.participantId)) {
      throw new DomainValidationError(
        'UNKNOWN_SPLIT_PARTICIPANT',
        `Participant "${item.participantId}" does not belong to this group.`,
      );
    }
    if (seenIds.has(item.participantId)) {
      throw new DomainValidationError(
        'DUPLICATE_SPLIT_PARTICIPANT',
        `Participant "${item.participantId}" cannot appear multiple times in the same split.`,
      );
    }
    seenIds.add(item.participantId);
  }
}

export function calculateExactSplit(
  totalCents: Cents,
  groupParticipants: readonly Participant[],
  inputs: readonly SplitShareInput[],
): ExpenseSplit[] {
  assertValidIntegerCents(totalCents, 'totalCents');
  if (totalCents <= 0) {
    throw new DomainValidationError(
      'INVALID_EXPENSE_TOTAL',
      'Total expense amount in cents must be greater than zero.',
    );
  }

  assertKnownParticipants(groupParticipants, inputs);

  let sumCents = 0;
  const splits: ExpenseSplit[] = [];

  for (const item of inputs) {
    const shareCents = item.value ?? 0;
    assertValidIntegerCents(shareCents, `exactShare(${item.participantId})`);

    if (shareCents < 0) {
      throw new DomainValidationError(
        'NEGATIVE_EXACT_SHARE',
        'Exact split share amount cannot be negative.',
      );
    }

    sumCents += shareCents;
    if (shareCents > 0) {
      splits.push({
        participantId: item.participantId,
        amountCents: shareCents,
      });
    }
  }

  if (sumCents !== totalCents) {
    throw new DomainValidationError(
      'EXACT_SPLIT_SUM_MISMATCH',
      `Sum of exact shares (${sumCents} cents) must equal total expense (${totalCents} cents).`,
    );
  }

  return splits;
}
