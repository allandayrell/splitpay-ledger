import { calculateLedgerBalances } from '../ledger/balanceCalculator';
import { formatCurrency } from '../money/money';
import { simplifyDebts } from '../settlement/debtSimplifier';
import type { CurrencyCode, Expense, ExpenseCategory, GroupLedgerState } from '../types';

export interface ExpenseFilters {
  participantId?: string;
  category?: ExpenseCategory | '';
  search?: string;
}

function searchableText(text: string): string {
  return text.trim().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function filterExpenses(expenses: readonly Expense[], filters: ExpenseFilters): Expense[] {
  const search = searchableText(filters.search ?? '');
  return expenses.filter((expense) => {
    if (filters.category && expense.category !== filters.category) return false;
    if (search && !searchableText(expense.description).includes(search)) return false;
    if (!filters.participantId) return true;
    const hasParticipant = ({ participantId }: { participantId: string }) =>
      participantId === filters.participantId;
    return expense.payers.some(hasParticipant) ||
      expense.splits.some(hasParticipant) ||
      (Array.isArray(expense.splitInputs) && expense.splitInputs.some(hasParticipant));
  });
}

function csvCell(value: string): string {
  const safeValue = /^[\t\r]|^\s*[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safeValue) ? `"${safeValue.replaceAll('"', '""')}"` : safeValue;
}

export function exportExpensesCsv(expenses: readonly Expense[], baseCurrency: CurrencyCode): string {
  const rows = [['Descrição', 'Categoria', 'Data', 'Valor', 'Moeda base', 'Valor original', 'Moeda original', 'Câmbio']];
  for (const expense of expenses) {
    const original = expense.originalAmountCents;
    rows.push([
      expense.description,
      expense.category,
      expense.createdAt,
      (expense.amountCents / 100).toFixed(2),
      baseCurrency,
      original === undefined ? '' : (original / 100).toFixed(2),
      original === undefined ? '' : expense.currency,
      expense.exchangeRate?.toString() ?? '',
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function exportProjectText(project: GroupLedgerState): string {
  const { group, expenses } = project;
  const balances = calculateLedgerBalances(project);
  const transfers = simplifyDebts(balances);
  const names = new Map(group.participants.map(({ id, name }) => [id, name]));
  const totalSpent = expenses.reduce((sum, expense) => sum + expense.amountCents, 0);
  const format = (amount: number) => formatCurrency(amount, group.baseCurrency);

  return [
    group.name,
    `Total gasto ${format(totalSpent)}`,
    '',
    'Saldos',
    ...balances.map(({ participantId, netBalanceCents }) => `${names.get(participantId)} · ${format(netBalanceCents)}`),
    '',
    'Transferências sugeridas',
    ...(transfers.length > 0
      ? transfers.map(({ fromParticipantId, toParticipantId, amountCents }) =>
          `${names.get(fromParticipantId)} transfere ${format(amountCents)} para ${names.get(toParticipantId)}`)
      : ['Sem transferências pendentes.']),
    '',
  ].join('\n');
}

export function exportProjectJson(project: GroupLedgerState): string {
  return JSON.stringify(project, null, 2) + '\n';
}
