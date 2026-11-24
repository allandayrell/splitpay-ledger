import { describe, expect, it } from 'vitest';
import { calculateExactSplit } from './exactAndSharesSplit';
import { DomainValidationError } from '../errors';
import type { Participant } from '../types';

const sampleParticipants: Participant[] = [
  { id: 'p_alice', name: 'Alice', defaultWeight: 2 },
  { id: 'p_bruno', name: 'Bruno', defaultWeight: 1 },
  { id: 'p_carla', name: 'Carla', defaultWeight: 1 },
];

describe('Exact & Weighted Shares Split Engine', () => {
  it('splits expense by exact fixed amounts when sum matches total expense amount', () => {
    const splits = calculateExactSplit(10000, sampleParticipants, [
      { participantId: 'p_alice', value: 4500 },
      { participantId: 'p_bruno', value: 3500 },
      { participantId: 'p_carla', value: 2000 },
    ]);

    expect(splits).toEqual([
      { participantId: 'p_alice', amountCents: 4500 },
      { participantId: 'p_bruno', amountCents: 3500 },
      { participantId: 'p_carla', amountCents: 2000 },
    ]);
  });

  it('rejects exact fixed split when sum of shares is less than total expense', () => {
    expect(() =>
      calculateExactSplit(10000, sampleParticipants, [
        { participantId: 'p_alice', value: 4000 },
        { participantId: 'p_bruno', value: 4000 },
      ]),
    ).toThrow(DomainValidationError);
  });

  it('rejects exact fixed split when sum of shares exceeds total expense', () => {
    expect(() =>
      calculateExactSplit(10000, sampleParticipants, [
        { participantId: 'p_alice', value: 6000 },
        { participantId: 'p_bruno', value: 5000 },
      ]),
    ).toThrow(DomainValidationError);
  });

  it('rejects exact fixed split containing negative share amounts or non-positive totals', () => {
    expect(() =>
      calculateExactSplit(10000, sampleParticipants, [
        { participantId: 'p_alice', value: 12000 },
        { participantId: 'p_bruno', value: -2000 },
      ]),
    ).toThrow(DomainValidationError);

    expect(() =>
      calculateExactSplit(0, sampleParticipants, [{ participantId: 'p_alice', value: 0 }]),
    ).toThrow(DomainValidationError);
  });
});
