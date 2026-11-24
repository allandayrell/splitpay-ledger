import { describe, expect, it } from 'vitest';
import {
  addParticipant,
  createGroup,
  removeParticipant,
  updateGroupName,
  updateParticipant,
} from './group';
import { DomainValidationError } from '../errors';
import type { Expense, SettlementRecord } from '../types';

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

  it('rejects group creation or renaming when name is empty or whitespace only', () => {
    expect(() => createGroup({ name: '' })).toThrow(DomainValidationError);
    expect(() => createGroup({ name: '   ' })).toThrow(DomainValidationError);

    const group = createGroup({ name: 'Viagem' });
    expect(() => updateGroupName(group, '   ')).toThrow(DomainValidationError);
  });

  it('rejects adding or updating a participant with empty name', () => {
    let group = createGroup({ name: 'Viagem' });
    expect(() => addParticipant(group, { name: '   ' })).toThrow(DomainValidationError);

    group = addParticipant(group, { id: 'p_1', name: 'Alice' });
    expect(() => updateParticipant(group, { participantId: 'p_1', name: '  ' })).toThrow(
      DomainValidationError,
    );
  });

  it('rejects adding or updating a participant with duplicate normalized name in the same group', () => {
    let group = createGroup({ name: 'Viagem' });
    group = addParticipant(group, { id: 'p_1', name: 'Alice' });
    group = addParticipant(group, { id: 'p_2', name: 'Bruno' });

    expect(() => addParticipant(group, { name: '  ALICE  ' })).toThrow(DomainValidationError);
    expect(() => updateParticipant(group, { participantId: 'p_2', name: 'alice' })).toThrow(
      DomainValidationError,
    );
  });

  it('rejects adding or updating a participant with zero or negative default weight', () => {
    let group = createGroup({ name: 'Viagem' });
    expect(() => addParticipant(group, { name: 'Alice', defaultWeight: 0 })).toThrow(
      DomainValidationError,
    );
    expect(() => addParticipant(group, { name: 'Alice', defaultWeight: -2 })).toThrow(
      DomainValidationError,
    );

    group = addParticipant(group, { id: 'p_1', name: 'Alice', defaultWeight: 1 });
    expect(() => updateParticipant(group, { participantId: 'p_1', defaultWeight: 0 })).toThrow(
      DomainValidationError,
    );
    expect(() => updateParticipant(group, { participantId: 'p_unknown', name: 'Zé' })).toThrow(
      DomainValidationError,
    );
  });

  it('prevents removing a participant who is already referenced in an active expense or settlement', () => {
    let group = createGroup({ id: 'grp_1', name: 'Viagem' });
    group = addParticipant(group, { id: 'p_1', name: 'Alice' });
    group = addParticipant(group, { id: 'p_2', name: 'Bruno' });

    const sampleExpense: Expense = {
      id: 'exp_1',
      groupId: 'grp_1',
      description: 'Hotel',
      category: 'ACCOMMODATION',
      amountCents: 20000,
      currency: 'BRL',
      payers: [{ participantId: 'p_1', amountCents: 20000 }],
      splitType: 'EQUAL',
      splits: [
        { participantId: 'p_1', amountCents: 10000 },
        { participantId: 'p_2', amountCents: 10000 },
      ],
      createdAt: '2026-11-23T19:00:00.000Z',
    };

    const sampleSettlement: SettlementRecord = {
      id: 'set_1',
      groupId: 'grp_1',
      fromParticipantId: 'p_2',
      toParticipantId: 'p_1',
      amountCents: 10000,
      createdAt: '2026-11-23T19:30:00.000Z',
    };

    expect(() => removeParticipant(group, 'p_1', [sampleExpense], [])).toThrow(
      DomainValidationError,
    );
    expect(() => removeParticipant(group, 'p_2', [], [sampleSettlement])).toThrow(
      DomainValidationError,
    );
    expect(() => removeParticipant(group, 'p_unknown', [], [])).toThrow(DomainValidationError);
  });
});

