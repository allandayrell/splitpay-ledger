import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, Calculator, Crown, Wallet } from 'lucide-react';
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
import { UserProfileHeader } from './ui/features/auth/UserProfileHeader';
import { TransferPlanPanel } from './ui/features/balances/TransferPlanPanel';
import {
  ExactAndSharesSplitInputs,
  type AdvancedSplitMode,
} from './ui/features/expenses/ExactAndSharesSplitInputs';
import { MultiCurrencySelector } from './ui/features/expenses/MultiCurrencySelector';
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
  const [currency, setCurrency] = useState<CurrencyCode>('BRL');
  const [rawExchangeRate, setRawExchangeRate] = useState('5.50');
  const [payerId, setPayerId] = useState('');
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

  function handleUpdateProfile(name: string, email: string, avatarUrl: string): boolean {
    if (!currentUser) return false;
    try {
      const updatedUsers = updateUserProfile(users, {
        userId: currentUser.id,
        name,
        email,
        avatarUrl,
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
                  Home • Meus Projetos & Gestão de Contas em Grupo
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
          `Notificação enviada por e-mail para ${result.notification.recipientEmail}! O projeto já aparece na Home desse usuário.`,
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
        <UserProfileHeader
          currentUser={currentUser}
          notifications={userNotifications}
          onUpdateProfile={handleUpdateProfile}
          onMarkNotificationRead={handleMarkNotificationRead}
          onOpenNotifiedGroup={(gId) => setActiveGroupId(gId)}
          onLogout={() => setCurrentUserId(null)}
          errorMessage={feedbackError}
        />

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
            Voltar para Home (Meus Projetos)
          </button>

          <div className="flex items-center gap-2">
            {isOwner ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                <Crown className="h-3.5 w-3.5" />
                Você é o Dono deste Projeto (Edição Liberada)
              </span>
            ) : (
              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                Você é Participante Comum (Configurações do Grupo Somente Leitura)
              </span>
            )}
          </div>
        </div>

        {feedbackBanner ? (
          <div
            data-testid="email-dispatched-banner"
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
                  value={
                    group.participants.some((p) => p.id === payerId)
                      ? payerId
                      : (group.participants[0]?.id ?? '')
                  }
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
      <SplitPayApplication />
    </StrictMode>,
  );
}
