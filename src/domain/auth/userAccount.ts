import { DomainValidationError } from '../errors';
import { addParticipant } from '../group/group';
import type { EmailNotification, Group, UserAccount } from '../types';

export interface RegisterUserInput {
  id?: string;
  name: string;
  email: string;
  password: string;
  avatarUrl?: string;
  receiveEmailNotifications?: boolean;
  createdAt?: string;
}

export interface UpdateUserProfileInput {
  userId: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  receiveEmailNotifications?: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function hashPassword(rawPassword: string): string {
  return `hash_sp_${rawPassword}`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createSeededUsers(): UserAccount[] {
  const timestamp = '2026-11-23T18:00:00.000Z';
  return [
    {
      id: 'usr_allan',
      name: 'Allan Dayrell',
      email: 'allan.dayrell@gmail.com',
      passwordHash: hashPassword('senha123'),
      avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Allan+Dayrell',
      receiveEmailNotifications: true,
      createdAt: timestamp,
    },
    {
      id: 'usr_warley',
      name: 'Warley',
      email: 'warley@splitpay.dev',
      passwordHash: hashPassword('senha123'),
      avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Warley',
      receiveEmailNotifications: true,
      createdAt: timestamp,
    },
    {
      id: 'usr_alice',
      name: 'Alice Silva',
      email: 'alice@splitpay.dev',
      passwordHash: hashPassword('senha123'),
      avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Alice+Silva',
      receiveEmailNotifications: true,
      createdAt: timestamp,
    },
    {
      id: 'usr_bruno',
      name: 'Bruno Costa',
      email: 'bruno@splitpay.dev',
      passwordHash: hashPassword('senha123'),
      avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Bruno+Costa',
      receiveEmailNotifications: false,
      createdAt: timestamp,
    },
    {
      id: 'usr_carla',
      name: 'Carla Souza',
      email: 'carla@splitpay.dev',
      passwordHash: hashPassword('senha123'),
      avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Carla+Souza',
      receiveEmailNotifications: true,
      createdAt: timestamp,
    },
  ];
}

export function registerUserAccount(
  existingUsers: readonly UserAccount[],
  input: RegisterUserInput,
): UserAccount {
  const trimmedName = input.name.trim();
  if (trimmedName.length === 0) {
    throw new DomainValidationError('EMPTY_USER_NAME', 'User name cannot be empty.');
  }

  const normalizedEmail = normalizeEmail(input.email);
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new DomainValidationError('INVALID_USER_EMAIL', 'User email format is invalid.');
  }

  if (input.password.length < 6) {
    throw new DomainValidationError(
      'WEAK_USER_PASSWORD',
      'User password must contain at least 6 characters.',
    );
  }

  const emailTaken = existingUsers.some(
    (user) => normalizeEmail(user.email) === normalizedEmail,
  );
  if (emailTaken) {
    throw new DomainValidationError(
      'DUPLICATE_USER_EMAIL',
      `An account with email "${normalizedEmail}" is already registered.`,
    );
  }

  return {
    id: input.id ?? `usr_${Date.now()}`,
    name: trimmedName,
    email: normalizedEmail,
    passwordHash: hashPassword(input.password),
    avatarUrl:
      input.avatarUrl?.trim() ||
      `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(trimmedName)}`,
    receiveEmailNotifications: input.receiveEmailNotifications ?? true,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function authenticateUser(
  users: readonly UserAccount[],
  email: string,
  password: string,
): UserAccount {
  const normalizedTarget = normalizeEmail(email);
  const candidate = users.find((u) => normalizeEmail(u.email) === normalizedTarget);

  if (!candidate || candidate.passwordHash !== hashPassword(password)) {
    throw new DomainValidationError(
      'INVALID_CREDENTIALS',
      'Invalid email or password.',
    );
  }

  return candidate;
}

export function updateUserProfile(
  users: readonly UserAccount[],
  input: UpdateUserProfileInput,
): UserAccount[] {
  const target = users.find((u) => u.id === input.userId);
  if (!target) {
    throw new DomainValidationError('USER_NOT_FOUND', 'User account was not found.');
  }

  const nextName = input.name !== undefined ? input.name.trim() : target.name;
  if (nextName.length === 0) {
    throw new DomainValidationError('EMPTY_USER_NAME', 'User name cannot be empty.');
  }

  const nextEmail =
    input.email !== undefined ? normalizeEmail(input.email) : target.email;
  if (!EMAIL_REGEX.test(nextEmail)) {
    throw new DomainValidationError('INVALID_USER_EMAIL', 'User email format is invalid.');
  }

  const emailConflict = users.some(
    (u) => u.id !== input.userId && normalizeEmail(u.email) === nextEmail,
  );
  if (emailConflict) {
    throw new DomainValidationError(
      'DUPLICATE_USER_EMAIL',
      `Email "${nextEmail}" is already used by another account.`,
    );
  }

  const nextAvatar =
    input.avatarUrl !== undefined ? input.avatarUrl.trim() : target.avatarUrl;
  const nextReceiveEmail =
    input.receiveEmailNotifications !== undefined
      ? input.receiveEmailNotifications
      : (target.receiveEmailNotifications ?? true);

  return users.map((user) =>
    user.id === input.userId
      ? {
          ...user,
          name: nextName,
          email: nextEmail,
          avatarUrl:
            nextAvatar ||
            `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(nextName)}`,
          receiveEmailNotifications: nextReceiveEmail,
        }
      : user,
  );
}

export interface AddHybridParticipantInput {
  participantId?: string;
  name?: string;
  defaultWeight?: number;
  referencedUserEmailOrId?: string;
  invitedByName: string;
  notificationId?: string;
  createdAt?: string;
}

export interface AddHybridParticipantResult {
  group: Group;
  notification: EmailNotification | null;
}

export function addHybridParticipantToProject(
  group: Group,
  users: readonly UserAccount[],
  input: AddHybridParticipantInput,
): AddHybridParticipantResult {
  let matchedUser: UserAccount | undefined;

  if (
    input.referencedUserEmailOrId !== undefined &&
    input.referencedUserEmailOrId.trim().length > 0
  ) {
    const query = input.referencedUserEmailOrId.trim().toLowerCase();
    matchedUser = users.find(
      (u) => u.id.toLowerCase() === query || normalizeEmail(u.email) === query,
    );

    if (!matchedUser) {
      throw new DomainValidationError(
        'REFERENCED_USER_NOT_FOUND',
        `No registered user account matches "${input.referencedUserEmailOrId}".`,
      );
    }
  }

  const resolvedName =
    input.name !== undefined && input.name.trim().length > 0
      ? input.name.trim()
      : (matchedUser?.name ?? '');

  const updatedGroup = addParticipant(group, {
    id: input.participantId,
    name: resolvedName,
    defaultWeight: input.defaultWeight ?? 1,
    userId: matchedUser?.id,
    email: matchedUser?.email,
  });

  if (!matchedUser) {
    return {
      group: updatedGroup,
      notification: null,
    };
  }

  const createdAt = input.createdAt ?? new Date().toISOString();
  const sentToEmail = matchedUser.receiveEmailNotifications ?? true;
  const notification: EmailNotification = {
    id: input.notificationId ?? `notif_${Date.now()}`,
    recipientUserId: matchedUser.id,
    recipientEmail: matchedUser.email,
    subject: `Novo projeto adicionado: "${group.name}"`,
    body: `Olá ${matchedUser.name}, ${input.invitedByName} adicionou você ao projeto "${group.name}".`,
    groupId: group.id,
    groupName: group.name,
    invitedByName: input.invitedByName,
    sentToEmail,
    read: false,
    createdAt,
  };

  return {
    group: updatedGroup,
    notification,
  };
}

export function getNotificationsForUser(
  notifications: readonly EmailNotification[],
  user: Pick<UserAccount, 'id' | 'email'>,
): EmailNotification[] {
  const normalized = normalizeEmail(user.email);
  return notifications.filter(
    (n) => n.recipientUserId === user.id || normalizeEmail(n.recipientEmail) === normalized,
  );
}

export function markNotificationAsRead(
  notifications: readonly EmailNotification[],
  notificationId: string,
): EmailNotification[] {
  return notifications.map((n) => (n.id === notificationId ? { ...n, read: true } : n));
}

