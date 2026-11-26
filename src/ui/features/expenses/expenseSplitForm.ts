import { allocatePenniesWeighted, toCents } from '../../../domain/money/money';
import { calculateExpenseSplit, percentageToBasisPoints } from '../../../domain/split/splitEngine';
import type { Expense, Participant, SplitShareInput, SplitType } from '../../../domain/types';

export const splitModeLabels = {
  SHARES: 'Por Pesos / Cotas',
  EXACT: 'Valor Fixo Exato',
  EQUAL: 'Igualitária',
  PERCENTAGE: 'Porcentagem',
} satisfies Record<SplitType, string>;

export function buildSplitInputs(
  mode: SplitType,
  participants: readonly Participant[],
  values: Readonly<Record<string, string>>,
  excludedIds: readonly string[],
): SplitShareInput[] {
  return participants.filter(({ id }) => !excludedIds.includes(id)).map(({ id }) => {
    const raw = values[id]?.trim() ?? '';
    switch (mode) {
      case 'SHARES': return { participantId: id, value: raw ? Number(raw) : undefined };
      case 'EXACT': return { participantId: id, value: raw ? toCents(raw) : 0 };
      case 'PERCENTAGE': return { participantId: id, value: raw ? percentageToBasisPoints(raw) : 0 };
      case 'EQUAL': return { participantId: id };
    }
  });
}

export function restoreSplitForm(expense: Expense, participants: readonly Participant[]) {
  const storedInputs = Array.isArray(expense.splitInputs)
    ? expense.splitInputs.filter((entry) => typeof entry?.participantId === 'string')
    : undefined;
  const amounts = new Map(expense.splits.map(({ participantId, amountCents }) => [participantId, amountCents]));
  const values: Record<string, string> = {};

  if (storedInputs) {
    const included = new Set(storedInputs.map(({ participantId }) => participantId));
    for (const { participantId, value } of storedInputs) {
      if (value === undefined || expense.splitType === 'EQUAL') continue;
      values[participantId] = expense.splitType === 'SHARES' ? String(value) : (value / 100).toFixed(2);
    }
    return { values, excludedIds: participants.filter(({ id }) => !included.has(id)).map(({ id }) => id) };
  }

  const recordedParticipants = participants.filter(({ id }) => (amounts.get(id) ?? 0) > 0);
  const excludedIds = participants.filter(({ id }) => (amounts.get(id) ?? 0) <= 0).map(({ id }) => id);

  if (expense.splitType === 'EQUAL') return { values, excludedIds };

  if (expense.splitType === 'PERCENTAGE' && recordedParticipants.length > 0) {
    const shares = recordedParticipants.map(({ id }) => amounts.get(id)!);
    const bps = allocatePenniesWeighted(10_000, shares);
    recordedParticipants.forEach(({ id }, index) => {
      values[id] = (bps[index]! / 100).toFixed(2);
    });
    return { values, excludedIds };
  }

  if (expense.splitType === 'EXACT') {
    for (const [id, cents] of amounts) values[id] = (cents / 100).toFixed(2);
  }

  if (expense.splitType === 'SHARES' && expense.amountCents > 0) {
    const defaults = participants.map(({ id }) => ({ participantId: id }));
    try {
      const defaultShares = calculateExpenseSplit(expense.amountCents, participants, 'SHARES', defaults);
      if (
        defaultShares.length === amounts.size &&
        defaultShares.every(({ participantId, amountCents }) => amounts.get(participantId) === amountCents)
      ) return { values, excludedIds: [] };
    } catch {
      // A distribuição gravada continua sendo a referência para snapshots antigos.
    }
    for (const { id } of participants) values[id] = String(amounts.get(id) ?? 0);
  }

  return { values, excludedIds: [] };
}
