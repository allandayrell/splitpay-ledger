import { describe, expect, it } from 'vitest';
import type { Expense, GroupLedgerState } from '../types';
import { exportExpensesCsv, exportProjectJson, exportProjectText, filterExpenses } from './exporter';

const createdAt = '2026-11-24T12:00:00.000Z';
const food: Expense = {
  id: 'dinner',
  groupId: 'trip',
  description: 'Café, "especial"\nMesa 2',
  category: 'FOOD',
  amountCents: 1200,
  currency: 'BRL',
  payers: [{ participantId: 'ana', amountCents: 1200 }],
  splitType: 'EXACT',
  splits: [{ participantId: 'bia', amountCents: 1200 }],
  createdAt,
};
const hotel: Expense = {
  ...food,
  id: 'hotel',
  description: 'Hospedagem',
  category: 'ACCOMMODATION',
  payers: [{ participantId: 'bia', amountCents: 1200 }],
  splits: [{ participantId: 'bia', amountCents: 1200 }],
};
const project: GroupLedgerState = {
  group: {
    id: 'trip',
    name: 'Viagem',
    baseCurrency: 'BRL',
    participants: [
      { id: 'ana', name: 'Ana', defaultWeight: 1 },
      { id: 'bia', name: 'Bia', defaultWeight: 1 },
    ],
    createdAt,
  },
  expenses: [food, hotel],
  settlements: [],
};

describe('Expense reports', () => {
  it('finds expenses in which a participant paid or was charged', () => {
    expect(filterExpenses(project.expenses, { participantId: 'ana' })).toEqual([food]);
    expect(filterExpenses(project.expenses, { participantId: 'bia' })).toEqual([food, hotel]);
    expect(filterExpenses(project.expenses, { participantId: 'unknown' })).toEqual([]);
  });

  it('finds a selected participant whose share rounded to zero', () => {
    const expense = { ...hotel, splitInputs: [{ participantId: 'ana' }, { participantId: 'bia' }] };
    expect(filterExpenses([expense], { participantId: 'ana' })).toEqual([expense]);
  });

  it('combines category and accent-insensitive search without changing source expenses', () => {
    expect(filterExpenses(project.expenses, {})).toEqual([food, hotel]);
    expect(filterExpenses(project.expenses, { category: 'FOOD', search: ' CAFE ' })).toEqual([food]);
    expect(filterExpenses(project.expenses, { category: 'FOOD', search: 'Hospedagem' })).toEqual([]);
  });

  it('escapes commas, line breaks and double quotes in CSV', () => {
    const csv = exportExpensesCsv([food], 'BRL');
    expect(csv).toContain(`"Café, ""especial""\nMesa 2",FOOD,${createdAt},12.00,BRL,,,\r\n`);
  });

  it('preserves exchange metadata and neutralizes spreadsheet formulas in text cells', () => {
    const csv = exportExpensesCsv([{
      ...food,
      description: '=CUSTO',
      currency: 'USD',
      originalAmountCents: 200,
      exchangeRate: 6,
    }], 'BRL');
    expect(csv).toContain(`'=CUSTO,FOOD,${createdAt},12.00,BRL,2.00,USD,6\r\n`);
  });

  it('reports total spend, net balances and suggested transfers', () => {
    const text = exportProjectText(project);
    expect(text).toContain('Total gasto R$ 24,00');
    expect(text).toContain('Ana · R$ 12,00');
    expect(text).toContain('Bia · -R$ 12,00');
    expect(text).toContain('Bia transfere R$ 12,00 para Ana');
  });

  it('formats a foreign base currency and shows when no transfers are pending', () => {
    const text = exportProjectText({
      ...project,
      group: { ...project.group, baseCurrency: 'USD' },
      expenses: [{ ...hotel, currency: 'USD' }],
    });
    expect(text).toMatch(/Total gasto US\$\s+12,00/);
    expect(text).toContain('Sem transferências pendentes.');
  });

  it('exports the complete project without mutating it', () => {
    expect(JSON.parse(exportProjectJson(project))).toEqual(project);
  });
});
