import { normalizeEmail } from '../auth/userAccount';
import { DomainValidationError } from '../errors';
import { addParticipant, createGroup, updateGroupName } from '../group/group';
import {
  applySettlementsToBalances,
  simplifyDebts,
  type ParticipantBalanceEntry,
} from '../settlement/debtSimplifier';
import type {
  Cents,
  CurrencyCode,
  Group,
  GroupLedgerState,
  TransferInstruction,
  UserAccount,
} from '../types';

export interface CreateProjectByOwnerInput {
  id?: string;
  name: string;
  baseCurrency?: CurrencyCode;
  owner: UserAccount;
  ownerDefaultWeight?: number;
  createdAt?: string;
}

export function createProjectForOwner(input: CreateProjectByOwnerInput): GroupLedgerState {
  let group = createGroup({
    id: input.id,
    name: input.name,
    baseCurrency: input.baseCurrency ?? 'BRL',
    ownerUserId: input.owner.id,
    createdAt: input.createdAt,
  });

  group = addParticipant(group, {
    id: `p_${input.owner.id}`,
    name: input.owner.name,
    defaultWeight: input.ownerDefaultWeight ?? 1,
    userId: input.owner.id,
    email: input.owner.email,
  });

  return {
    group,
    expenses: [],
    settlements: [],
  };
}

export function isUserParticipantOrOwner(
  group: Group,
  user: Pick<UserAccount, 'id' | 'email'>,
): boolean {
  if (group.ownerUserId === user.id) {
    return true;
  }

  const normalizedUserEmail = normalizeEmail(user.email);
  return group.participants.some(
    (p) =>
      p.userId === user.id ||
      (p.email !== undefined && normalizeEmail(p.email) === normalizedUserEmail),
  );
}

export function filterProjectsForUser(
  projects: readonly GroupLedgerState[],
  user: Pick<UserAccount, 'id' | 'email'>,
): GroupLedgerState[] {
  return projects.filter((project) => isUserParticipantOrOwner(project.group, user));
}

export function isProjectOwner(group: Group, userId: string): boolean {
  return group.ownerUserId !== undefined && group.ownerUserId === userId;
}

export function renameProjectAsOwner(
  group: Group,
  actorUserId: string,
  newName: string,
): Group {
  if (!isProjectOwner(group, actorUserId)) {
    throw new DomainValidationError(
      'FORBIDDEN_NOT_PROJECT_OWNER',
      'Only the project owner is allowed to edit project settings.',
    );
  }

  return updateGroupName(group, newName);
}

export type ProjectGroupStatus = 'QUITE' | 'PENDENTE' | 'INCONSISTENTE';

export function calculateProjectEffectiveBalances(
  project: GroupLedgerState,
): ParticipantBalanceEntry[] {
  const netMap = new Map<string, number>();
  for (const participant of project.group.participants) {
    netMap.set(participant.id, 0);
  }

  function adjustBalance(participantId: string, difference: Cents) {
    const balance = netMap.get(participantId);
    if (balance === undefined) {
      throw new DomainValidationError(
        'UNKNOWN_EXPENSE_PARTICIPANT',
        'Expense references a participant outside the project.',
      );
    }
    netMap.set(participantId, balance + difference);
  }

  for (const expense of project.expenses) {
    for (const payer of expense.payers) {
      adjustBalance(payer.participantId, payer.amountCents);
    }
    for (const split of expense.splits) {
      adjustBalance(split.participantId, -split.amountCents);
    }
  }

  const baseBalances = Array.from(netMap, ([participantId, netBalanceCents]) => ({
    participantId,
    netBalanceCents,
  }));
  return applySettlementsToBalances(baseBalances, project.settlements);
}

export function getProjectTransferPlan(project: GroupLedgerState): TransferInstruction[] {
  return simplifyDebts(calculateProjectEffectiveBalances(project));
}

export function resolveProjectStatus(project: GroupLedgerState): ProjectGroupStatus {
  try {
    return getProjectTransferPlan(project).length === 0 ? 'QUITE' : 'PENDENTE';
  } catch {
    return 'INCONSISTENTE';
  }
}

export function setProjectArchivedAsOwner(
  group: Group,
  actorUserId: string,
  archived: boolean,
): Group {
  if (!isProjectOwner(group, actorUserId)) {
    throw new DomainValidationError(
      'FORBIDDEN_NOT_PROJECT_OWNER',
      'Only the project owner is allowed to archive or unarchive the project.',
    );
  }

  return {
    ...group,
    archived,
  };
}

export type ProjectDateSortOrder = 'NEWEST_FIRST' | 'OLDEST_FIRST';

export function sortProjectsByCreationDate(
  projects: readonly GroupLedgerState[],
  order: ProjectDateSortOrder = 'NEWEST_FIRST',
): GroupLedgerState[] {
  return [...projects].sort((a, b) => {
    const timeA = Date.parse(a.group.createdAt);
    const timeB = Date.parse(b.group.createdAt);
    if (timeA !== timeB) {
      return order === 'NEWEST_FIRST' ? timeB - timeA : timeA - timeB;
    }
    return a.group.id.localeCompare(b.group.id);
  });
}

export function findUserParticipantInGroup(
  group: Group,
  user: Pick<UserAccount, 'id' | 'email'>,
) {
  const normalizedUserEmail = normalizeEmail(user.email);
  return group.participants.find(
    (p) =>
      p.userId === user.id ||
      (p.email !== undefined && normalizeEmail(p.email) === normalizedUserEmail),
  );
}

export function getUserPendingTransfersInProject(
  project: GroupLedgerState,
  user: Pick<UserAccount, 'id' | 'email'>,
): TransferInstruction[] {
  const participant = findUserParticipantInGroup(project.group, user);
  if (!participant) {
    return [];
  }

  const transfers = getProjectTransferPlan(project);
  return transfers.filter(
    (t) => t.fromParticipantId === participant.id || t.toParticipantId === participant.id,
  );
}

export function getUserNetBalanceInProject(
  project: GroupLedgerState,
  user: Pick<UserAccount, 'id' | 'email'>,
): Cents {
  const participant = findUserParticipantInGroup(project.group, user);
  if (!participant) {
    return 0;
  }

  const userTransfers = getUserPendingTransfersInProject(project, user);
  let net = 0;
  for (const transfer of userTransfers) {
    if (transfer.toParticipantId === participant.id) {
      net += transfer.amountCents;
    } else if (transfer.fromParticipantId === participant.id) {
      net -= transfer.amountCents;
    }
  }

  return net;
}

export interface CategorizedUserProjects {
  pendingActionProjects: GroupLedgerState[];
  settledForUserProjects: GroupLedgerState[];
  archivedProjects: GroupLedgerState[];
}

export function categorizeProjectsForUserHome(
  projects: readonly GroupLedgerState[],
  user: Pick<UserAccount, 'id' | 'email'>,
  sortOrder: ProjectDateSortOrder = 'NEWEST_FIRST',
): CategorizedUserProjects {
  const visible = filterProjectsForUser(projects, user);
  const sorted = sortProjectsByCreationDate(visible, sortOrder);

  const pendingActionProjects: GroupLedgerState[] = [];
  const settledForUserProjects: GroupLedgerState[] = [];
  const archivedProjects: GroupLedgerState[] = [];

  for (const project of sorted) {
    if (project.group.archived) {
      archivedProjects.push(project);
      continue;
    }

    if (
      resolveProjectStatus(project) === 'INCONSISTENTE' ||
      getUserPendingTransfersInProject(project, user).length > 0
    ) {
      pendingActionProjects.push(project);
    } else {
      settledForUserProjects.push(project);
    }
  }

  return {
    pendingActionProjects,
    settledForUserProjects,
    archivedProjects,
  };
}


