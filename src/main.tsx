import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertCircle, ArrowLeft, Calculator, CheckCircle2, Crown, Wallet } from 'lucide-react';
import './index.css';
import {
  addHybridParticipantToProject,
  authenticateUser,
  createSeededUsers,
  getNotificationsForUser,
  markNotificationAsRead,
  registerUserAccount,
  updateUserProfile,
} from './domain/auth/userAccount';
import { removeParticipant, updateParticipant } from './domain/group/group';
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
import {
  createProjectForOwner,
  filterProjectsForUser,
  isProjectOwner,
  renameProjectAsOwner,
} from './domain/workspace/projectWorkspace';
import type {
  CurrencyCode,
  EmailNotification,
  GroupLedgerState,
  TransferInstruction,
  UserAccount,
} from './domain/types';
import { AuthScreen } from './ui/features/auth/AuthScreen';
import { TransferPlanPanel } from './ui/features/balances/TransferPlanPanel';
import {
  ExactAndSharesSplitInputs,
  type AdvancedSplitMode,
} from './ui/features/expenses/ExactAndSharesSplitInputs';
import { GroupHeader } from './ui/features/groups/GroupHeader';
import { ParticipantsPanel } from './ui/features/groups/ParticipantsPanel';
import { ProjectsHomeView } from './ui/features/workspace/ProjectsHomeView';

function buildInitialWorkspace(users: readonly UserAccount[]): {
  projects: GroupLedgerState[];
  notifications: EmailNotification[];
} {
  const allan = users.find((u) => u.id === 'usr_allan')!;
  const warley = users.find((u) => u.id === 'usr_warley')!;

  const p1 = createProjectForOwner({
    id: 'grp_capitolio',
    name: 'Viagem Capitólio 2026',
    baseCurrency: 'BRL',
    owner: allan,
    ownerDefaultWeight: 2,
  });

  const addWarleyP1 = addHybridParticipantToProject(p1.group, users, {
    participantId: 'p_warley_1',
    referencedUserEmailOrId: warley.email,
    defaultWeight: 1,
    invitedByName: allan.name,
    notificationId: 'notif_seed_1',
  });
  p1.group = addWarleyP1.group;

  const addCarlaP1 = addHybridParticipantToProject(p1.group, users, {
    participantId: 'p_carla_1',
    referencedUserEmailOrId: 'carla@splitpay.dev',
    defaultWeight: 1,
    invitedByName: allan.name,
    notificationId: 'notif_seed_2',
  });
  p1.group = addCarlaP1.group;

  const p2 = createProjectForOwner({
    id: 'grp_republica',
    name: 'República Central (Dono: Warley)',
    baseCurrency: 'BRL',
    owner: warley,
    ownerDefaultWeight: 1,
  });

  const addAllanP2 = addHybridParticipantToProject(p2.group, users, {
    participantId: 'p_allan_2',
    referencedUserEmailOrId: allan.email,
    defaultWeight: 1,
    invitedByName: warley.name,
    notificationId: 'notif_seed_allan',
  });
  p2.group = addAllanP2.group;

  const addGuestP2 = addHybridParticipantToProject(p2.group, users, {
    participantId: 'p_guest_2',
    name: 'Lucas (Morador Temporário - Sem Conta)',
    defaultWeight: 1,
    invitedByName: warley.name,
  });
  p2.group = addGuestP2.group;

  const notifications: EmailNotification[] = [
    addWarleyP1.notification,
    addCarlaP1.notification,
    addAllanP2.notification,
  ].filter((n): n is EmailNotification => n !== null);

  return {
    projects: [p1, p2],
    notifications,
  };
}

function SplitPayApplication() {
  const [users, setUsers] = useState<UserAccount[]>(createSeededUsers);
  const [currentUserId, setCurrentUserId] = useState<string | null>('usr_allan');
  const [authError, setAuthError] = useState<string | null>(null);

  const initialData = useState(() => buildInitialWorkspace(createSeededUsers()))[0];
  const [projects, setProjects] = useState<GroupLedgerState[]>(initialData.projects);
  const [notifications, setNotifications] = useState<EmailNotification[]>(
    initialData.notifications,
  );
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const [rawAmount, setRawAmount] = useState('100.00');
  const [payerChecked, setPayerChecked] = useState<Record<string, boolean>>({});
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({});
  const [splitMode, setSplitMode] = useState<AdvancedSplitMode>('SHARES');
  const [valuesByParticipant, setValuesByParticipant] = useState<Record<string, string>>({});

  const currentUser = users.find((u) => u.id === currentUserId) ?? null;

  function handleLogin(email: string, password: string) {
    try {
      const authenticated = authenticateUser(users, email, password);
      setCurrentUserId(authenticated.id);
      setActiveGroupId(null);
      setAuthError(null);
      setFeedbackError(null);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Falha na autenticação.');
    }
  }

  function handleRegister(name: string, email: string, password: string, avatarUrl?: string) {
    try {
      const newUser = registerUserAccount(users, { name, email, password, avatarUrl });
      setUsers((prev) => [...prev, newUser]);
      setCurrentUserId(newUser.id);
      setActiveGroupId(null);
      setAuthError(null);
      setFeedbackError(null);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Erro ao criar conta.');
    }
  }

  function handleUpdateProfile(
    name: string,
    email: string,
    avatarUrl: string,
    receiveEmailNotifications: boolean,
  ): boolean {
    if (!currentUser) return false;
    try {
      const updatedUsers = updateUserProfile(users, {
        userId: currentUser.id,
        name,
        email,
        avatarUrl,
        receiveEmailNotifications,
      });
      setUsers(updatedUsers);
      setFeedbackError(null);
      return true;
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Erro ao atualizar perfil.');
      return false;
    }
  }

  function handleMarkNotificationRead(notificationId: string) {
    setNotifications((prev) => markNotificationAsRead(prev, notificationId));
  }

  function handleCreateProject(name: string, baseCurrency: CurrencyCode): boolean {
    if (!currentUser) return false;
    try {
      const newProj = createProjectForOwner({
        name,
        baseCurrency,
        owner: currentUser,
      });
      setProjects((prev) => [newProj, ...prev]);
      setFeedbackError(null);
      return true;
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Erro ao criar projeto.');
      return false;
    }
  }

  function handleRenameProject(groupId: string, newName: string): boolean {
    if (!currentUser) return false;
    try {
      setProjects((prev) =>
        prev.map((proj) =>
          proj.group.id === groupId
            ? { ...proj, group: renameProjectAsOwner(proj.group, currentUser.id, newName) }
            : proj,
        ),
      );
      setFeedbackError(null);
      return true;
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Sem permissão para renomear projeto.');
      return false;
    }
  }

  if (!currentUser) {
    return (
      <AuthScreen
        seededUsers={users}
        errorMessage={authError}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />
    );
  }

  const userNotifications = getNotificationsForUser(notifications, currentUser);
  const visibleProjects = filterProjectsForUser(projects, currentUser);
  const activeProject = visibleProjects.find((p) => p.group.id === activeGroupId) ?? null;

  if (!activeProject) {
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
                  Meus Projetos & Gestão de Contas em Grupo
                </p>
              </div>
            </div>
          </div>

          <ProjectsHomeView
            currentUser={currentUser}
            projects={visibleProjects}
            notifications={userNotifications}
            errorMessage={feedbackError}
            onUpdateProfile={handleUpdateProfile}
            onMarkNotificationRead={handleMarkNotificationRead}
            onLogout={() => setCurrentUserId(null)}
            onSelectProject={(groupId) => {
              const target = visibleProjects.find((p) => p.group.id === groupId);
              const firstParticipantId = target?.group.participants[0]?.id;
              if (firstParticipantId) {
                setPayerChecked({ [firstParticipantId]: true });
                setPayerAmounts({ [firstParticipantId]: rawAmount });
              }
              setActiveGroupId(groupId);
              setFeedbackError(null);
              setFeedbackBanner(null);
            }}
            onCreateProject={handleCreateProject}
            onRenameProject={handleRenameProject}
          />
        </div>
      </div>
    );
  }

  const { group, settlements } = activeProject;
  const isOwner = isProjectOwner(group, currentUser.id);

  function handleAddParticipantToActive(
    name: string,
    defaultWeight: number,
    referencedUserEmailOrId?: string,
  ): boolean {
    if (!currentUser || !activeProject) return false;
    try {
      const result = addHybridParticipantToProject(activeProject.group, users, {
        name,
        defaultWeight,
        referencedUserEmailOrId,
        invitedByName: currentUser.name,
      });

      setProjects((prev) =>
        prev.map((p) =>
          p.group.id === activeProject.group.id ? { ...p, group: result.group } : p,
        ),
      );

      if (result.notification) {
        setNotifications((prev) => [result.notification!, ...prev]);
        setFeedbackBanner(
          `Nova notificação enviada para ${result.notification.recipientEmail}! O projeto já aparece em Meus Projetos dessa conta.`,
        );
      } else {
        setFeedbackBanner(null);
      }

      setFeedbackError(null);
      return true;
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Erro ao adicionar participante.');
      return false;
    }
  }

  function handleUpdateWeight(participantId: string, newWeight: number) {
    if (!activeProject) return;
    try {
      const updatedGroup = updateParticipant(activeProject.group, {
        participantId,
        defaultWeight: newWeight,
      });
      setProjects((prev) =>
        prev.map((p) => (p.group.id === activeProject.group.id ? { ...p, group: updatedGroup } : p)),
      );
      setFeedbackError(null);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Peso inválido.');
    }
  }

  function handleRemoveParticipant(participantId: string) {
    if (!activeProject) return;
    try {
      const updatedGroup = removeParticipant(
        activeProject.group,
        participantId,
        activeProject.expenses,
        activeProject.settlements,
      );
      setProjects((prev) =>
        prev.map((p) => (p.group.id === activeProject.group.id ? { ...p, group: updatedGroup } : p)),
      );
      setFeedbackError(null);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Não foi possível remover participante.');
    }
  }

  function handleTogglePayer(participantId: string, checked: boolean) {
    setPayerChecked((prev) => {
      const next = { ...prev, [participantId]: checked };
      const activeIds = group.participants.filter((p) => next[p.id]).map((p) => p.id);
      if (checked && activeIds.length === 1) {
        setPayerAmounts((prevAmounts) => ({
          ...prevAmounts,
          [participantId]: rawAmount,
        }));
      }
      return next;
    });
  }

  let totalExpenseCents = 0;
  try {
    totalExpenseCents = Math.max(0, toCents(rawAmount));
  } catch {
    totalExpenseCents = 0;
  }

  const paidCentsByParticipant = new Map<string, number>();
  let totalPaidCents = 0;
  for (const participant of group.participants) {
    if (payerChecked[participant.id]) {
      try {
        const rawPaid = payerAmounts[participant.id] ?? '0';
        const cents = rawPaid.trim() === '' ? 0 : Math.max(0, toCents(rawPaid));
        paidCentsByParticipant.set(participant.id, cents);
        totalPaidCents += cents;
      } catch {
        paidCentsByParticipant.set(participant.id, 0);
      }
    } else {
      paidCentsByParticipant.set(participant.id, 0);
    }
  }

  const payersSumMatchesTotal =
    totalExpenseCents > 0 && totalPaidCents === totalExpenseCents;

  let baseBalances: ParticipantBalanceEntry[] = group.participants.map((p) => ({
    participantId: p.id,
    netBalanceCents: 0,
  }));

  try {
    if (payersSumMatchesTotal && group.participants.length > 0) {
      const splits =
        splitMode === 'EXACT'
          ? calculateExactSplit(
              totalExpenseCents,
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
              totalExpenseCents,
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
        const paid = paidCentsByParticipant.get(p.id) ?? 0;
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
    if (!activeProject) return;
    try {
      const record = createSettlementRecord(activeProject.group, {
        groupId: activeProject.group.id,
        fromParticipantId: transfer.fromParticipantId,
        toParticipantId: transfer.toParticipantId,
        amountCents: transfer.amountCents,
      });
      setProjects((prev) =>
        prev.map((p) =>
          p.group.id === activeProject.group.id
            ? { ...p, settlements: [...p.settlements, record] }
            : p,
        ),
      );
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Erro ao registrar quitação.');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6 px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            data-testid="back-to-home-btn"
            type="button"
            onClick={() => {
              setActiveGroupId(null);
              setFeedbackError(null);
              setFeedbackBanner(null);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para Meus Projetos
          </button>

          <div className="flex items-center gap-2">
            {isOwner ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                <Crown className="h-3.5 w-3.5" />
                Dono do Projeto
              </span>
            ) : (
              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                Participante Comum
              </span>
            )}
          </div>
        </div>

        {feedbackBanner ? (
          <div
            data-testid="notification-dispatched-banner"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800"
          >
            {feedbackBanner}
          </div>
        ) : null}

        <GroupHeader
          group={group}
          canEdit={isOwner}
          onRenameGroup={(newName) => {
            handleRenameProject(group.id, newName);
          }}
          errorMessage={feedbackError}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-5">
            <ParticipantsPanel
              participants={group.participants}
              registeredUsers={users}
              canManageParticipants={true}
              onAddParticipant={handleAddParticipantToActive}
              onUpdateParticipantWeight={handleUpdateWeight}
              onRemoveParticipant={handleRemoveParticipant}
            />

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <h2 className="mb-3 text-lg font-bold text-slate-900">Saldos Líquidos no Projeto</h2>
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
                    Divisão da Conta ({group.baseCurrency})
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

              <div>
                <label
                  htmlFor="expense-total-input"
                  className="mb-1 block text-xs font-bold tracking-wider text-slate-600 uppercase"
                >
                  Valor Total da Conta ({group.baseCurrency})
                </label>
                <input
                  id="expense-total-input"
                  data-testid="expense-total-input"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={rawAmount}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setRawAmount(nextVal);
                    const checkedIds = group.participants
                      .filter((p) => payerChecked[p.id])
                      .map((p) => p.id);
                    if (checkedIds.length === 1 && checkedIds[0]) {
                      setPayerAmounts((prev) => ({ ...prev, [checkedIds[0]!]: nextVal }));
                    }
                  }}
                  placeholder="100.00"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div data-testid="multi-payers-section" className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tracking-wider text-slate-600 uppercase">
                    Quem pagou a conta? (Marque 1 ou mais pagadores)
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    Soma paga: {formatBRL(totalPaidCents)} / {formatBRL(totalExpenseCents)}
                  </span>
                </div>

                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                  {group.participants.map((participant) => {
                    const isChecked = Boolean(payerChecked[participant.id]);
                    const currentPaidVal = payerAmounts[participant.id] ?? '';

                    return (
                      <div
                        key={participant.id}
                        data-testid={`payer-row-${participant.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <label className="flex cursor-pointer items-center gap-3">
                          <input
                            data-testid={`payer-checkbox-${participant.id}`}
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handleTogglePayer(participant.id, e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm font-semibold text-slate-900">
                            {participant.name}
                          </span>
                        </label>

                        {isChecked ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-500">Pagou R$:</span>
                            <input
                              data-testid={`payer-amount-input-${participant.id}`}
                              type="number"
                              step="0.01"
                              min="0"
                              value={currentPaidVal}
                              placeholder="0,00"
                              onChange={(e) =>
                                setPayerAmounts((prev) => ({
                                  ...prev,
                                  [participant.id]: e.target.value,
                                }))
                              }
                              className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-right text-sm font-medium text-slate-900 focus:border-indigo-500 focus:outline-none"
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Não pagou</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!payersSumMatchesTotal ? (
                  <div
                    data-testid="payers-sum-error"
                    role="alert"
                    className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>
                      A soma dos valores pagos ({formatBRL(totalPaidCents)}) deve ser igual ao total
                      da conta ({formatBRL(totalExpenseCents)}).
                    </span>
                  </div>
                ) : (
                  <div
                    data-testid="payers-sum-valid"
                    className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-700"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Pagadores conferem com o valor total da conta!</span>
                  </div>
                )}
              </div>

              <ExactAndSharesSplitInputs
                mode={splitMode}
                totalAmountCents={totalExpenseCents}
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
      <SplitPayApplication />
    </StrictMode>,
  );
}
