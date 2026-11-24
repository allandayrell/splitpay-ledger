import { normalizeEmail } from '../auth/userAccount';
import { DomainValidationError } from '../errors';
import { addParticipant, createGroup, updateGroupName } from '../group/group';
import type { Cents, CurrencyCode, Group, GroupLedgerState, UserAccount } from '../types';

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

export type ProjectGroupStatus = 'QUITE' | 'PENDENTE';

export function resolveProjectStatus(project: GroupLedgerState): ProjectGroupStatus {
  if (project.expenses.length === 0) {
    return 'QUITE';
  }

  const netMap = new Map<string, number>();
  for (const participant of project.group.participants) {
    netMap.set(participant.id, 0);
  }

  for (const expense of project.expenses) {
    for (const payer of expense.payers) {
      netMap.set(payer.participantId, (netMap.get(payer.participantId) ?? 0) + payer.amountCents);
    }
    for (const split of expense.splits) {
      netMap.set(split.participantId, (netMap.get(split.participantId) ?? 0) - split.amountCents);
    }
  }

  for (const settlement of project.settlements) {
    netMap.set(
      settlement.fromParticipantId,
      (netMap.get(settlement.fromParticipantId) ?? 0) + settlement.amountCents,
    );
    netMap.set(
      settlement.toParticipantId,
      (netMap.get(settlement.toParticipantId) ?? 0) - settlement.amountCents,
    );
  }

  const allZero = Array.from(netMap.values()).every((cents) => cents === 0);
  return allZero ? 'QUITE' : 'PENDENTE';
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

export function getUserNetBalanceInProject(
  project: GroupLedgerState,
  user: Pick<UserAccount, 'id' | 'email'>,
): Cents {
  const normalizedUserEmail = normalizeEmail(user.email);
  const participant = project.group.participants.find(
    (p) =>
      p.userId === user.id ||
      (p.email !== undefined && normalizeEmail(p.email) === normalizedUserEmail),
  );

  if (!participant) {
    return 0;
  }

  let net = 0;

  for (const expense of project.expenses) {
    for (const payer of expense.payers) {
      if (payer.participantId === participant.id) {
        net += payer.amountCents;
      }
    }
    for (const split of expense.splits) {
      if (split.participantId === participant.id) {
        net -= split.amountCents;
      }
    }
  }

  for (const settlement of project.settlements) {
    if (settlement.fromParticipantId === participant.id) {
      net += settlement.amountCents;
    }
    if (settlement.toParticipantId === participant.id) {
      net -= settlement.amountCents;
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

    const userNetCents = getUserNetBalanceInProject(project, user);
    if (userNetCents !== 0) {
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


