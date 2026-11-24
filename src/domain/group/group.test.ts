import { describe, expect, it } from 'vitest';
import {
  addParticipant,
  createGroup,
  removeParticipant,
  updateGroupName,
  updateParticipant,
} from './group';

describe('Group & Participant Domain Engine', () => {
  it('creates a valid group with trimmed name, default currency BRL, and empty participants', () => {
    const group = createGroup({
      id: 'grp_1',
      name: '  Viagem Capitólio  ',
      createdAt: '2026-11-23T19:00:00.000Z',
    });

    expect(group).toEqual({
      id: 'grp_1',
      name: 'Viagem Capitólio',
      baseCurrency: 'BRL',
      participants: [],
      createdAt: '2026-11-23T19:00:00.000Z',
    });

    const renamed = updateGroupName(group, '  República Central ');
    expect(renamed.name).toBe('República Central');
  });

  it('adds a participant with default weight 1 to the group', () => {
    const group = createGroup({ id: 'grp_1', name: 'Churrasco' });
    const updated = addParticipant(group, { id: 'p_alice', name: '  Alice  ' });

    expect(updated.participants).toEqual([
      {
        id: 'p_alice',
        name: 'Alice',
        defaultWeight: 1,
      },
    ]);
  });

  it('adds a participant with custom positive weight (e.g., weight 2 for couple/adult)', () => {
    const group = createGroup({ id: 'grp_1', name: 'Cabana Serra' });
    const updated = addParticipant(group, {
      id: 'p_casal',
      name: 'Bruno & Clara',
      defaultWeight: 2,
    });

    expect(updated.participants[0]?.defaultWeight).toBe(2);
  });

  it('updates participant name and default weight cleanly', () => {
    let group = createGroup({ id: 'grp_1', name: 'Viagem' });
    group = addParticipant(group, { id: 'p_1', name: 'Alice', defaultWeight: 1 });
    group = addParticipant(group, { id: 'p_2', name: 'Bruno', defaultWeight: 1 });

    const updated = updateParticipant(group, {
      participantId: 'p_1',
      name: 'Alice Silva',
      defaultWeight: 2,
    });

    expect(updated.participants[0]).toEqual({
      id: 'p_1',
      name: 'Alice Silva',
      defaultWeight: 2,
    });
  });

  it('removes a participant when they have no linked expenses or settlements', () => {
    let group = createGroup({ id: 'grp_1', name: 'Viagem' });
    group = addParticipant(group, { id: 'p_1', name: 'Alice' });
    group = addParticipant(group, { id: 'p_2', name: 'Bruno' });

    const afterRemoval = removeParticipant(group, 'p_1', [], []);
    expect(afterRemoval.participants).toHaveLength(1);
    expect(afterRemoval.participants[0]?.id).toBe('p_2');
  });
});
