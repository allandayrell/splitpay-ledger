import { describe, expect, it } from 'vitest';
import { simplifyDebts } from './debtSimplifier';

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
});
