import { useState, type FormEvent } from 'react';
import { Scale, Trash2, UserPlus } from 'lucide-react';
import type { Participant } from '../../../domain/types';

export interface ParticipantsPanelProps {
  participants: readonly Participant[];
  onAddParticipant: (name: string, defaultWeight: number) => boolean;
  onUpdateParticipantWeight: (participantId: string, newWeight: number) => void;
  onRemoveParticipant: (participantId: string) => void;
}

export function ParticipantsPanel({
  participants,
  onAddParticipant,
  onUpdateParticipantWeight,
  onRemoveParticipant,
}: ParticipantsPanelProps) {
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('1');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const numericWeight = Number(weight);
    const added = onAddParticipant(name, numericWeight);
    if (added) {
      setName('');
      setWeight('1');
    }
  }

  return (
    <section
      data-testid="participants-panel"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Participantes & Pesos</h2>
          <p className="text-sm text-slate-500">
            Cadastre os integrantes e defina cotas/pesos padrão para divisões proporcionais.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="participant-name-input" className="sr-only">
            Nome do participante
          </label>
          <input
            id="participant-name-input"
            data-testid="participant-name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Alice, Bruno..."
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="w-full sm:w-36">
          <label htmlFor="participant-weight-input" className="sr-only">
            Peso padrão
          </label>
          <div className="relative flex items-center">
            <Scale className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
            <input
              id="participant-weight-input"
              data-testid="participant-weight-input"
              type="number"
              step="0.5"
              min="0.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              aria-label="Peso padrão do participante"
              className="w-full rounded-xl border border-slate-300 py-2 pr-3 pl-9 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <button
          data-testid="add-participant-btn"
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          <UserPlus className="h-4 w-4" />
          Adicionar
        </button>
      </form>

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
                  <p
                    data-testid={`participant-name-${participant.id}`}
                    className="font-semibold text-slate-900"
                  >
                    {participant.name}
                  </p>
                  <span className="text-xs text-slate-500">
                    Peso padrão: {participant.defaultWeight}x
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span>Peso:</span>
                  <input
                    data-testid={`edit-weight-${participant.id}`}
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={participant.defaultWeight}
                    onChange={(e) =>
                      onUpdateParticipantWeight(participant.id, Number(e.target.value))
                    }
                    className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-center text-xs font-medium text-slate-800"
                  />
                </label>

                <button
                  data-testid={`remove-participant-${participant.id}`}
                  type="button"
                  onClick={() => onRemoveParticipant(participant.id)}
                  aria-label={`Remover ${participant.name}`}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
