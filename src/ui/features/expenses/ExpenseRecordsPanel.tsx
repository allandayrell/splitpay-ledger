import { Pencil, Plus, Trash2 } from 'lucide-react';
import { formatBRL } from '../../../domain/money/money';
import type { Expense, ExpenseCategory } from '../../../domain/types';

export const expenseCategoryLabels = {
  FOOD: 'Alimentação',
  ACCOMMODATION: 'Hospedagem',
  TRANSPORT: 'Transporte',
  UTILITIES: 'Contas da casa',
  ENTERTAINMENT: 'Entretenimento',
  OTHER: 'Outros',
} satisfies Record<ExpenseCategory, string>;

interface ExpenseRecordsPanelProps {
  expenses: readonly Expense[];
  onCreate: () => void;
  onEdit: (expense: Expense) => void;
  onRemove: (expense: Expense) => void;
}

export function ExpenseRecordsPanel({ expenses, onCreate, onEdit, onRemove }: ExpenseRecordsPanelProps) {
  const totalSpent = expenses.reduce((total, expense) => total + expense.amountCents, 0);

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Despesas do projeto</h2>
          <p className="text-sm text-slate-600">
            Total gasto <strong data-testid="expense-total-spent">{formatBRL(totalSpent)}</strong>
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

      {expenses.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma despesa registrada.</p>
      ) : (
        <ul data-testid="expense-list" className="divide-y divide-slate-100">
          {expenses.map((expense) => (
            <li key={expense.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <div>
                <p className="font-semibold text-slate-800">{expense.description}</p>
                <p className="text-xs text-slate-600">
                  {expenseCategoryLabels[expense.category]} · {formatBRL(expense.amountCents)}
                </p>
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
    </section>
  );
}
