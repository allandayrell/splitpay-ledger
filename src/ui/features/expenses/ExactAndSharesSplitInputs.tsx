import { AlertCircle, CheckCircle2, Scale } from 'lucide-react';
import { formatCurrency } from '../../../domain/money/money';
import { calculateExpenseSplit } from '../../../domain/split/splitEngine';
import type { Cents, CurrencyCode, ExpenseSplit, Participant, SplitType } from '../../../domain/types';
import { buildSplitInputs, splitModeLabels } from './expenseSplitForm';

export type AdvancedSplitMode = SplitType;

export interface ExactAndSharesSplitInputsProps {
  currency: CurrencyCode;
  mode: AdvancedSplitMode;
  totalAmountCents: Cents;
  participants: readonly Participant[];
  valuesByParticipant: Record<string, string>;
  excludedParticipantIds: readonly string[];
  onChangeValue: (participantId: string, rawValue: string) => void;
  onToggleParticipant: (participantId: string, included: boolean) => void;
}

export function ExactAndSharesSplitInputs({
  currency,
  mode,
  totalAmountCents,
  participants,
  valuesByParticipant,
  excludedParticipantIds,
  onChangeValue,
  onToggleParticipant,
}: ExactAndSharesSplitInputsProps) {
  let previewSplits: ExpenseSplit[] = [];
  let validationError: string | null = null;

  try {
    if (totalAmountCents <= 0) {
      validationError = 'Informe um valor total da despesa maior que zero.';
    } else {
      const inputs = buildSplitInputs(mode, participants, valuesByParticipant, excludedParticipantIds);
      previewSplits = calculateExpenseSplit(totalAmountCents, participants, mode, inputs);
    }
  } catch (err) {
    validationError = err instanceof Error ? err.message : 'Configuração de divisão inválida.';
  }

  const previewMap = new Map(previewSplits.map((s) => [s.participantId, s.amountCents]));

  return (
    <div data-testid="advanced-split-inputs" className="space-y-4">
      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <Scale className="h-4 w-4 text-indigo-600" />
          {splitModeLabels[mode]}
        </span>
        <span>Total da Despesa {formatCurrency(Math.max(0, totalAmountCents), currency)}</span>
      </div>

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {participants.map((participant) => {
          const defaultPlaceholder = mode === 'SHARES' ? String(participant.defaultWeight) : '0,00';
          const currentVal = valuesByParticipant[participant.id] ?? '';
          const calculatedCents = previewMap.get(participant.id) ?? 0;
          const included = !excludedParticipantIds.includes(participant.id);

          return (
            <div
              key={participant.id}
              data-testid={`advanced-split-row-${participant.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <input
                    type="checkbox"
                    aria-label={`Incluir ${participant.name} no rateio`}
                    checked={included}
                    onChange={(event) => onToggleParticipant(participant.id, event.target.checked)}
                  />
                  {participant.name}
                </label>
                <p
                  data-testid={`split-preview-amount-${participant.id}`}
                  className="text-xs text-slate-500"
                >
                  Cota calculada <strong className="text-slate-700">{formatCurrency(calculatedCents, currency)}</strong>
                </p>
              </div>

              {mode !== 'EQUAL' && <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">
                  {mode === 'EXACT' ? currency : mode === 'PERCENTAGE' ? '%' : 'Peso'}
                </span>
                <input
                  data-testid={`split-input-${mode.toLowerCase()}-${participant.id}`}
                  type="number"
                  step={mode === 'SHARES' ? '0.5' : '0.01'}
                  min="0"
                  max={mode === 'PERCENTAGE' ? 100 : undefined}
                  disabled={!included}
                  aria-label={`${splitModeLabels[mode]} de ${participant.name}`}
                  value={currentVal}
                  placeholder={defaultPlaceholder}
                  onChange={(e) => onChangeValue(participant.id, e.target.value)}
                  className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-right text-sm font-medium text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>}
            </div>
          );
        })}
      </div>

      {validationError ? (
        <div
          data-testid="advanced-split-error"
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      ) : (
        <div
          data-testid="advanced-split-valid"
          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            Divisão válida. Soma total distribuída{' '}
            {formatCurrency(totalAmountCents, currency)}.
          </span>
        </div>
      )}
    </div>
  );
}
