import { isCurrencyCode } from '../domain/money/money';
import type { EmailNotification, ExpensePayer, GroupLedgerState, UserAccount } from '../domain/types';

export const WORKSPACE_STORAGE_KEY = 'splitpay_ledger_workspace_v1';

export interface PersistedWorkspaceSnapshot {
  users: UserAccount[];
  currentUserId: string | null;
  projects: GroupLedgerState[];
  notifications: EmailNotification[];
}

type SnapshotLoad =
  | { status: 'missing' }
  | { status: 'unreadable' }
  | { status: 'restored'; snapshot: PersistedWorkspaceSnapshot };

export interface StorageRepository {
  load(): SnapshotLoad;
  save(snapshot: PersistedWorkspaceSnapshot): boolean;
}

function hasAmountEntry(entry: ExpensePayer): boolean {
  return typeof entry?.participantId === 'string' && Number.isSafeInteger(entry.amountCents);
}

function isWorkspaceSnapshot(value: unknown): value is PersistedWorkspaceSnapshot {
  if (value === null || typeof value !== 'object') return false;

  const snapshot = value as Partial<PersistedWorkspaceSnapshot>;
  return (
    Array.isArray(snapshot.users) &&
    snapshot.users.every(
      (user) => typeof user?.id === 'string' && typeof user.email === 'string' && typeof user.name === 'string',
    ) &&
    (snapshot.currentUserId === null || typeof snapshot.currentUserId === 'string') &&
    Array.isArray(snapshot.notifications) &&
    snapshot.notifications.every((notification) => typeof notification?.recipientEmail === 'string') &&
    Array.isArray(snapshot.projects) &&
    snapshot.projects.every(
      (project) =>
        typeof project?.group?.id === 'string' &&
        typeof project.group.name === 'string' &&
        isCurrencyCode(project.group.baseCurrency) &&
        Array.isArray(project.group.participants) &&
        project.group.participants.every(
          (participant) => typeof participant?.id === 'string' && typeof participant.name === 'string',
        ) &&
        Array.isArray(project.expenses) &&
        project.expenses.every(
          (expense) =>
            Number.isSafeInteger(expense?.amountCents) &&
            Array.isArray(expense.payers) &&
            expense.payers.every(hasAmountEntry) &&
            Array.isArray(expense.splits) &&
            expense.splits.every(hasAmountEntry),
        ) &&
        Array.isArray(project.settlements) &&
        project.settlements.every((settlement) => Number.isSafeInteger(settlement?.amountCents)),
    )
  );
}

export function createLocalStorageRepository(
  getStorage: () => Pick<Storage, 'getItem' | 'setItem'>,
): StorageRepository {
  return {
    load() {
      try {
        const raw = getStorage().getItem(WORKSPACE_STORAGE_KEY);
        if (raw === null) return { status: 'missing' };

        const snapshot: unknown = JSON.parse(raw);
        return isWorkspaceSnapshot(snapshot) ? { status: 'restored', snapshot } : { status: 'unreadable' };
      } catch {
        return { status: 'unreadable' };
      }
    },
    save(snapshot) {
      try {
        getStorage().setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot));
        return true;
      } catch {
        return false;
      }
    },
  };
}

export function createInMemoryStorageRepository(): StorageRepository {
  let storedSnapshot: string | null = null;
  return createLocalStorageRepository(() => ({
    getItem: () => storedSnapshot,
    setItem: (_key, value) => {
      storedSnapshot = value;
    },
  }));
}
