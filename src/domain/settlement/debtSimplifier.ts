import { DomainValidationError } from '../errors';
import { assertValidIntegerCents } from '../money/money';
import type {
  Cents,
  Group,
  NetBalance,
  SettlementRecord,
  TransferInstruction,
} from '../types';

export interface ParticipantBalanceEntry {
  participantId: string;
  netBalanceCents: Cents;
}

export interface CreateSettlementInput {
  id?: string;
  groupId: string;
  fromParticipantId: string;
  toParticipantId: string;
  amountCents: Cents;
  createdAt?: string;
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

export function createSettlementRecord(
  group: Group,
  input: CreateSettlementInput,
): SettlementRecord {
  assertValidIntegerCents(input.amountCents, 'settlementAmountCents');
  if (input.amountCents <= 0) {
    throw new DomainValidationError(
      'INVALID_SETTLEMENT_AMOUNT',
      'Settlement amount in cents must be greater than zero.',
    );
  }

  if (input.fromParticipantId === input.toParticipantId) {
    throw new DomainValidationError(
      'SELF_SETTLEMENT_NOT_ALLOWED',
      'Cannot record a settlement transfer from a participant to themselves.',
    );
  }

  const validIds = new Set(group.participants.map((p) => p.id));
  if (!validIds.has(input.fromParticipantId) || !validIds.has(input.toParticipantId)) {
    throw new DomainValidationError(
      'UNKNOWN_SETTLEMENT_PARTICIPANT',
      'Both settlement payer and receiver must belong to the group.',
    );
  }

  return {
    id: input.id ?? `set_${Date.now()}`,
    groupId: input.groupId,
    fromParticipantId: input.fromParticipantId,
    toParticipantId: input.toParticipantId,
    amountCents: input.amountCents,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function createSettlementForTransfer(
  group: Group,
  transfer: TransferInstruction,
  amountCents = transfer.amountCents,
): SettlementRecord {
  if (amountCents > transfer.amountCents) {
    throw new DomainValidationError(
      'SETTLEMENT_EXCEEDS_TRANSFER',
      'O pagamento não pode ultrapassar o valor da transferência pendente.',
    );
  }
  return createSettlementRecord(group, { ...transfer, groupId: group.id, amountCents });
}

export function applySettlementsToBalances(
  balances: readonly ParticipantBalanceEntry[],
  settlements: readonly SettlementRecord[],
): ParticipantBalanceEntry[] {
  const balanceMap = new Map<string, Cents>();
  for (const entry of balances) {
    assertValidIntegerCents(entry.netBalanceCents, `netBalanceCents(${entry.participantId})`);
    balanceMap.set(entry.participantId, entry.netBalanceCents);
  }

  for (const settlement of settlements) {
    assertValidIntegerCents(settlement.amountCents, `settlement(${settlement.id})`);
    if (settlement.amountCents <= 0) {
      throw new DomainValidationError(
        'INVALID_SETTLEMENT_AMOUNT',
        'Settlement amount must be positive.',
      );
    }

    const fromCurrent = balanceMap.get(settlement.fromParticipantId);
    const toCurrent = balanceMap.get(settlement.toParticipantId);

    if (fromCurrent === undefined || toCurrent === undefined) {
      throw new DomainValidationError(
        'UNKNOWN_SETTLEMENT_PARTICIPANT',
        'Settlement references a participant missing from the balance table.',
      );
    }

    balanceMap.set(settlement.fromParticipantId, fromCurrent + settlement.amountCents);
    balanceMap.set(settlement.toParticipantId, toCurrent - settlement.amountCents);
  }

  return balances.map((entry) => ({
    participantId: entry.participantId,
    netBalanceCents: balanceMap.get(entry.participantId) ?? 0,
  }));
}

export function revertSettlementRecord(
  settlements: readonly SettlementRecord[],
  settlementId: string,
): SettlementRecord[] {
  const exists = settlements.some((s) => s.id === settlementId);
  if (!exists) {
    throw new DomainValidationError(
      'SETTLEMENT_NOT_FOUND',
      `Settlement record "${settlementId}" was not found.`,
    );
  }

  return settlements.filter((s) => s.id !== settlementId);
}


