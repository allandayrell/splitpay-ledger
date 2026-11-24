import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Check,
  Crown,
  Edit3,
  FolderPlus,
  Plus,
  Users,
  X,
} from 'lucide-react';
import {
  isProjectOwner,
  resolveProjectStatus,
} from '../../../domain/workspace/projectWorkspace';
import type {
  CurrencyCode,
  EmailNotification,
  GroupLedgerState,
  UserAccount,
} from '../../../domain/types';
import { UserProfileHeader } from '../auth/UserProfileHeader';

export interface ProjectsHomeViewProps {
  currentUser: UserAccount;
  projects: readonly GroupLedgerState[];
  notifications: readonly EmailNotification[];
  errorMessage?: string | null;
  onUpdateProfile: (name: string, email: string, avatarUrl: string) => boolean;
  onMarkNotificationRead: (notificationId: string) => void;
  onLogout: () => void;
  onSelectProject: (groupId: string) => void;
  onCreateProject: (name: string, baseCurrency: CurrencyCode) => boolean;
  onRenameProject: (groupId: string, newName: string) => boolean;
}

export function ProjectsHomeView({
  currentUser,
  projects,
  notifications,
  errorMessage,
  onUpdateProfile,
  onMarkNotificationRead,
  onLogout,
  onSelectProject,
  onCreateProject,
  onRenameProject,
}: ProjectsHomeViewProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCurrency, setNewProjectCurrency] = useState<CurrencyCode>('BRL');

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [draftGroupName, setDraftGroupName] = useState('');

  function handleCreateSubmit(event: FormEvent) {
    event.preventDefault();
    const ok = onCreateProject(newProjectName, newProjectCurrency);
    if (ok) {
      setNewProjectName('');
      setNewProjectCurrency('BRL');
      setIsCreating(false);
    }
  }

  function handleStartInlineEdit(groupId: string, currentName: string) {
    setEditingGroupId(groupId);
    setDraftGroupName(currentName);
  }

  function handleSaveInlineEdit(event: FormEvent, groupId: string) {
    event.preventDefault();
    const ok = onRenameProject(groupId, draftGroupName);
    if (ok) {
      setEditingGroupId(null);
    }
  }

  return (
    <div data-testid="projects-home-view" className="space-y-8">
      <UserProfileHeader
        currentUser={currentUser}
        notifications={notifications}
        onUpdateProfile={onUpdateProfile}
        onMarkNotificationRead={onMarkNotificationRead}
        onOpenNotifiedGroup={onSelectProject}
        onLogout={onLogout}
        errorMessage={errorMessage}
      />

      <hr
        data-testid="home-divider-line"
        className="border-t-2 border-slate-200"
      />

      <section className="space-y-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">
              Meus Projetos & Grupos ({projects.length})
            </h2>
            <p className="text-sm text-slate-500">
              Selecione um projeto que você participa ou crie um novo projeto do zero.
            </p>
          </div>

          <button
            data-testid="open-create-project-btn"
            type="button"
            onClick={() => setIsCreating((prev) => !prev)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Criar Novo Projeto
          </button>
        </div>

        {isCreating ? (
          <form
            data-testid="create-project-form"
            onSubmit={handleCreateSubmit}
            className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-xs"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderPlus className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Criar Novo Projeto do Zero
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label
                  htmlFor="new-project-name-input"
                  className="mb-1 block text-xs font-semibold text-slate-700"
                >
                  Nome do Projeto / Evento / Grupo
                </label>
                <input
                  id="new-project-name-input"
                  data-testid="new-project-name-input"
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Ex: Viagem Ouro Preto, República 402, Churrasco..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label
                  htmlFor="new-project-currency-select"
                  className="mb-1 block text-xs font-semibold text-slate-700"
                >
                  Moeda Base
                </label>
                <select
                  id="new-project-currency-select"
                  data-testid="new-project-currency-select"
                  value={newProjectCurrency}
                  onChange={(e) => setNewProjectCurrency(e.target.value as CurrencyCode)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="BRL">BRL (R$ - Real)</option>
                  <option value="USD">USD (US$ - Dólar)</option>
                  <option value="EUR">EUR (€ - Euro)</option>
                  <option value="GBP">GBP (£ - Libra)</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancelar
              </button>
              <button
                data-testid="submit-create-project-btn"
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                <Check className="h-4 w-4" />
                Criar Projeto
              </button>
            </div>
          </form>
        ) : null}

        {projects.length === 0 ? (
          <div
            data-testid="empty-projects-state"
            className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"
          >
            <p className="text-base font-bold text-slate-800">
              Você ainda não participa de nenhum projeto
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Clique em &ldquo;Criar Novo Projeto&rdquo; acima para iniciar sua primeira divisão de contas.
            </p>
          </div>
        ) : (
          <div
            data-testid="projects-cards-grid"
            className="grid grid-cols-1 gap-4"
          >
            {projects.map((project) => {
              const { group } = project;
              const isOwner = isProjectOwner(group, currentUser.id);
              const status = resolveProjectStatus(project);
              const isEditingThis = editingGroupId === group.id;

              return (
                <article
                  key={group.id}
                  data-testid={`project-card-${group.id}`}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition hover:border-indigo-300"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
                        <Users className="h-6 w-6" />
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold tracking-wider text-indigo-600 uppercase">
                            Grupo Ativo • Moeda Base {group.baseCurrency}
                          </span>
                          <span
                            data-testid={`project-status-badge-${group.id}`}
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              status === 'QUITE'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {status === 'QUITE' ? 'Status: Quite' : 'Status: Acertos Pendentes'}
                          </span>
                          {isOwner ? (
                            <span
                              data-testid={`project-role-owner-${group.id}`}
                              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900"
                            >
                              <Crown className="h-3 w-3" />
                              Dono do Projeto
                            </span>
                          ) : (
                            <span
                              data-testid={`project-role-member-${group.id}`}
                              className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600"
                            >
                              Participante Comum
                            </span>
                          )}
                        </div>

                        {isEditingThis ? (
                          <form
                            onSubmit={(e) => handleSaveInlineEdit(e, group.id)}
                            className="mt-1.5 flex items-center gap-2"
                          >
                            <input
                              data-testid={`edit-project-name-input-${group.id}`}
                              type="text"
                              value={draftGroupName}
                              onChange={(e) => setDraftGroupName(e.target.value)}
                              className="rounded-lg border border-slate-300 px-3 py-1 text-lg font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                              autoFocus
                            />
                            <button
                              data-testid={`save-project-name-btn-${group.id}`}
                              type="submit"
                              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-bold text-white hover:bg-indigo-700"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingGroupId(null)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600"
                            >
                              Cancelar
                            </button>
                          </form>
                        ) : (
                          <div className="mt-0.5 flex items-center gap-2">
                            <h3
                              data-testid={`project-card-title-${group.id}`}
                              className="text-2xl font-bold text-slate-900"
                            >
                              {group.name}
                            </h3>
                            {isOwner ? (
                              <button
                                data-testid={`edit-project-card-btn-${group.id}`}
                                type="button"
                                onClick={() => handleStartInlineEdit(group.id, group.name)}
                                aria-label={`Editar nome do projeto ${group.name}`}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        data-testid={`project-card-participants-${group.id}`}
                        className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700"
                      >
                        {group.participants.length}{' '}
                        {group.participants.length === 1 ? 'participante' : 'participantes'}
                      </span>

                      <button
                        data-testid={`open-project-btn-${group.id}`}
                        type="button"
                        onClick={() => onSelectProject(group.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-600"
                      >
                        Acessar Projeto
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
