import { DomainValidationError } from '../errors';
import type { CurrencyCode, Expense, Group, Participant, SettlementRecord } from '../types';

export interface CreateGroupInput {
  id?: string;
  name: string;
  baseCurrency?: CurrencyCode;
  createdAt?: string;
}

export interface AddParticipantInput {
  id?: string;
  name: string;
  defaultWeight?: number;
}

export interface UpdateParticipantInput {
  participantId: string;
  name?: string;
  defaultWeight?: number;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function assertPositiveWeight(weight: number): void {
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
    throw new DomainValidationError(
      'INVALID_PARTICIPANT_WEIGHT',
      'Participant default weight must be a finite number greater than zero.',
    );
  }
}

export function createGroup(input: CreateGroupInput): Group {
  const trimmedName = input.name.trim();
  if (trimmedName.length === 0) {
    throw new DomainValidationError('EMPTY_GROUP_NAME', 'Group name cannot be empty.');
  }

  return {
    id: input.id ?? `grp_${Date.now()}`,
    name: trimmedName,
    baseCurrency: input.baseCurrency ?? 'BRL',
    participants: [],
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function updateGroupName(group: Group, newName: string): Group {
  const trimmedName = newName.trim();
  if (trimmedName.length === 0) {
    throw new DomainValidationError('EMPTY_GROUP_NAME', 'Group name cannot be empty.');
  }

  return {
    ...group,
    name: trimmedName,
  };
}

export function addParticipant(group: Group, input: AddParticipantInput): Group {
  const trimmedName = input.name.trim();
  if (trimmedName.length === 0) {
    throw new DomainValidationError('EMPTY_PARTICIPANT_NAME', 'Participant name cannot be empty.');
  }

  const normalizedTarget = normalizeName(trimmedName);
  const hasDuplicate = group.participants.some(
    (existing) => normalizeName(existing.name) === normalizedTarget,
  );

  if (hasDuplicate) {
    throw new DomainValidationError(
      'DUPLICATE_PARTICIPANT_NAME',
      `Participant "${trimmedName}" already exists in the group.`,
    );
  }

  const defaultWeight = input.defaultWeight ?? 1;
  assertPositiveWeight(defaultWeight);

  const participant: Participant = {
    id: input.id ?? `p_${group.participants.length + 1}_${Date.now()}`,
    name: trimmedName,
    defaultWeight,
  };

  return {
    ...group,
    participants: [...group.participants, participant],
  };
}

export function updateParticipant(group: Group, input: UpdateParticipantInput): Group {
  const target = group.participants.find((p) => p.id === input.participantId);
  if (!target) {
    throw new DomainValidationError(
      'PARTICIPANT_NOT_FOUND',
      `Participant with id "${input.participantId}" does not exist in the group.`,
    );
  }

  const updatedName = input.name !== undefined ? input.name.trim() : target.name;
  if (updatedName.length === 0) {
    throw new DomainValidationError('EMPTY_PARTICIPANT_NAME', 'Participant name cannot be empty.');
  }

  const normalizedTarget = normalizeName(updatedName);
  const hasDuplicate = group.participants.some(
    (existing) => existing.id !== input.participantId && normalizeName(existing.name) === normalizedTarget,
  );

  if (hasDuplicate) {
    throw new DomainValidationError(
      'DUPLICATE_PARTICIPANT_NAME',
      `Participant "${updatedName}" already exists in the group.`,
    );
  }

  const updatedWeight = input.defaultWeight !== undefined ? input.defaultWeight : target.defaultWeight;
  assertPositiveWeight(updatedWeight);

  return {
    ...group,
    participants: group.participants.map((p) =>
      p.id === input.participantId
        ? { ...p, name: updatedName, defaultWeight: updatedWeight }
        : p,
    ),
  };
}

export function removeParticipant(
  group: Group,
  participantId: string,
  expenses: readonly Expense[] = [],
  settlements: readonly SettlementRecord[] = [],
): Group {
  const exists = group.participants.some((p) => p.id === participantId);
  if (!exists) {
    throw new DomainValidationError(
      'PARTICIPANT_NOT_FOUND',
      `Participant with id "${participantId}" does not exist in the group.`,
    );
  }

  const isLinkedToExpense = expenses.some(
    (expense) =>
      expense.payers.some((payer) => payer.participantId === participantId) ||
      expense.splits.some((split) => split.participantId === participantId),
  );

  const isLinkedToSettlement = settlements.some(
    (settlement) =>
      settlement.fromParticipantId === participantId ||
      settlement.toParticipantId === participantId,
  );

  if (isLinkedToExpense || isLinkedToSettlement) {
    throw new DomainValidationError(
      'PARTICIPANT_HAS_LINKED_RECORDS',
      'Cannot remove participant who is referenced in active expenses or settlements.',
    );
  }

  return {
    ...group,
    participants: group.participants.filter((p) => p.id !== participantId),
  };
}
