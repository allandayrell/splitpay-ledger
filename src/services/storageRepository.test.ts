import { describe, expect, it } from 'vitest';
import { addHybridParticipantToProject, createSeededUsers } from '../domain/auth/userAccount';
import type { Expense } from '../domain/types';
import { createProjectForOwner } from '../domain/workspace/projectWorkspace';
import {
  createInMemoryStorageRepository,
  createLocalStorageRepository,
  WORKSPACE_STORAGE_KEY,
  type PersistedWorkspaceSnapshot,
} from './storageRepository';

const users = createSeededUsers();
const owner = users[0]!;
const project = createProjectForOwner({ id: 'project', name: 'Viagem', owner });
const invitation = addHybridParticipantToProject(project.group, users, {
  participantId: 'guest',
  referencedUserEmailOrId: users[1]!.email,
  invitedByName: owner.name,
});
const expense: Expense = {
  id: 'expense',
  groupId: project.group.id,
  description: 'Refeição',
  category: 'FOOD',
  amountCents: 500,
  currency: 'BRL',
  payers: [{ participantId: project.group.participants[0]!.id, amountCents: 500 }],
  splitType: 'EXACT',
  splits: [{ participantId: 'guest', amountCents: 500 }],
  createdAt: project.group.createdAt,
};
const snapshot: PersistedWorkspaceSnapshot = {
  users,
  currentUserId: owner.id,
  projects: [{ ...project, group: invitation.group, expenses: [expense] }],
  notifications: [invitation.notification!],
};

describe('Workspace storage', () => {
  it('returns missing for a new browser and restores the same snapshot after saving', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    const repository = createLocalStorageRepository(() => storage);

    expect(repository.load()).toEqual({ status: 'missing' });
    expect(repository.save(snapshot)).toBe(true);

    const reloaded = createLocalStorageRepository(() => storage);
    expect(reloaded.load()).toEqual({ status: 'restored', snapshot });
    expect(JSON.parse(values.get(WORKSPACE_STORAGE_KEY)!)).toEqual(snapshot);
  });

  it('restores a logged-out legacy workspace without introducing expenses', () => {
    const loggedOut = { ...snapshot, currentUserId: null, projects: [project] };
    const storage = createInMemoryStorageRepository();

    expect(storage.save(loggedOut)).toBe(true);
    expect(storage.load()).toEqual({ status: 'restored', snapshot: loggedOut });
  });

  it.each([
    ['truncated JSON', '{"users":'],
    ['null JSON', 'null'],
    ['scalar JSON', '"workspace"'],
    ['missing users', JSON.stringify({ ...snapshot, users: undefined })],
    ['invalid user id', JSON.stringify({ ...snapshot, users: [{ email: owner.email }] })],
    ['invalid user email', JSON.stringify({ ...snapshot, users: [{ id: owner.id }] })],
    ['invalid user name', JSON.stringify({ ...snapshot, users: [{ id: owner.id, email: owner.email }] })],
    ['invalid session', JSON.stringify({ ...snapshot, currentUserId: 7 })],
    ['invalid notifications collection', JSON.stringify({ ...snapshot, notifications: null })],
    ['invalid notification', JSON.stringify({ ...snapshot, notifications: [{}] })],
    ['invalid projects collection', JSON.stringify({ ...snapshot, projects: null })],
    ['invalid group', JSON.stringify({ ...snapshot, projects: [{ ...project, group: null }] })],
    ['invalid group name', JSON.stringify({
      ...snapshot,
      projects: [{ ...project, group: { ...project.group, name: null } }],
    })],
    ['unknown base currency', JSON.stringify({
      ...snapshot,
      projects: [{ ...project, group: { ...project.group, baseCurrency: 'invalid' } }],
    })],
    ['invalid participants', JSON.stringify({
      ...snapshot,
      projects: [{ ...project, group: { ...project.group, participants: null } }],
    })],
    ['invalid expenses', JSON.stringify({ ...snapshot, projects: [{ ...project, expenses: null }] })],
    ['invalid expense payer', JSON.stringify({
      ...snapshot,
      projects: [{ ...project, expenses: [{ ...expense, payers: [null] }] }],
    })],
    ['non-integer share', JSON.stringify({
      ...snapshot,
      projects: [{ ...project, expenses: [{ ...expense, splits: [{ participantId: 'guest', amountCents: 0.5 }] }] }],
    })],
    ['invalid settlements', JSON.stringify({ ...snapshot, projects: [{ ...project, settlements: null }] })],
    ['invalid settlement amount', JSON.stringify({
      ...snapshot,
      projects: [{ ...project, settlements: [{ amountCents: '50' }] }],
    })],
  ])('reports %s as unreadable', (_label, raw) => {
    const repository = createLocalStorageRepository(() => ({
      getItem: () => raw,
      setItem: () => { throw new Error('Loading must be read-only'); },
    }));

    expect(repository.load()).toEqual({ status: 'unreadable' });
  });

  it('reports when browser access to local storage is denied', () => {
    const repository = createLocalStorageRepository(() => {
      throw new Error('Storage is unavailable');
    });

    expect(repository.load()).toEqual({ status: 'unreadable' });
    expect(repository.save(snapshot)).toBe(false);
  });
});
