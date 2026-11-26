import { describe, expect, it } from 'vitest';
import {
  categorizeProjectsForUserHome,
  createProjectForOwner,
  filterProjectsForUser,
  getUserNetBalanceInProject,
  isProjectOwner,
  isUserParticipantOrOwner,
  renameProjectAsOwner,
  resolveProjectStatus,
  setProjectArchivedAsOwner,
  sortProjectsByCreationDate,
} from './projectWorkspace';
import { addHybridParticipantToProject, createSeededUsers } from '../auth/userAccount';
import { DomainValidationError } from '../errors';
import type { UserAccount } from '../types';

const users = createSeededUsers();
const allan: UserAccount = users.find((u) => u.id === 'usr_allan')!;
const warley: UserAccount = users.find((u) => u.id === 'usr_warley')!;
const alice: UserAccount = users.find((u) => u.id === 'usr_alice')!;

describe('Multi-Project Workspace & Owner vs Participant Permissions', () => {
  it('creates a new project from scratch with the creator as owner and initial linked participant', () => {
    const project = createProjectForOwner({
      id: 'grp_novo',
      name: '  República Pampulha ',
      baseCurrency: 'BRL',
      owner: allan,
      ownerDefaultWeight: 1,
    });

    expect(project.group.name).toBe('República Pampulha');
    expect(project.group.ownerUserId).toBe('usr_allan');
    expect(project.group.participants).toHaveLength(1);
    expect(project.group.participants[0]?.email).toBe('allan.dayrell@gmail.com');
  });

  it('identifies whether a user is the project owner versus a regular participant', () => {
    const project = createProjectForOwner({
      id: 'grp_1',
      name: 'Viagem Serra',
      owner: allan,
    });

    const withWarley = addHybridParticipantToProject(project.group, users, {
      referencedUserEmailOrId: 'warley@splitpay.dev',
      invitedByName: allan.name,
    });

    expect(isProjectOwner(withWarley.group, allan.id)).toBe(true);
    expect(isProjectOwner(withWarley.group, warley.id)).toBe(false);
    expect(isUserParticipantOrOwner(withWarley.group, warley)).toBe(true);
    expect(isUserParticipantOrOwner(withWarley.group, alice)).toBe(false);
  });

  it('filters projects for the Home dashboard so a user sees only projects where they are owner or linked participant', () => {
    const p1 = createProjectForOwner({ id: 'grp_1', name: 'Viagem Allan & Warley', owner: allan });
    p1.group = addHybridParticipantToProject(p1.group, users, {
      referencedUserEmailOrId: 'warley@splitpay.dev',
      invitedByName: allan.name,
    }).group;

    const p2 = createProjectForOwner({ id: 'grp_2', name: 'Projeto Exclusivo Allan', owner: allan });
    const p3 = createProjectForOwner({ id: 'grp_3', name: 'Projeto Alice', owner: alice });

    const allProjects = [p1, p2, p3];

    const allanProjects = filterProjectsForUser(allProjects, allan);
    const warleyProjects = filterProjectsForUser(allProjects, warley);

    expect(allanProjects.map((p) => p.group.id)).toEqual(['grp_1', 'grp_2']);
    expect(warleyProjects.map((p) => p.group.id)).toEqual(['grp_1']);
  });

  it('allows project owner to rename the project', () => {
    const project = createProjectForOwner({ id: 'grp_1', name: 'Original', owner: allan });
    const renamed = renameProjectAsOwner(project.group, allan.id, 'Novo Nome do Dono');

    expect(renamed.name).toBe('Novo Nome do Dono');
  });

  it('prevents a regular participant or non-owner from renaming or editing project settings', () => {
    const project = createProjectForOwner({ id: 'grp_1', name: 'Original', owner: allan });
    const withWarley = addHybridParticipantToProject(project.group, users, {
      referencedUserEmailOrId: 'warley@splitpay.dev',
      invitedByName: allan.name,
    });

    expect(() => renameProjectAsOwner(withWarley.group, warley.id, 'Tentativa Warley')).toThrow(
      DomainValidationError,
    );
  });

  it('resolves project status as QUITE when there are no expenses or all debts are settled', () => {
    const project = createProjectForOwner({ id: 'grp_1', name: 'Viagem', owner: allan });
    project.group = addHybridParticipantToProject(project.group, users, {
      participantId: 'p_warley',
      referencedUserEmailOrId: 'warley@splitpay.dev',
      invitedByName: allan.name,
    }).group;

    expect(resolveProjectStatus(project)).toBe('QUITE');

    project.expenses.push({
      id: 'exp_1',
      groupId: 'grp_1',
      description: 'Hotel',
      category: 'ACCOMMODATION',
      amountCents: 10000,
      currency: 'BRL',
      payers: [{ participantId: `p_${allan.id}`, amountCents: 10000 }],
      splitType: 'EQUAL',
      splits: [
        { participantId: `p_${allan.id}`, amountCents: 5000 },
        { participantId: 'p_warley', amountCents: 5000 },
      ],
      createdAt: '2026-11-24T12:00:00.000Z',
    });

    expect(resolveProjectStatus(project)).toBe('PENDENTE');

    project.settlements.push({
      id: 'set_1',
      groupId: 'grp_1',
      fromParticipantId: 'p_warley',
      toParticipantId: `p_${allan.id}`,
      amountCents: 5000,
      createdAt: '2026-11-24T13:00:00.000Z',
    });

    expect(resolveProjectStatus(project)).toBe('QUITE');
  });

  it('automatically adds a project to a registered user Home list as soon as they are linked by email', () => {
    const project = createProjectForOwner({ id: 'grp_churras', name: 'Churrasco da Turma', owner: allan });
    expect(filterProjectsForUser([project], alice)).toHaveLength(0);

    project.group = addHybridParticipantToProject(project.group, users, {
      referencedUserEmailOrId: 'alice@splitpay.dev',
      invitedByName: allan.name,
    }).group;

    const aliceHomeProjects = filterProjectsForUser([project], alice);
    expect(aliceHomeProjects).toHaveLength(1);
    expect(aliceHomeProjects[0]?.group.name).toBe('Churrasco da Turma');
  });

  it('flags an imbalanced project for review instead of showing it as settled', () => {
    const project = createProjectForOwner({ id: 'grp_review', name: 'Viagem', owner: allan });
    project.expenses.push({
      id: 'exp_imbalance',
      groupId: project.group.id,
      description: 'Hotel',
      category: 'ACCOMMODATION',
      amountCents: 100,
      currency: 'BRL',
      payers: [{ participantId: `p_${allan.id}`, amountCents: 100 }],
      splitType: 'EXACT',
      splits: [{ participantId: `p_${allan.id}`, amountCents: 99 }],
      createdAt: '2026-11-24T12:00:00.000Z',
    });

    expect(resolveProjectStatus(project)).toBe('INCONSISTENTE');
    expect(categorizeProjectsForUserHome([project], allan).pendingActionProjects).toEqual([project]);
  });

  it('flags an imported settlement that refers to a missing participant', () => {
    const project = createProjectForOwner({ id: 'grp_review', name: 'Viagem', owner: allan });
    project.settlements.push({
      id: 'set_invalid',
      groupId: project.group.id,
      fromParticipantId: 'p_missing',
      toParticipantId: `p_${allan.id}`,
      amountCents: 100,
      createdAt: '2026-11-24T12:00:00.000Z',
    });

    expect(resolveProjectStatus(project)).toBe('INCONSISTENTE');
  });

  it('flags expense references outside the group even if the amounts cancel out', () => {
    const project = createProjectForOwner({ id: 'grp_review', name: 'Viagem', owner: allan });
    project.expenses.push({
      id: 'exp_invalid',
      groupId: project.group.id,
      description: 'Passeio',
      category: 'ENTERTAINMENT',
      amountCents: 100,
      currency: 'BRL',
      payers: [{ participantId: 'p_missing', amountCents: 100 }],
      splitType: 'EXACT',
      splits: [{ participantId: 'p_missing', amountCents: 100 }],
      createdAt: '2026-11-24T12:00:00.000Z',
    });

    expect(resolveProjectStatus(project)).toBe('INCONSISTENTE');
  });

  it('allows only the project owner to archive or unarchive a project for all members', () => {
    const project = createProjectForOwner({ id: 'grp_1', name: 'Viagem', owner: allan });
    project.group = addHybridParticipantToProject(project.group, users, {
      referencedUserEmailOrId: 'warley@splitpay.dev',
      invitedByName: allan.name,
    }).group;

    const archivedGroup = setProjectArchivedAsOwner(project.group, allan.id, true);
    expect(archivedGroup.archived).toBe(true);

    const reopenedGroup = setProjectArchivedAsOwner(archivedGroup, allan.id, false);
    expect(reopenedGroup.archived).toBe(false);

    expect(() => setProjectArchivedAsOwner(project.group, warley.id, true)).toThrow(
      DomainValidationError,
    );
  });

  it('sorts projects by creation date in newest-first or oldest-first order', () => {
    const pOld = createProjectForOwner({
      id: 'grp_old',
      name: 'Projeto Antigo',
      owner: allan,
      createdAt: '2026-01-10T10:00:00.000Z',
    });
    const pMid = createProjectForOwner({
      id: 'grp_mid',
      name: 'Projeto Meio',
      owner: allan,
      createdAt: '2026-06-15T10:00:00.000Z',
    });
    const pNew = createProjectForOwner({
      id: 'grp_new',
      name: 'Projeto Novo',
      owner: allan,
      createdAt: '2026-11-20T10:00:00.000Z',
    });

    const newestFirst = sortProjectsByCreationDate([pOld, pNew, pMid], 'NEWEST_FIRST');
    expect(newestFirst.map((p) => p.group.id)).toEqual(['grp_new', 'grp_mid', 'grp_old']);

    const oldestFirst = sortProjectsByCreationDate([pOld, pNew, pMid], 'OLDEST_FIRST');
    expect(oldestFirst.map((p) => p.group.id)).toEqual(['grp_old', 'grp_mid', 'grp_new']);
  });

  it('calculates individual user net balance in a project considering expenses and settlements', () => {
    const project = createProjectForOwner({ id: 'grp_1', name: 'Viagem', owner: allan });
    project.group = addHybridParticipantToProject(project.group, users, {
      participantId: 'p_warley',
      referencedUserEmailOrId: 'warley@splitpay.dev',
      invitedByName: allan.name,
    }).group;

    project.expenses.push({
      id: 'exp_1',
      groupId: 'grp_1',
      description: 'Jantar',
      category: 'FOOD',
      amountCents: 12000,
      currency: 'BRL',
      payers: [{ participantId: `p_${allan.id}`, amountCents: 12000 }],
      splitType: 'EQUAL',
      splits: [
        { participantId: `p_${allan.id}`, amountCents: 6000 },
        { participantId: 'p_warley', amountCents: 6000 },
      ],
      createdAt: '2026-11-24T12:00:00.000Z',
    });

    expect(getUserNetBalanceInProject(project, allan)).toBe(6000);
    expect(getUserNetBalanceInProject(project, warley)).toBe(-6000);
    expect(getUserNetBalanceInProject(project, alice)).toBe(0);
  });

  it('categorizes user projects into Pending Action, Settled For User, and Archived sections', () => {
    const pPending = createProjectForOwner({
      id: 'grp_pending',
      name: 'Projeto Com Saldo Pendente',
      owner: allan,
      createdAt: '2026-11-22T10:00:00.000Z',
    });
    pPending.group = addHybridParticipantToProject(pPending.group, users, {
      participantId: 'p_warley',
      referencedUserEmailOrId: 'warley@splitpay.dev',
      invitedByName: allan.name,
    }).group;
    pPending.expenses.push({
      id: 'exp_1',
      groupId: 'grp_pending',
      description: 'Passeio',
      category: 'ENTERTAINMENT',
      amountCents: 8000,
      currency: 'BRL',
      payers: [{ participantId: `p_${allan.id}`, amountCents: 8000 }],
      splitType: 'EQUAL',
      splits: [
        { participantId: `p_${allan.id}`, amountCents: 4000 },
        { participantId: 'p_warley', amountCents: 4000 },
      ],
      createdAt: '2026-11-22T11:00:00.000Z',
    });

    const pSettled = createProjectForOwner({
      id: 'grp_settled',
      name: 'Projeto Minha Parte Quite',
      owner: allan,
      createdAt: '2026-11-23T10:00:00.000Z',
    });

    const pArchived = createProjectForOwner({
      id: 'grp_archived',
      name: 'Projeto Arquivado Pelo Dono',
      owner: allan,
      createdAt: '2026-11-20T10:00:00.000Z',
    });
    pArchived.group = setProjectArchivedAsOwner(pArchived.group, allan.id, true);

    const categorized = categorizeProjectsForUserHome(
      [pPending, pSettled, pArchived],
      allan,
      'NEWEST_FIRST',
    );

    expect(categorized.pendingActionProjects.map((p) => p.group.id)).toEqual(['grp_pending']);
    expect(categorized.settledForUserProjects.map((p) => p.group.id)).toEqual(['grp_settled']);
    expect(categorized.archivedProjects.map((p) => p.group.id)).toEqual(['grp_archived']);
  });
});

