import { describe, expect, it } from 'vitest';
import {
  addHybridParticipantToProject,
  authenticateUser,
  createSeededUsers,
  getNotificationsForUser,
  markNotificationAsRead,
  registerUserAccount,
  updateUserProfile,
} from './userAccount';
import { createGroup } from '../group/group';
import { DomainValidationError } from '../errors';

describe('User Account, Profile, Hybrid Participant Link & Email Notifications', () => {
  it('seeds initial accounts including allan.dayrell@gmail.com with senha123 and authenticates properly', () => {
    const users = createSeededUsers();
    const allan = authenticateUser(users, '  ALLAN.DAYRELL@GMAIL.COM ', 'senha123');

    expect(allan.id).toBe('usr_allan');
    expect(allan.name).toBe('Allan Dayrell');
    expect(allan.email).toBe('allan.dayrell@gmail.com');
  });

  it('rejects login when email does not exist or password does not match', () => {
    const users = createSeededUsers();
    expect(() => authenticateUser(users, 'allan.dayrell@gmail.com', 'errada')).toThrow(
      DomainValidationError,
    );
    expect(() => authenticateUser(users, 'inexistente@gmail.com', 'senha123')).toThrow(
      DomainValidationError,
    );
  });

  it('registers a new user account and rejects invalid name, invalid email, weak password, or duplicate email', () => {
    const users = createSeededUsers();
    const created = registerUserAccount(users, {
      id: 'usr_diego',
      name: '  Diego Martins ',
      email: 'DIEGO@SPLITPAY.DEV',
      password: 'password123',
    });

    expect(created.name).toBe('Diego Martins');
    expect(created.email).toBe('diego@splitpay.dev');

    expect(() =>
      registerUserAccount(users, { name: '  ', email: 'novo@test.com', password: 'password123' }),
    ).toThrow(DomainValidationError);

    expect(() =>
      registerUserAccount(users, { name: 'Novo', email: 'email-invalido', password: 'password123' }),
    ).toThrow(DomainValidationError);

    expect(() =>
      registerUserAccount(users, { name: 'Novo', email: 'novo@test.com', password: '123' }),
    ).toThrow(DomainValidationError);

    expect(() =>
      registerUserAccount(users, {
        name: 'Clone',
        email: 'allan.dayrell@gmail.com',
        password: 'password123',
      }),
    ).toThrow(DomainValidationError);
  });

  it('updates user profile name, email, and avatarUrl and guards against email collisions', () => {
    const users = createSeededUsers();
    const updatedList = updateUserProfile(users, {
      userId: 'usr_allan',
      name: 'Allan D.',
      avatarUrl: 'https://example.com/allan.png',
    });

    const updatedAllan = updatedList.find((u) => u.id === 'usr_allan');
    expect(updatedAllan?.name).toBe('Allan D.');
    expect(updatedAllan?.avatarUrl).toBe('https://example.com/allan.png');

    expect(() =>
      updateUserProfile(users, { userId: 'usr_unknown', name: 'Teste' }),
    ).toThrow(DomainValidationError);

    expect(() =>
      updateUserProfile(users, { userId: 'usr_allan', name: '   ' }),
    ).toThrow(DomainValidationError);

    expect(() =>
      updateUserProfile(users, { userId: 'usr_allan', email: 'bad-email' }),
    ).toThrow(DomainValidationError);

    expect(() =>
      updateUserProfile(users, { userId: 'usr_allan', email: 'warley@splitpay.dev' }),
    ).toThrow(DomainValidationError);
  });

  it('adds a plain string participant without a user account and generates no email notification', () => {
    const users = createSeededUsers();
    const group = createGroup({
      id: 'grp_1',
      name: 'Churrasco Fim de Semana',
      ownerUserId: 'usr_allan',
    });

    const result = addHybridParticipantToProject(group, users, {
      participantId: 'p_convidado',
      name: 'Primo Lucas (Sem Conta)',
      defaultWeight: 1,
      invitedByName: 'Allan Dayrell',
    });

    expect(result.notification).toBeNull();
    expect(result.group.participants).toHaveLength(1);
    expect(result.group.participants[0]).toEqual({
      id: 'p_convidado',
      name: 'Primo Lucas (Sem Conta)',
      defaultWeight: 1,
    });
  });

  it('links a registered user account as participant and dispatches an email notification to their inbox', () => {
    const users = createSeededUsers();
    const group = createGroup({
      id: 'grp_viagem',
      name: 'Viagem Capitólio',
      ownerUserId: 'usr_allan',
    });

    const result = addHybridParticipantToProject(group, users, {
      participantId: 'p_warley',
      referencedUserEmailOrId: 'warley@splitpay.dev',
      defaultWeight: 1.5,
      invitedByName: 'Allan Dayrell',
      notificationId: 'notif_1',
    });

    expect(result.group.participants[0]).toEqual({
      id: 'p_warley',
      name: 'Warley',
      defaultWeight: 1.5,
      userId: 'usr_warley',
      email: 'warley@splitpay.dev',
    });

    expect(result.notification).not.toBeNull();
    expect(result.notification?.recipientEmail).toBe('warley@splitpay.dev');
    expect(result.notification?.groupId).toBe('grp_viagem');
    expect(result.notification?.read).toBe(false);
  });

  it('rejects hybrid participant addition when referenced user account does not exist or is already in the group', () => {
    const users = createSeededUsers();
    let group = createGroup({ id: 'grp_1', name: 'Projeto X', ownerUserId: 'usr_allan' });

    expect(() =>
      addHybridParticipantToProject(group, users, {
        referencedUserEmailOrId: 'fantasma@splitpay.dev',
        invitedByName: 'Allan Dayrell',
      }),
    ).toThrow(DomainValidationError);

    const firstAdd = addHybridParticipantToProject(group, users, {
      referencedUserEmailOrId: 'warley@splitpay.dev',
      invitedByName: 'Allan Dayrell',
    });
    group = firstAdd.group;

    expect(() =>
      addHybridParticipantToProject(group, users, {
        name: 'Outro Nome Mesmo Usuario',
        referencedUserEmailOrId: 'warley@splitpay.dev',
        invitedByName: 'Allan Dayrell',
      }),
    ).toThrow(DomainValidationError);
  });

  it('filters email notifications for a specific user and marks notifications as read', () => {
    const users = createSeededUsers();
    const group = createGroup({ id: 'grp_1', name: 'República', ownerUserId: 'usr_allan' });

    const r1 = addHybridParticipantToProject(group, users, {
      referencedUserEmailOrId: 'warley@splitpay.dev',
      invitedByName: 'Allan Dayrell',
      notificationId: 'notif_w',
    });
    const r2 = addHybridParticipantToProject(r1.group, users, {
      referencedUserEmailOrId: 'alice@splitpay.dev',
      invitedByName: 'Allan Dayrell',
      notificationId: 'notif_a',
    });

    const allNotifications = [r1.notification!, r2.notification!];
    const warleyInbox = getNotificationsForUser(allNotifications, {
      id: 'usr_warley',
      email: 'warley@splitpay.dev',
    });

    expect(warleyInbox).toHaveLength(1);
    expect(warleyInbox[0]?.id).toBe('notif_w');

    const afterRead = markNotificationAsRead(allNotifications, 'notif_w');
    expect(afterRead.find((n) => n.id === 'notif_w')?.read).toBe(true);
  });
});
