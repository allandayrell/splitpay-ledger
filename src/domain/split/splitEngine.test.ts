import { describe, expect, it } from 'vitest';
import type { Participant } from '../types';
import { calculateExpenseSplit, percentageToBasisPoints } from './splitEngine';

const participants: Participant[] = [
  { id: 'alice', name: 'Alice', defaultWeight: 2 },
  { id: 'bruno', name: 'Bruno', defaultWeight: 1 },
  { id: 'carla', name: 'Carla', defaultWeight: 1 },
];
const allParticipants = participants.map(({ id }) => ({ participantId: id }));

describe('Expense split strategies', () => {
  it('gives spare cents to the first selected participants, in order', () => {
    expect(calculateExpenseSplit(101, participants, 'EQUAL', allParticipants)).toEqual([
      { participantId: 'alice', amountCents: 34 },
      { participantId: 'bruno', amountCents: 34 },
      { participantId: 'carla', amountCents: 33 },
    ]);
  });

  it('splits only among the explicitly selected participants', () => {
    const selected = [{ participantId: 'alice' }, { participantId: 'carla' }];
    expect(calculateExpenseSplit(101, participants, 'EQUAL', selected)).toEqual([
      { participantId: 'alice', amountCents: 51 },
      { participantId: 'carla', amountCents: 50 },
    ]);
  });

  it('omits zero-value shares when there are fewer cents than participants', () => {
    expect(calculateExpenseSplit(1, participants, 'EQUAL', allParticipants)).toEqual([
      { participantId: 'alice', amountCents: 1 },
    ]);
  });

  it('requires at least one known participant', () => {
    expect(() => calculateExpenseSplit(100, participants, 'EQUAL', [])).toThrow(
      expect.objectContaining({ code: 'EMPTY_SPLIT_PARTICIPANTS' }),
    );
    expect(() => calculateExpenseSplit(100, participants, 'EQUAL', [{ participantId: 'unknown' }]))
      .toThrow(expect.objectContaining({ code: 'UNKNOWN_SPLIT_PARTICIPANT' }));
  });

  it('conserves cents for fractional percentages with deterministic remainders', () => {
    const inputs = allParticipants.map((entry, index) => ({
      ...entry, value: [3333, 3333, 3334][index],
    }));
    expect(calculateExpenseSplit(100, participants, 'PERCENTAGE', inputs)).toEqual([
      { participantId: 'alice', amountCents: 34 },
      { participantId: 'bruno', amountCents: 33 },
      { participantId: 'carla', amountCents: 33 },
    ]);
  });

  it('supports a participant with a zero percentage', () => {
    expect(calculateExpenseSplit(100, participants, 'PERCENTAGE', [
      { participantId: 'alice', value: 10_000 },
      { participantId: 'bruno' },
    ])).toEqual([{ participantId: 'alice', amountCents: 100 }]);
  });

  it.each([9900, 10_001])('rejects a total of %i basis points', (total) => {
    expect(() => calculateExpenseSplit(100, participants, 'PERCENTAGE', [
      { participantId: 'alice', value: 5000 },
      { participantId: 'bruno', value: total - 5000 },
    ])).toThrow(expect.objectContaining({ code: 'PERCENTAGE_SUM_MISMATCH' }));
  });

  it.each([-1, 4.5, 10_001])('rejects %s as an individual percentage in basis points', (value) => {
    expect(() => calculateExpenseSplit(100, participants, 'PERCENTAGE', [
      { participantId: 'alice', value },
    ])).toThrow(expect.objectContaining({ code: 'INVALID_PERCENTAGE' }));
  });

  it('continues to accept exact amounts and default participant weights', () => {
    expect(calculateExpenseSplit(100, participants, 'EXACT', [
      { participantId: 'alice', value: 70 },
      { participantId: 'bruno', value: 30 },
    ])).toEqual([
      { participantId: 'alice', amountCents: 70 },
      { participantId: 'bruno', amountCents: 30 },
    ]);
    expect(calculateExpenseSplit(100, participants, 'SHARES', allParticipants)).toEqual([
      { participantId: 'alice', amountCents: 50 },
      { participantId: 'bruno', amountCents: 25 },
      { participantId: 'carla', amountCents: 25 },
    ]);
  });

  it.each([['33,33', 3333], ['100', 10_000], ['0.5', 50]])(
    'converts %s to exactly %i basis points',
    (raw, value) => expect(percentageToBasisPoints(raw)).toBe(value),
  );

  it('rejects percentage input with excessive precision', () => {
    expect(() => percentageToBasisPoints('33.333'))
      .toThrow(expect.objectContaining({ code: 'INVALID_PERCENTAGE' }));
  });
});
