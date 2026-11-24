import { normalizeEmail } from '../auth/userAccount';
import { addParticipant, createGroup } from '../group/group';
import type { CurrencyCode, Group, GroupLedgerState, UserAccount } from '../types';

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
