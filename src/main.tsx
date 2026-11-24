import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Calculator, Wallet } from 'lucide-react';
import './index.css';
import {
  addParticipant,
  createGroup,
  removeParticipant,
  updateGroupName,
  updateParticipant,
} from './domain/group/group';
import { normalizeExpenseCurrencyAmount } from './domain/ledger/multiCurrencyExpense';
import { formatBRL, toCents } from './domain/money/money';
import {
  applySettlementsToBalances,
  createSettlementRecord,
  simplifyDebts,
  type ParticipantBalanceEntry,
} from './domain/settlement/debtSimplifier';
import {
  calculateExactSplit,
  calculateWeightedSharesSplit,
} from './domain/split/exactAndSharesSplit';
import type { CurrencyCode, Group, SettlementRecord, TransferInstruction } from './domain/types';
import { GroupHeader } from './ui/features/groups/GroupHeader';
import { ParticipantsPanel } from './ui/features/groups/ParticipantsPanel';
import {
  ExactAndSharesSplitInputs,
  type AdvancedSplitMode,
} from './ui/features/expenses/ExactAndSharesSplitInputs';
import { MultiCurrencySelector } from './ui/features/expenses/MultiCurrencySelector';
import { TransferPlanPanel } from './ui/features/balances/TransferPlanPanel';

function buildInitialGroup(): Group {
  let g = createGroup({ id: 'grp_capitolio', name: 'Viagem Capitólio 2026' });
  g = addParticipant(g, { id: 'p_alice', name: 'Alice', defaultWeight: 2 });
  g = addParticipant(g, { id: 'p_bruno', name: 'Bruno', defaultWeight: 1 });
  g = addParticipant(g, { id: 'p_carla', name: 'Carla', defaultWeight: 1 });
  return g;
}

function SplitPayWorkspacePreview() {
  const [group, setGroup] = useState<Group>(buildInitialGroup);
  const [groupError, setGroupError] = useState<string | null>(null);

  const [rawAmount, setRawAmount] = useState('100.00');
  const [currency, setCurrency] = useState<CurrencyCode>('BRL');
  const [rawExchangeRate, setRawExchangeRate] = useState('5.50');
  const [payerId, setPayerId] = useState('p_alice');
  const [splitMode, setSplitMode] = useState<AdvancedSplitMode>('SHARES');
  const [valuesByParticipant, setValuesByParticipant] = useState<Record<string, string>>({});
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);

  function handleRenameGroup(newName: string) {
    try {
      setGroup((prev) => updateGroupName(prev, newName));
      setGroupError(null);
    } catch (err) {
      setGroupError(err instanceof Error ? err.message : 'Erro ao renomear grupo.');
    }
  }

  function handleAddParticipant(name: string, defaultWeight: number): boolean {
    try {
      setGroup((prev) => addParticipant(prev, { name, defaultWeight }));
      setGroupError(null);
      return true;
    } catch (err) {
      setGroupError(err instanceof Error ? err.message : 'Erro ao adicionar participante.');
      return false;
    }
  }

  function handleUpdateWeight(participantId: string, newWeight: number) {
    try {
      setGroup((prev) => updateParticipant(prev, { participantId, defaultWeight: newWeight }));
      setGroupError(null);
    } catch (err) {
      setGroupError(err instanceof Error ? err.message : 'Peso inválido.');
    }
  }

  function handleRemoveParticipant(participantId: string) {
    try {
      setGroup((prev) => removeParticipant(prev, participantId, [], settlements));
      setGroupError(null);
    } catch (err) {
      setGroupError(err instanceof Error ? err.message : 'Não foi possível remover participante.');
    }
  }

  let normalizedAmountCents = 0;
  try {
    const rawCents = toCents(rawAmount);
    const normalized = normalizeExpenseCurrencyAmount({
      amountCents: rawCents,
      currency,
      exchangeRate: currency === 'BRL' ? undefined : Number(rawExchangeRate),
    });
    normalizedAmountCents = normalized.amountCents;
  } catch {
    normalizedAmountCents = 0;
  }

  let baseBalances: ParticipantBalanceEntry[] = group.participants.map((p) => ({
    participantId: p.id,
    netBalanceCents: 0,
  }));

  try {
    if (normalizedAmountCents > 0 && group.participants.length > 0) {
      const activePayerId = group.participants.some((p) => p.id === payerId)
        ? payerId
        : (group.participants[0]?.id ?? '');

      const splits =
        splitMode === 'EXACT'
          ? calculateExactSplit(
              normalizedAmountCents,
              group.participants,
              group.participants.map((p) => ({
                participantId: p.id,
                value:
                  valuesByParticipant[p.id] && valuesByParticipant[p.id]?.trim() !== ''
                    ? toCents(valuesByParticipant[p.id] ?? '0')
                    : 0,
              })),
            )
          : calculateWeightedSharesSplit(
              normalizedAmountCents,
              group.participants,
              group.participants.map((p) => ({
                participantId: p.id,
                value:
                  valuesByParticipant[p.id] && valuesByParticipant[p.id]?.trim() !== ''
                    ? Number(valuesByParticipant[p.id])
                    : p.defaultWeight,
              })),
            );

      const owedMap = new Map(splits.map((s) => [s.participantId, s.amountCents]));
      baseBalances = group.participants.map((p) => {
        const paid = p.id === activePayerId ? normalizedAmountCents : 0;
        const owed = owedMap.get(p.id) ?? 0;
        return {
          participantId: p.id,
          netBalanceCents: paid - owed,
        };
      });
    }
  } catch {
    // Mantém saldo zero enquanto o usuário digita uma divisão exata incompleta
  }

  let effectiveBalances = baseBalances;
  let transfers: TransferInstruction[] = [];
  try {
    effectiveBalances = applySettlementsToBalances(baseBalances, settlements);
    transfers = simplifyDebts(effectiveBalances);
  } catch {
    transfers = [];
  }

  function handleSettleTransfer(transfer: TransferInstruction) {
    try {
      const record = createSettlementRecord(group, {
        groupId: group.id,
        fromParticipantId: transfer.fromParticipantId,
        toParticipantId: transfer.toParticipantId,
        amountCents: transfer.amountCents,
      });
      setSettlements((prev) => [...prev, record]);
    } catch (err) {
      setGroupError(err instanceof Error ? err.message : 'Erro ao registrar quitação.');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight text-slate-900">
                SplitPay Ledger
              </span>
              <p className="text-xs text-slate-500">
                Divisão Inteligente de Contas & Simplificação Determinística de Dívidas
              </p>
            </div>
          </div>
          {settlements.length > 0 ? (
            <button
              type="button"
              onClick={() => setSettlements([])}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Limpar Quitações ({settlements.length})
            </button>
          ) : null}
        </div>

        <GroupHeader
          group={group}
          onRenameGroup={handleRenameGroup}
          errorMessage={groupError}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-5">
            <ParticipantsPanel
              participants={group.participants}
              onAddParticipant={handleAddParticipant}
              onUpdateParticipantWeight={handleUpdateWeight}
              onRemoveParticipant={handleRemoveParticipant}
            />

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <h2 className="mb-3 text-lg font-bold text-slate-900">Saldos Líquidos Atuais</h2>
              <ul className="divide-y divide-slate-100">
                {effectiveBalances.map((b) => {
                  const participant = group.participants.find((p) => p.id === b.participantId);
                  return (
                    <li
                      key={b.participantId}
                      className="flex items-center justify-between py-2.5 text-sm"
                    >
                      <span className="font-medium text-slate-800">
                        {participant?.name ?? b.participantId}
                      </span>
                      <span
                        className={`font-bold ${
                          b.netBalanceCents > 0
                            ? 'text-emerald-700'
                            : b.netBalanceCents < 0
                              ? 'text-rose-700'
                              : 'text-slate-500'
                        }`}
                      >
                        {b.netBalanceCents > 0 ? '+' : ''}
                        {formatBRL(b.netBalanceCents)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <div className="space-y-6 lg:col-span-7">
            <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-slate-900">
                    Simulador de Rateio (Câmbio, Pesos & Valor Exato)
                  </h2>
                </div>

                <div className="inline-flex rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSplitMode('SHARES');
                      setValuesByParticipant({});
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      splitMode === 'SHARES'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Por Pesos / Cotas
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSplitMode('EXACT');
                      setValuesByParticipant({});
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      splitMode === 'EXACT'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Valor Fixo Exato
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label
                  htmlFor="payer-select"
                  className="text-xs font-semibold text-slate-600 uppercase"
                >
                  Quem pagou a despesa:
                </label>
                <select
                  id="payer-select"
                  value={payerId}
                  onChange={(e) => setPayerId(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none"
                >
                  {group.participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <MultiCurrencySelector
                rawAmount={rawAmount}
                currency={currency}
                rawExchangeRate={rawExchangeRate}
                onChangeAmount={setRawAmount}
                onChangeCurrency={setCurrency}
                onChangeExchangeRate={setRawExchangeRate}
              />

              <ExactAndSharesSplitInputs
                mode={splitMode}
                totalAmountCents={normalizedAmountCents}
                participants={group.participants}
                valuesByParticipant={valuesByParticipant}
                onChangeValue={(participantId, val) =>
                  setValuesByParticipant((prev) => ({ ...prev, [participantId]: val }))
                }
              />
            </section>

            <TransferPlanPanel
              participants={group.participants}
              transfers={transfers}
              settlements={settlements}
              onSettleTransfer={handleSettleTransfer}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <SplitPayWorkspacePreview />
    </StrictMode>,
  );
}
