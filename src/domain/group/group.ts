import { DomainValidationError } from '../errors';
import type { CurrencyCode, Group, Participant } from '../types';

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

  const defaultWeight = input.defaultWeight ?? 1;
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
