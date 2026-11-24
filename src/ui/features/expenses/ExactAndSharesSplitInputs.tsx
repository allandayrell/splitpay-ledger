import { AlertCircle, CheckCircle2, Coins, Scale } from 'lucide-react';
import { formatBRL, toCents } from '../../../domain/money/money';
import {
  calculateExactSplit,
  calculateWeightedSharesSplit,
} from '../../../domain/split/exactAndSharesSplit';
import type { Cents, ExpenseSplit, Participant } from '../../../domain/types';

export type AdvancedSplitMode = 'EXACT' | 'SHARES';

export interface ExactAndSharesSplitInputsProps {
  mode: AdvancedSplitMode;
  totalAmountCents: Cents;
  participants: readonly Participant[];
  valuesByParticipant: Record<string, string>;
  onChangeValue: (participantId: string, rawValue: string) => void;
}

export function ExactAndSharesSplitInputs({
  mode,
  totalAmountCents,
  participants,
  valuesByParticipant,
  onChangeValue,
}: ExactAndSharesSplitInputsProps) {
  let previewSplits: ExpenseSplit[] = [];
  let validationError: string | null = null;

  try {
    if (totalAmountCents <= 0) {
      validationError = 'Informe um valor total da despesa maior que R$ 0,00.';
    } else if (mode === 'EXACT') {
      const inputs = participants.map((p) => {
        const raw = valuesByParticipant[p.id] ?? '0';
        const cents = raw.trim() === '' ? 0 : toCents(raw);
        return { participantId: p.id, value: cents };
      });
      previewSplits = calculateExactSplit(totalAmountCents, participants, inputs);
    } else {
      const inputs = participants.map((p) => {
        const raw = valuesByParticipant[p.id];
        const weight =
          raw !== undefined && raw.trim() !== '' ? Number(raw) : p.defaultWeight;
        return { participantId: p.id, value: weight };
      });
      previewSplits = calculateWeightedSharesSplit(totalAmountCents, participants, inputs);
    }
  } catch (err) {
    validationError = err instanceof Error ? err.message : 'Configuração de divisão inválida.';
  }

  const previewMap = new Map(previewSplits.map((s) => [s.participantId, s.amountCents]));

  return (
    <div data-testid="advanced-split-inputs" className="space-y-4">
      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          {mode === 'EXACT' ? (
            <>
              <Coins className="h-4 w-4 text-indigo-600" />
              Divisão por Valor Fixo Exato (R$)
            </>
          ) : (
            <>
              <Scale className="h-4 w-4 text-indigo-600" />
              Divisão Proporcional por Pesos / Cotas
            </>
          )}
        </span>
        <span>Total da Despesa: {formatBRL(Math.max(0, totalAmountCents))}</span>
      </div>

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {participants.map((participant) => {
          const defaultPlaceholder =
            mode === 'EXACT' ? '0,00' : String(participant.defaultWeight);
          const currentVal = valuesByParticipant[participant.id] ?? '';
          const calculatedCents = previewMap.get(participant.id) ?? 0;

          return (
            <div
              key={participant.id}
              data-testid={`advanced-split-row-${participant.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{participant.name}</p>
                <p
                  data-testid={`split-preview-amount-${participant.id}`}
                  className="text-xs text-slate-500"
                >
                  Cota calculada: <strong className="text-slate-700">{formatBRL(calculatedCents)}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">
                  {mode === 'EXACT' ? 'R$' : 'Peso:'}
                </span>
                <input
                  data-testid={`split-input-${mode.toLowerCase()}-${participant.id}`}
                  type="number"
                  step={mode === 'EXACT' ? '0.01' : '0.5'}
                  min="0"
                  value={currentVal}
                  placeholder={defaultPlaceholder}
                  onChange={(e) => onChangeValue(participant.id, e.target.value)}
                  className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-right text-sm font-medium text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>
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
            Divisão {mode === 'EXACT' ? 'exata' : 'por pesos'} válida! Soma total distribuída:{' '}
            {formatBRL(totalAmountCents)}.
          </span>
        </div>
      )}
    </div>
  );
}
