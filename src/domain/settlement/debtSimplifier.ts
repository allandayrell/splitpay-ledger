import { DomainValidationError } from '../errors';
import { assertValidIntegerCents } from '../money/money';
import type { Cents, NetBalance, TransferInstruction } from '../types';

export interface ParticipantBalanceEntry {
  participantId: string;
  netBalanceCents: Cents;
}

interface MutableEntry {
  participantId: string;
  amountCents: Cents;
}

function sortEntriesDeterministic(entries: MutableEntry[]): void {
  entries.sort((a, b) => {
    if (b.amountCents !== a.amountCents) {
      return b.amountCents - a.amountCents;
    }
    return a.participantId.localeCompare(b.participantId);
  });
}

export function simplifyDebts(
  balances: readonly (NetBalance | ParticipantBalanceEntry)[],
): TransferInstruction[] {
  let totalNetSum = 0;
  const creditors: MutableEntry[] = [];
  const debtors: MutableEntry[] = [];

  for (const item of balances) {
    assertValidIntegerCents(item.netBalanceCents, `netBalanceCents(${item.participantId})`);
    totalNetSum += item.netBalanceCents;

    if (item.netBalanceCents > 0) {
      creditors.push({
        participantId: item.participantId,
        amountCents: item.netBalanceCents,
      });
    } else if (item.netBalanceCents < 0) {
      debtors.push({
        participantId: item.participantId,
        amountCents: Math.abs(item.netBalanceCents),
      });
    }
  }

  if (totalNetSum !== 0) {
    throw new DomainValidationError(
      'NON_ZERO_NET_BALANCE_SUM',
      `Cannot simplify debts when total net balance sum is ${totalNetSum} cents instead of 0.`,
    );
  }

  const instructions: TransferInstruction[] = [];

  while (creditors.length > 0 && debtors.length > 0) {
    sortEntriesDeterministic(creditors);
    sortEntriesDeterministic(debtors);

    const topCreditor = creditors[0];
    const topDebtor = debtors[0];

    if (!topCreditor || !topDebtor) {
      break;
    }

    const transferAmount = Math.min(topCreditor.amountCents, topDebtor.amountCents);

    if (transferAmount > 0) {
      instructions.push({
        fromParticipantId: topDebtor.participantId,
        toParticipantId: topCreditor.participantId,
        amountCents: transferAmount,
      });
    }

    topCreditor.amountCents -= transferAmount;
    topDebtor.amountCents -= transferAmount;

    if (topCreditor.amountCents === 0) {
      creditors.shift();
    }
    if (topDebtor.amountCents === 0) {
      debtors.shift();
    }
  }

  return instructions;
}
