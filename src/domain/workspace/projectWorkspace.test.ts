import { describe, expect, it } from 'vitest';
import {
  createProjectForOwner,
  filterProjectsForUser,
  isProjectOwner,
  isUserParticipantOrOwner,
  renameProjectAsOwner,
  resolveProjectStatus,
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
});
