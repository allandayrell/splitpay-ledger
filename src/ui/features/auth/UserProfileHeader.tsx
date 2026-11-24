import { useState, type FormEvent } from 'react';
import { Bell, Check, Edit3, LogOut, User, X } from 'lucide-react';
import type { EmailNotification, UserAccount } from '../../../domain/types';

export interface UserProfileHeaderProps {
  currentUser: UserAccount;
  notifications: readonly EmailNotification[];
  onUpdateProfile: (
    name: string,
    email: string,
    avatarUrl: string,
    receiveEmailNotifications: boolean,
  ) => boolean;
  onMarkNotificationRead: (notificationId: string) => void;
  onOpenNotifiedGroup?: (groupId: string) => void;
  onLogout: () => void;
  errorMessage?: string | null;
}

export function UserProfileHeader({
  currentUser,
  notifications,
  onUpdateProfile,
  onMarkNotificationRead,
  onOpenNotifiedGroup,
  onLogout,
  errorMessage,
}: UserProfileHeaderProps) {
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [draftName, setDraftName] = useState(currentUser.name);
  const [draftEmail, setDraftEmail] = useState(currentUser.email);
  const [draftAvatar, setDraftAvatar] = useState(currentUser.avatarUrl ?? '');
  const [draftReceiveEmail, setDraftReceiveEmail] = useState(
    currentUser.receiveEmailNotifications ?? true,
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  function handleOpenEdit() {
    setDraftName(currentUser.name);
    setDraftEmail(currentUser.email);
    setDraftAvatar(currentUser.avatarUrl ?? '');
    setDraftReceiveEmail(currentUser.receiveEmailNotifications ?? true);
    setIsEditingProfile(true);
  }

  function handleSaveProfile(event: FormEvent) {
    event.preventDefault();
    const ok = onUpdateProfile(draftName, draftEmail, draftAvatar, draftReceiveEmail);
    if (ok) {
      setIsEditingProfile(false);
    }
  }

  return (
    <div data-testid="user-profile-header" className="space-y-4">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          {currentUser.avatarUrl ? (
            <img
              data-testid="user-profile-avatar"
              src={currentUser.avatarUrl}
              alt={currentUser.name}
              className="h-16 w-16 rounded-2xl border border-slate-200 object-cover shadow-2xs"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-extrabold text-white">
              <User className="h-8 w-8" />
            </div>
          )}

          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
              Conta Conectada
            </span>
            <h1 data-testid="user-profile-name" className="mt-1 text-2xl font-extrabold text-slate-900">
              {currentUser.name}
            </h1>
            <p data-testid="user-profile-email" className="text-sm text-slate-500">
              {currentUser.email}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            data-testid="open-notifications-btn"
            type="button"
            onClick={() => setIsInboxOpen((prev) => !prev)}
            className="relative inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
          >
            <Bell className="h-4 w-4 text-indigo-600" />
            Notificações
            {unreadCount > 0 ? (
              <span
                data-testid="unread-notifications-badge"
                className="rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-extrabold text-white"
              >
                {unreadCount} {unreadCount === 1 ? 'nova' : 'novas'}
              </span>
            ) : null}
          </button>

          <button
            data-testid="edit-profile-btn"
            type="button"
            onClick={handleOpenEdit}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <Edit3 className="h-4 w-4" />
            Editar Perfil
          </button>

          <button
            data-testid="logout-btn"
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
          >
            <LogOut className="h-4 w-4" />
            Trocar Conta / Sair
          </button>
        </div>
      </div>

      {isEditingProfile ? (
        <form
          data-testid="edit-profile-modal"
          onSubmit={handleSaveProfile}
          className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Editar Meu Perfil</h3>
            <button
              type="button"
              onClick={() => setIsEditingProfile(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Nome</label>
              <input
                data-testid="edit-profile-name-input"
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">E-mail</label>
              <input
                data-testid="edit-profile-email-input"
                type="email"
                value={draftEmail}
                onChange={(e) => setDraftEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                URL da Foto / Avatar
              </label>
              <input
                data-testid="edit-profile-avatar-input"
                type="url"
                value={draftAvatar}
                onChange={(e) => setDraftAvatar(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
            <input
              id="receive-email-checkbox"
              data-testid="receive-email-checkbox"
              type="checkbox"
              checked={draftReceiveEmail}
              onChange={(e) => setDraftReceiveEmail(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label
              htmlFor="receive-email-checkbox"
              className="cursor-pointer text-xs font-semibold text-slate-700"
            >
              Desejo receber notificações também por e-mail quando eu for adicionado a um projeto
            </label>
          </div>

          {errorMessage ? (
            <p className="mt-2 text-xs font-semibold text-red-600">{errorMessage}</p>
          ) : null}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditingProfile(false)}
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700"
            >
              Cancelar
            </button>
            <button
              data-testid="save-profile-btn"
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
            >
              <Check className="h-4 w-4" />
              Salvar Alterações
            </button>
          </div>
        </form>
      ) : null}

      {isInboxOpen ? (
        <div
          data-testid="notifications-inbox"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Minhas Notificações</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsInboxOpen(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Fechar
            </button>
          </div>

          {notifications.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500">
              Nenhuma notificação até o momento.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {notifications.map((notif) => (
                <li
                  key={notif.id}
                  data-testid={`notification-item-${notif.id}`}
                  className={`rounded-xl border p-3.5 text-xs ${
                    notif.read
                      ? 'border-slate-200 bg-slate-50 text-slate-600'
                      : 'border-indigo-200 bg-indigo-50/60 text-slate-900'
                  }`}
                >
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-2">
                      <p className="font-bold">{notif.subject}</p>
                      {!notif.read ? (
                        <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          Nova notificação
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {onOpenNotifiedGroup ? (
                        <button
                          type="button"
                          onClick={() => {
                            onMarkNotificationRead(notif.id);
                            onOpenNotifiedGroup(notif.groupId);
                          }}
                          className="rounded-lg bg-indigo-600 px-2.5 py-1 font-bold text-white hover:bg-indigo-700"
                        >
                          Abrir Projeto
                        </button>
                      ) : null}
                      {!notif.read ? (
                        <button
                          data-testid={`mark-read-${notif.id}`}
                          type="button"
                          onClick={() => onMarkNotificationRead(notif.id)}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Marcar como lida
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">Lida</span>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-slate-600">{notif.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
