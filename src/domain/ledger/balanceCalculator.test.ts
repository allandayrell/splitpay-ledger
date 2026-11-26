import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Expense, GroupLedgerState, SettlementRecord } from '../types';
import { calculateLedgerBalances, removeExpense, saveExpense, validateExpense } from './balanceCalculator';

const createdAt = '2026-11-24T12:00:00.000Z';
const project: GroupLedgerState = {
  group: {
    id: 'viagem',
    name: 'Viagem',
    baseCurrency: 'BRL',
    createdAt,
    participants: [
      { id: 'alice', name: 'Alice', defaultWeight: 1 },
      { id: 'bruno', name: 'Bruno', defaultWeight: 1 },
    ],
  },
  expenses: [],
  settlements: [],
};

function expense(id: string, amountCents = 1000): Expense {
  return {
    id,
    groupId: project.group.id,
    description: '  Despesa de viagem  ',
    category: 'TRANSPORT',
    amountCents,
    currency: 'BRL',
    payers: [{ participantId: 'alice', amountCents }],
    splitType: 'EXACT',
    splits: [{ participantId: 'bruno', amountCents }],
    createdAt,
  };
}

const settlement: SettlementRecord = {
  id: 'acerto',
  groupId: project.group.id,
  fromParticipantId: 'bruno',
  toParticipantId: 'alice',
  amountCents: 250,
  createdAt,
};

describe('Expense ledger', () => {
  it('starts each participant at zero before any activity', () => {
    expect(calculateLedgerBalances(project).map(({ netBalanceCents }) => netBalanceCents)).toEqual([0, 0]);
  });

  it('records several expenses with single or multiple payers without charging an excluded payer', () => {
    const dinner = { ...expense('dinner', 600), category: 'FOOD' as const, payers: [
      { participantId: 'alice', amountCents: 400 },
      { participantId: 'bruno', amountCents: 200 },
    ] };
    const ledger = saveExpense(saveExpense(project, expense('ride')), dinner);

    expect(ledger.expenses.map(({ id }) => id)).toEqual(['dinner', 'ride']);
    expect(ledger.expenses[0]?.description).toBe('Despesa de viagem');
    expect(calculateLedgerBalances(ledger)).toMatchObject([
      { participantId: 'alice', totalPaidCents: 1400, totalOwedCents: 0, netBalanceCents: 1400 },
      { participantId: 'bruno', totalPaidCents: 200, totalOwedCents: 1600, netBalanceCents: -1400 },
    ]);
  });

  it('edits and deletes one record by id while retaining other records and settlement history', () => {
    const ledger = {
      ...saveExpense(saveExpense(project, expense('ride', 1000)), expense('dinner', 600)),
      settlements: [settlement],
    };
    const edited = saveExpense(ledger, expense('ride', 800));
    const remaining = removeExpense(edited, 'dinner');

    expect(remaining.expenses.map(({ id }) => id)).toEqual(['ride']);
    expect(remaining.settlements).toEqual([settlement]);
    expect(calculateLedgerBalances(remaining)).toMatchObject([
      { netBalanceCents: 550, settlementsReceivedCents: 250 },
      { netBalanceCents: -550, settlementsPaidCents: 250 },
    ]);
    expect(ledger.expenses.map(({ amountCents }) => amountCents)).toEqual([600, 1000]);
  });

  it.each([
    [{ groupId: 'other' }, 'WRONG_EXPENSE_GROUP'],
    [{ description: '  ' }, 'EMPTY_EXPENSE_DESCRIPTION'],
    [{ amountCents: 0 }, 'INVALID_EXPENSE_TOTAL'],
    [{ amountCents: 10.2 }, 'INVALID_LEDGER_CENTS'],
    [{ payers: [{ participantId: 'alice', amountCents: 900 }] }, 'PAYER_TOTAL_MISMATCH'],
    [{ splits: [{ participantId: 'bruno', amountCents: 900 }] }, 'SHARE_TOTAL_MISMATCH'],
    [{ payers: [{ participantId: 'missing', amountCents: 1000 }] }, 'UNKNOWN_EXPENSE_PARTICIPANT'],
    [{ splits: [{ participantId: 'bruno', amountCents: -5 }] }, 'NEGATIVE_EXPENSE_SHARE'],
    [{ payers: [
      { participantId: 'alice', amountCents: 800 },
      { participantId: 'alice', amountCents: 200 },
    ] }, 'DUPLICATE_EXPENSE_PARTICIPANT'],
  ] as const)('rejects an invalid expense with %j', (changes, code) => {
    expect(() => validateExpense(project.group, { ...expense('ride'), ...changes } as Expense))
      .toThrow(expect.objectContaining({ code }));
  });

  it('reports an unknown id when removing an expense', () => {
    expect(() => removeExpense(project, 'missing'))
      .toThrow(expect.objectContaining({ code: 'EXPENSE_NOT_FOUND' }));
  });

  it.each([{ groupId: 'other' }, { toParticipantId: 'bruno' }])('rejects a malformed settlement', (change) => {
    expect(() => calculateLedgerBalances({ ...project, settlements: [{ ...settlement, ...change }] }))
      .toThrow(expect.objectContaining({ code: 'INVALID_LEDGER_SETTLEMENT' }));
  });

  it('conserves net balances across sequences of valid expenses', () => {
    fc.assert(fc.property(fc.array(fc.nat({ max: 5000 }), { maxLength: 20 }), (amounts) => {
      const ledger = amounts.reduce(
        (current, amount, index) => saveExpense(current, expense(String(index), amount + 1)),
        project,
      );
      const balances = calculateLedgerBalances(ledger);
      expect(balances.reduce((sum, { netBalanceCents }) => sum + netBalanceCents, 0)).toBe(0);
    }));
  });
});
