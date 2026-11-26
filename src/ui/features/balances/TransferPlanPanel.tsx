import { ArrowRight, CheckCircle2, HandCoins, History, RotateCcw } from 'lucide-react';
import { formatBRL } from '../../../domain/money/money';
import type {
  Participant,
  SettlementRecord,
  TransferInstruction,
} from '../../../domain/types';

export interface TransferPlanPanelProps {
  participants: readonly Participant[];
  transfers: readonly TransferInstruction[];
  settlements: readonly SettlementRecord[];
  balanceError?: string | null;
  onSettleTransfer: (transfer: TransferInstruction) => void;
  onRevertSettlement?: (settlementId: string) => void;
}

export function TransferPlanPanel({
  participants,
  transfers,
  settlements,
  balanceError,
  onSettleTransfer,
  onRevertSettlement,
}: TransferPlanPanelProps) {
  const nameById = new Map(participants.map((p) => [p.id, p.name]));

  function getName(id: string): string {
    return nameById.get(id) ?? id;
  }

  return (
    <section
      data-testid="transfer-plan-panel"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Plano Otimizado de Acertos (Simplificação de Dívidas)
          </h2>
          <p className="text-sm text-slate-500">
            Transferências sugeridas para quitar os saldos do grupo.
          </p>
        </div>
        {!balanceError && (
          <span
            data-testid="pending-transfers-count"
            className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700"
          >
            {transfers.length}{' '}
            {transfers.length === 1 ? 'transferência pendente' : 'transferências pendentes'}
          </span>
        )}
      </div>

      {balanceError ? (
        <p
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          {balanceError}
        </p>
      ) : transfers.length === 0 ? (
        <div
          data-testid="all-settled-banner"
          className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800"
        >
          <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-bold">Tudo quite no grupo!</p>
            <p className="text-xs text-emerald-700">
              Não há nenhuma dívida ou transferência pendente entre os participantes.
            </p>
          </div>
        </div>
      ) : (
        <ul data-testid="transfer-instructions-list" className="space-y-3">
          {transfers.map((transfer) => {
            const fromName = getName(transfer.fromParticipantId);
            const toName = getName(transfer.toParticipantId);
            const key = `${transfer.fromParticipantId}->${transfer.toParticipantId}`;

            return (
              <li
                key={key}
                data-testid={`transfer-item-${transfer.fromParticipantId}-${transfer.toParticipantId}`}
                className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-bold text-rose-700">{fromName}</span>
                  <span className="text-slate-500">transfere</span>
                  <span
                    data-testid={`transfer-amount-${transfer.fromParticipantId}-${transfer.toParticipantId}`}
                    className="rounded-lg bg-white px-2.5 py-1 font-extrabold text-slate-900 shadow-2xs"
                  >
                    {formatBRL(transfer.amountCents)}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-500">para</span>
                  <span className="font-bold text-emerald-700">{toName}</span>
                </div>

                <button
                  data-testid={`settle-transfer-btn-${transfer.fromParticipantId}-${transfer.toParticipantId}`}
                  type="button"
                  onClick={() => onSettleTransfer(transfer)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                >
                  <HandCoins className="h-4 w-4" />
                  Quitar Transferência
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {settlements.length > 0 ? (
        <div data-testid="settlements-history" className="mt-6 border-t border-slate-100 pt-4">
          <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-500 uppercase">
            <History className="h-3.5 w-3.5" />
            Pagamentos / Liquidações Registradas ({settlements.length})
          </h3>
          <ul className="space-y-1.5 text-xs text-slate-600">
            {settlements.map((settlement) => (
              <li
                key={settlement.id}
                data-testid={`settlement-record-${settlement.id}`}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
              >
                <span>
                  <strong>{getName(settlement.fromParticipantId)}</strong> pagou para{' '}
                  <strong>{getName(settlement.toParticipantId)}</strong>
                </span>
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-emerald-700">
                    {formatBRL(settlement.amountCents)}
                  </span>
                  {onRevertSettlement ? (
                    <button
                      data-testid={`revert-settlement-btn-${settlement.id}`}
                      type="button"
                      onClick={() => onRevertSettlement(settlement.id)}
                      title="Desfazer esta liquidação"
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-800"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Voltar
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
