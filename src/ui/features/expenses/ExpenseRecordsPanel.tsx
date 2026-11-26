import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  exportExpensesCsv, exportProjectJson, exportProjectText, filterExpenses,
} from '../../../domain/export/exporter';
import { formatOriginalCurrencyBadge } from '../../../domain/ledger/multiCurrencyExpense';
import { formatCurrency, isCurrencyCode } from '../../../domain/money/money';
import type { Expense, ExpenseCategory, GroupLedgerState } from '../../../domain/types';

export const expenseCategoryLabels = {
  FOOD: 'Alimentação',
  ACCOMMODATION: 'Hospedagem',
  TRANSPORT: 'Transporte',
  UTILITIES: 'Contas da casa',
  ENTERTAINMENT: 'Entretenimento',
  OTHER: 'Outros',
} satisfies Record<ExpenseCategory, string>;

interface ExpenseRecordsPanelProps {
  project: GroupLedgerState;
  onCreate: () => void;
  onEdit: (expense: Expense) => void;
  onRemove: (expense: Expense) => void;
}

function downloadReport(filename: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url));
}

export function ExpenseRecordsPanel({ project, onCreate, onEdit, onRemove }: ExpenseRecordsPanelProps) {
  const { group, expenses } = project;
  const [participantId, setParticipantId] = useState('');
  const [category, setCategory] = useState<ExpenseCategory | ''>('');
  const [search, setSearch] = useState('');
  const [reportError, setReportError] = useState('');
  const filtered = filterExpenses(expenses, { participantId, category, search });
  const totalSpent = expenses.reduce((total, expense) => total + expense.amountCents, 0);

  function downloadSummary() {
    try {
      downloadReport('splitpay-resumo.txt', 'text/plain;charset=utf-8', exportProjectText(project));
      setReportError('');
    } catch {
      setReportError('Revise os saldos do projeto antes de exportar o resumo.');
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Despesas do projeto</h2>
          <p className="text-sm text-slate-600">
            Total gasto <strong data-testid="expense-total-spent">
              {Number.isSafeInteger(totalSpent) ? formatCurrency(totalSpent, group.baseCurrency) : '—'}
            </strong>
          </p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Nova despesa
        </button>
      </div>

      {expenses.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="space-y-1 text-xs font-semibold text-slate-700">
            <span>Filtrar por participante</span>
            <select value={participantId} onChange={(event) => setParticipantId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5">
              <option value="">Todos</option>
              {group.participants.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-700">
            <span>Tipo de despesa</span>
            <select value={category} onChange={(event) => setCategory(event.target.value as ExpenseCategory | '')}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5">
              <option value="">Todos</option>
              {Object.entries(expenseCategoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-700">
            <span>Buscar despesas</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5" />
          </label>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">
          {expenses.length === 0 ? 'Nenhuma despesa registrada.' : 'Nenhuma despesa corresponde aos filtros.'}
        </p>
      ) : (
        <ul data-testid="expense-list" className="divide-y divide-slate-100">
          {filtered.map((expense) => (
            <li key={expense.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <div>
                <p className="font-semibold text-slate-800">{expense.description}</p>
                <p className="text-xs text-slate-600">
                  {expenseCategoryLabels[expense.category]} · {formatCurrency(expense.amountCents, group.baseCurrency)}
                </p>
                {typeof expense.originalAmountCents === 'number' &&
                  Number.isSafeInteger(expense.originalAmountCents) &&
                  isCurrencyCode(expense.currency) && (
                    <p className="text-xs font-semibold text-indigo-700">
                      {formatOriginalCurrencyBadge(expense.originalAmountCents, expense.currency, expense.exchangeRate)}
                    </p>
                  )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Editar despesa ${expense.description}`}
                  onClick={() => onEdit(expense)}
                  className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Excluir despesa ${expense.description}`}
                  onClick={() => onRemove(expense)}
                  className="rounded-lg p-2 text-rose-700 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 text-xs font-semibold text-indigo-700">
        <button type="button" className="rounded-lg border border-slate-200 px-3 py-2"
          onClick={() => downloadReport('splitpay-despesas.csv', 'text/csv;charset=utf-8', exportExpensesCsv(filtered, group.baseCurrency))}>
          Baixar CSV da lista
        </button>
        <button type="button" className="rounded-lg border border-slate-200 px-3 py-2" onClick={downloadSummary}>
          Baixar resumo em texto
        </button>
        <button type="button" className="rounded-lg border border-slate-200 px-3 py-2"
          onClick={() => downloadReport('splitpay-projeto.json', 'application/json', exportProjectJson(project))}>
          Baixar backup JSON
        </button>
      </div>
      {reportError && <p role="alert" className="text-sm text-rose-700">{reportError}</p>}
    </section>
  );
}
