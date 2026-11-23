import { describe, expect, it } from 'vitest';
import { calculateExactSplit, calculateWeightedSharesSplit } from './exactAndSharesSplit';
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

  it('splits expense proportionally by participant weights/shares', () => {
    const splitsUsingDefaults = calculateWeightedSharesSplit(10000, sampleParticipants, [
      { participantId: 'p_alice' },
      { participantId: 'p_bruno' },
      { participantId: 'p_carla' },
    ]);

    expect(splitsUsingDefaults).toEqual([
      { participantId: 'p_alice', amountCents: 5000 },
      { participantId: 'p_bruno', amountCents: 2500 },
      { participantId: 'p_carla', amountCents: 2500 },
    ]);

    const splitsWithCustomWeights = calculateWeightedSharesSplit(10000, sampleParticipants, [
      { participantId: 'p_alice', value: 1 },
      { participantId: 'p_bruno', value: 1 },
      { participantId: 'p_carla', value: 1 },
    ]);

    expect(splitsWithCustomWeights).toEqual([
      { participantId: 'p_alice', amountCents: 3334 },
      { participantId: 'p_bruno', amountCents: 3333 },
      { participantId: 'p_carla', amountCents: 3333 },
    ]);
  });

  it('rejects weighted split when total weight sum is zero, negative, or expense total is invalid', () => {
    expect(() =>
      calculateWeightedSharesSplit(10000, sampleParticipants, [
        { participantId: 'p_alice', value: 0 },
        { participantId: 'p_bruno', value: 0 },
      ]),
    ).toThrow(DomainValidationError);

    expect(() =>
      calculateWeightedSharesSplit(10000, sampleParticipants, [
        { participantId: 'p_alice', value: -1 },
        { participantId: 'p_bruno', value: 2 },
      ]),
    ).toThrow(DomainValidationError);

    expect(() =>
      calculateWeightedSharesSplit(0, sampleParticipants, [{ participantId: 'p_alice', value: 1 }]),
    ).toThrow(DomainValidationError);
  });

  it('rejects any split referencing an unknown or duplicate participant ID or empty participant list', () => {
    expect(() => calculateExactSplit(10000, sampleParticipants, [])).toThrow(DomainValidationError);

    expect(() =>
      calculateWeightedSharesSplit(10000, sampleParticipants, [
        { participantId: 'p_ghost', value: 1 },
      ]),
    ).toThrow(DomainValidationError);

    expect(() =>
      calculateWeightedSharesSplit(10000, sampleParticipants, [
        { participantId: 'p_alice', value: 1 },
        { participantId: 'p_alice', value: 1 },
      ]),
    ).toThrow(DomainValidationError);
  });
});

