import { useState, type FormEvent } from 'react';
import { Check, Edit3, Users } from 'lucide-react';
import type { Group } from '../../../domain/types';

export interface GroupHeaderProps {
  group: Group;
  canEdit?: boolean;
  onRenameGroup: (newName: string) => void;
  errorMessage?: string | null;
}

export function GroupHeader({
  group,
  canEdit = true,
  onRenameGroup,
  errorMessage,
}: GroupHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(group.name);

  function handleStartEdit() {
    setDraftName(group.name);
    setIsEditing(true);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onRenameGroup(draftName);
    if (draftName.trim().length > 0) {
      setIsEditing(false);
    }
  }

  return (
    <header
      data-testid="group-header"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold tracking-wider text-indigo-600 uppercase">
              Grupo Ativo • Moeda Base {group.baseCurrency}
            </span>
            {isEditing ? (
              <form onSubmit={handleSubmit} className="mt-1 flex items-center gap-2">
                <input
                  data-testid="group-name-input"
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Nome do evento ou grupo"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-lg font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                  autoFocus
                />
                <button
                  data-testid="save-group-name-btn"
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  <Check className="h-4 w-4" />
                  Salvar
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <h1 data-testid="group-name-heading" className="text-2xl font-bold text-slate-900">
                  {group.name}
                </h1>
                {canEdit ? (
                  <button
                    data-testid="edit-group-name-btn"
                    type="button"
                    onClick={handleStartEdit}
                    aria-label="Editar nome do grupo"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                ) : (
                  <span
                    data-testid="participant-readonly-badge"
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                  >
                    Participante
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span
            data-testid="participant-count-badge"
            className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700"
          >
            {group.participants.length}{' '}
            {group.participants.length === 1 ? 'participante' : 'participantes'}
          </span>
        </div>
      </div>

      {errorMessage ? (
        <div
          data-testid="group-error-alert"
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700"
        >
          {errorMessage}
        </div>
      ) : null}
    </header>
  );
}
