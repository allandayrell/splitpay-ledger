import { Globe } from 'lucide-react';
import {
  formatOriginalCurrencyBadge,
  normalizeExpenseCurrencyAmount,
} from '../../../domain/ledger/multiCurrencyExpense';
import { formatBRL, toCents } from '../../../domain/money/money';
import type { CurrencyCode } from '../../../domain/types';

export interface MultiCurrencySelectorProps {
  rawAmount: string;
  currency: CurrencyCode;
  rawExchangeRate: string;
  amountInputId?: string;
  onChangeAmount: (value: string) => void;
  onChangeCurrency: (currency: CurrencyCode) => void;
  onChangeExchangeRate: (rate: string) => void;
}

const CURRENCIES: { code: CurrencyCode; label: string }[] = [
  { code: 'BRL', label: 'BRL (R$ - Real)' },
  { code: 'USD', label: 'USD (US$ - Dólar)' },
  { code: 'EUR', label: 'EUR (€ - Euro)' },
  { code: 'GBP', label: 'GBP (£ - Libra)' },
];

export function MultiCurrencySelector({
  rawAmount,
  currency,
  rawExchangeRate,
  amountInputId = 'expense-amount-input',
  onChangeAmount,
  onChangeCurrency,
  onChangeExchangeRate,
}: MultiCurrencySelectorProps) {
  let convertedPreview: string | null = null;
  let originalBadge: string | null = null;
  let validationMessage: string | null = null;

  try {
    if (rawAmount.trim()) {
      const rawCents = toCents(rawAmount);
      const rate = currency === 'BRL' ? undefined : Number(rawExchangeRate.replace(',', '.'));
      const normalized = normalizeExpenseCurrencyAmount({
        amountCents: rawCents,
        currency,
        exchangeRate: rate,
      });
      convertedPreview = formatBRL(normalized.amountCents);
      if (normalized.originalAmountCents !== undefined) {
        originalBadge = formatOriginalCurrencyBadge(
          normalized.originalAmountCents,
          normalized.currency,
          normalized.exchangeRate,
        );
      }
    }
  } catch {
    if (currency !== 'BRL') {
      validationMessage = 'Informe um valor e uma taxa de câmbio positivos que resultem em pelo menos um centavo.';
    }
  }

  return (
    <div
      data-testid="multi-currency-selector"
      className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
    >
      <div className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wider text-slate-600 uppercase">
        <Globe className="h-4 w-4 text-indigo-600" />
        Valor & Moeda da Despesa
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label
            htmlFor="expense-currency-select"
            className="mb-1 block text-xs font-medium text-slate-600"
          >
            Moeda
          </label>
          <select
            id="expense-currency-select"
            data-testid="expense-currency-select"
            value={currency}
            onChange={(e) => onChangeCurrency(e.target.value as CurrencyCode)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-indigo-500 focus:outline-none"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={amountInputId}
            className="mb-1 block text-xs font-medium text-slate-600"
          >
            Valor ({currency})
          </label>
          <input
            id={amountInputId}
            data-testid={amountInputId}
            type="number"
            step="0.01"
            min="0.01"
            value={rawAmount}
            onChange={(e) => onChangeAmount(e.target.value)}
            placeholder="100.00"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {currency !== 'BRL' ? (
          <div>
            <label
              htmlFor="expense-exchange-rate-input"
              className="mb-1 block text-xs font-medium text-slate-600"
            >
              Taxa de Câmbio (1 {currency} → BRL)
            </label>
            <input
              id="expense-exchange-rate-input"
              data-testid="expense-exchange-rate-input"
              type="number"
              step="any"
              min="0"
              value={rawExchangeRate}
              onChange={(e) => onChangeExchangeRate(e.target.value)}
              placeholder="5.50"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        ) : null}
      </div>

      {validationMessage && <p role="alert" className="text-xs text-rose-700">{validationMessage}</p>}
      {convertedPreview && currency !== 'BRL' ? (
        <div
          data-testid="currency-conversion-preview"
          className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-900"
        >
          <span>
            Valor contabilizado no Ledger (BRL): <strong>{convertedPreview}</strong>
          </span>
          {originalBadge ? (
            <span
              data-testid="original-currency-badge"
              className="rounded-md bg-white px-2 py-0.5 font-semibold text-indigo-700 shadow-2xs"
            >
              {originalBadge}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
