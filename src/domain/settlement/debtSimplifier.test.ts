import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  applySettlementsToBalances,
  createSettlementRecord,
  simplifyDebts,
} from './debtSimplifier';
import { DomainValidationError } from '../errors';
import type { Group } from '../types';

const sampleGroup: Group = {
  id: 'grp_1',
  name: 'Viagem',
  baseCurrency: 'BRL',
  participants: [
    { id: 'p_alice', name: 'Alice', defaultWeight: 1 },
    { id: 'p_bruno', name: 'Bruno', defaultWeight: 1 },
    { id: 'p_carla', name: 'Carla', defaultWeight: 1 },
    { id: 'p_diego', name: 'Diego', defaultWeight: 1 },
  ],
  createdAt: '2026-11-23T19:00:00.000Z',
};

describe('Debt Simplifier & Settlement Engine', () => {
  it('returns no transfers when all participants are already settled (zero balances)', () => {
    const transfers = simplifyDebts([
      { participantId: 'p_alice', netBalanceCents: 0 },
      { participantId: 'p_bruno', netBalanceCents: 0 },
      { participantId: 'p_carla', netBalanceCents: 0 },
    ]);

    expect(transfers).toEqual([]);
  });

  it('generates a single transfer when there is one debtor and one creditor', () => {
    const transfers = simplifyDebts([
      { participantId: 'p_alice', netBalanceCents: 5000 },
      { participantId: 'p_bruno', netBalanceCents: -5000 },
    ]);

    expect(transfers).toEqual([
      {
        fromParticipantId: 'p_bruno',
        toParticipantId: 'p_alice',
        amountCents: 5000,
      },
    ]);
  });

  it('generates N-1 transfers when one creditor paid for multiple debtors', () => {
    const transfers = simplifyDebts([
      { participantId: 'p_alice', netBalanceCents: 6000 },
      { participantId: 'p_bruno', netBalanceCents: -2000 },
      { participantId: 'p_carla', netBalanceCents: -4000 },
    ]);

    expect(transfers).toEqual([
      { fromParticipantId: 'p_carla', toParticipantId: 'p_alice', amountCents: 4000 },
      { fromParticipantId: 'p_bruno', toParticipantId: 'p_alice', amountCents: 2000 },
    ]);
  });

  it('generates N-1 transfers when multiple creditors are owed by a single debtor', () => {
    const transfers = simplifyDebts([
      { participantId: 'p_alice', netBalanceCents: 3500 },
      { participantId: 'p_bruno', netBalanceCents: 1500 },
      { participantId: 'p_carla', netBalanceCents: -5000 },
    ]);

    expect(transfers).toEqual([
      { fromParticipantId: 'p_carla', toParticipantId: 'p_alice', amountCents: 3500 },
      { fromParticipantId: 'p_carla', toParticipantId: 'p_bruno', amountCents: 1500 },
    ]);
  });

  it('eliminates circular debts completely when net balances cancel out (A -> B -> C -> A)', () => {
    const netAfterCycle = [
      { participantId: 'p_alice', netBalanceCents: 5000 - 5000 },
      { participantId: 'p_bruno', netBalanceCents: 5000 - 5000 },
      { participantId: 'p_carla', netBalanceCents: 5000 - 5000 },
    ];

    expect(simplifyDebts(netAfterCycle)).toEqual([]);
  });

  it('simplifies transitive debt chains (A owes B R$ 50, B owes C R$ 50 -> A transfers R$ 50 directly to C)', () => {
    const transitiveNetBalances = [
      { participantId: 'p_alice', netBalanceCents: -5000 },
      { participantId: 'p_bruno', netBalanceCents: 5000 - 5000 },
      { participantId: 'p_carla', netBalanceCents: 5000 },
    ];

    const transfers = simplifyDebts(transitiveNetBalances);
    expect(transfers).toEqual([
      { fromParticipantId: 'p_alice', toParticipantId: 'p_carla', amountCents: 5000 },
    ]);
  });

  it('applies deterministic tie-breaking by participant ID when two creditors or debtors have identical balances', () => {
    const tiedBalances = [
      { participantId: 'p_diego', netBalanceCents: -3000 },
      { participantId: 'p_bruno', netBalanceCents: -3000 },
      { participantId: 'p_carla', netBalanceCents: 3000 },
      { participantId: 'p_alice', netBalanceCents: 3000 },
    ];

    const transfers = simplifyDebts(tiedBalances);
    expect(transfers).toEqual([
      { fromParticipantId: 'p_bruno', toParticipantId: 'p_alice', amountCents: 3000 },
      { fromParticipantId: 'p_diego', toParticipantId: 'p_carla', amountCents: 3000 },
    ]);
  });

  it('recalculates remaining simplified transfers after a suggested transfer is marked as settled/paid', () => {
    const initialBalances = [
      { participantId: 'p_alice', netBalanceCents: 6000 },
      { participantId: 'p_bruno', netBalanceCents: -2500 },
      { participantId: 'p_carla', netBalanceCents: -3500 },
    ];

    const settlement = createSettlementRecord(sampleGroup, {
      id: 'set_1',
      groupId: 'grp_1',
      fromParticipantId: 'p_carla',
      toParticipantId: 'p_alice',
      amountCents: 3500,
    });

    const updatedBalances = applySettlementsToBalances(initialBalances, [settlement]);
    const remainingTransfers = simplifyDebts(updatedBalances);

    expect(remainingTransfers).toEqual([
      { fromParticipantId: 'p_bruno', toParticipantId: 'p_alice', amountCents: 2500 },
    ]);

    expect(() =>
      simplifyDebts([
        { participantId: 'p_alice', netBalanceCents: 1000 },
        { participantId: 'p_bruno', netBalanceCents: -500 },
      ]),
    ).toThrow(DomainValidationError);

    expect(() =>
      createSettlementRecord(sampleGroup, {
        groupId: 'grp_1',
        fromParticipantId: 'p_alice',
        toParticipantId: 'p_alice',
        amountCents: 1000,
      }),
    ).toThrow(DomainValidationError);

    expect(() =>
      createSettlementRecord(sampleGroup, {
        groupId: 'grp_1',
        fromParticipantId: 'p_alice',
        toParticipantId: 'p_bruno',
        amountCents: 0,
      }),
    ).toThrow(DomainValidationError);

    expect(() =>
      createSettlementRecord(sampleGroup, {
        groupId: 'grp_1',
        fromParticipantId: 'p_alice',
        toParticipantId: 'p_ghost',
        amountCents: 1000,
      }),
    ).toThrow(DomainValidationError);

    expect(() =>
      applySettlementsToBalances(initialBalances, [
        { ...settlement, fromParticipantId: 'p_ghost' },
      ]),
    ).toThrow(DomainValidationError);

    expect(() =>
      applySettlementsToBalances(initialBalances, [{ ...settlement, amountCents: 0 }]),
    ).toThrow(DomainValidationError);
  });

  it('produces at most N-1 positive transfers that completely zero out all balances for any zero-sum balance vector', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -500_000, max: 500_000 }), { minLength: 2, maxLength: 15 }),
        (rawValues) => {
          const partialSum = rawValues.slice(0, -1).reduce((acc, v) => acc + v, 0);
          const zeroSumVector = [...rawValues.slice(0, -1), -partialSum];

          const balances = zeroSumVector.map((netBalanceCents, idx) => ({
            participantId: `p_${String(idx + 1).padStart(2, '0')}`,
            netBalanceCents,
          }));

          const transfers = simplifyDebts(balances);

          if (transfers.length > balances.length - 1) {
            return false;
          }

          const simulatedSettlements = transfers.map((t, index) => ({
            id: `set_${index}`,
            groupId: 'grp_prop',
            fromParticipantId: t.fromParticipantId,
            toParticipantId: t.toParticipantId,
            amountCents: t.amountCents,
            createdAt: '2026-11-24T10:00:00.000Z',
          }));

          const postSettlementBalances = applySettlementsToBalances(
            balances,
            simulatedSettlements,
          );

          return postSettlementBalances.every((entry) => entry.netBalanceCents === 0);
        },
      ),
    );
  });
});


