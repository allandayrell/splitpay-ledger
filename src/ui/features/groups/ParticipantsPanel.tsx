import { useState, type FormEvent } from 'react';
import { AtSign, Trash2, UserCheck, UserPlus } from 'lucide-react';
import type { Participant, UserAccount } from '../../../domain/types';

export interface ParticipantsPanelProps {
  participants: readonly Participant[];
  registeredUsers?: readonly UserAccount[];
  canManageParticipants?: boolean;
  onAddParticipant: (
    name: string,
    referencedUserEmailOrId?: string,
  ) => boolean;
  onRemoveParticipant: (participantId: string) => void;
}

export function ParticipantsPanel({
  participants,
  registeredUsers = [],
  canManageParticipants = true,
  onAddParticipant,
  onRemoveParticipant,
}: ParticipantsPanelProps) {
  const [name, setName] = useState('');
  const [selectedUserEmail, setSelectedUserEmail] = useState('');

  function handleSelectAccount(email: string) {
    setSelectedUserEmail(email);
    if (email) {
      const matched = registeredUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (matched && name.trim().length === 0) {
        setName(matched.name);
      }
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const added = onAddParticipant(
      name,
      selectedUserEmail.trim() !== '' ? selectedUserEmail : undefined,
    );
    if (added) {
      setName('');
      setSelectedUserEmail('');
    }
  }

  return (
    <section
      data-testid="participants-panel"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Participantes do Projeto</h2>
          <p className="text-sm text-slate-500">
            Digite apenas um nome avulso ou vincule uma conta cadastrada.
          </p>
        </div>
      </div>

      {canManageParticipants ? (
        <form onSubmit={handleSubmit} className="mb-6 space-y-3">
          <div>
            <label htmlFor="participant-name-input" className="sr-only">
              Nome do participante
            </label>
            <input
              id="participant-name-input"
              data-testid="participant-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome (ex: Primo Lucas ou selecione uma conta abaixo)"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {registeredUsers.length > 0 ? (
              <div className="relative flex flex-1 items-center">
                <AtSign className="pointer-events-none absolute left-3 h-4 w-4 text-indigo-500" />
                <select
                  data-testid="participant-account-select"
                  value={selectedUserEmail}
                  onChange={(e) => handleSelectAccount(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 pr-3 pl-9 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">
                    Sem vínculo de conta (apenas nome em string)
                  </option>
                  {registeredUsers.map((u) => (
                    <option key={u.id} value={u.email}>
                      Vincular conta: {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <button
              data-testid="add-participant-btn"
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              <UserPlus className="h-4 w-4" />
              Adicionar Participante
            </button>
          </div>
        </form>
      ) : null}

      {participants.length === 0 ? (
        <p
          data-testid="empty-participants-msg"
          className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500"
        >
          Nenhum participante cadastrado. Adicione pelo menos 2 participantes para dividir despesas.
        </p>
      ) : (
        <ul data-testid="participants-list" className="divide-y divide-slate-100">
          {participants.map((participant) => (
            <li
              key={participant.id}
              data-testid={`participant-item-${participant.id}`}
              className="flex items-center justify-between py-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700">
                  {participant.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      data-testid={`participant-name-${participant.id}`}
                      className="font-semibold text-slate-900"
                    >
                      {participant.name}
                    </p>
                    {participant.email ? (
                      <span
                        data-testid={`participant-linked-badge-${participant.id}`}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                      >
                        <UserCheck className="h-3 w-3" />
                        {participant.email}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                        Participante local
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {canManageParticipants ? (
                <button
                  data-testid={`remove-participant-${participant.id}`}
                  type="button"
                  onClick={() => onRemoveParticipant(participant.id)}
                  aria-label={`Remover ${participant.name}`}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
