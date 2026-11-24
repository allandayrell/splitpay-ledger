import { useState, type FormEvent } from 'react';
import { KeyRound, LogIn, Mail, UserPlus, Wallet } from 'lucide-react';
import type { UserAccount } from '../../../domain/types';

export interface AuthScreenProps {
  seededUsers: readonly UserAccount[];
  errorMessage?: string | null;
  onLogin: (email: string, password: string) => void;
  onRegister: (name: string, email: string, password: string, avatarUrl?: string) => void;
}

export function AuthScreen({
  seededUsers,
  errorMessage,
  onLogin,
  onRegister,
}: AuthScreenProps) {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('allan.dayrell@gmail.com');
  const [password, setPassword] = useState('senha123');
  const [avatarUrl, setAvatarUrl] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (mode === 'LOGIN') {
      onLogin(email, password);
    } else {
      onRegister(name, email, password, avatarUrl);
    }
  }

  return (
    <div
      data-testid="auth-screen"
      className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12"
    >
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xs">
            <Wallet className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">SplitPay Ledger</h1>
          <p className="mt-1 text-sm text-slate-500">
            Acesse sua conta para gerenciar seus projetos de divisão de despesas
          </p>
        </div>

        <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          <button
            data-testid="auth-tab-login"
            type="button"
            onClick={() => setMode('LOGIN')}
            className={`rounded-lg py-2 text-xs font-bold transition ${
              mode === 'LOGIN'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Entrar na Conta
          </button>
          <button
            data-testid="auth-tab-register"
            type="button"
            onClick={() => setMode('REGISTER')}
            className={`rounded-lg py-2 text-xs font-bold transition ${
              mode === 'REGISTER'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Criar Nova Conta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'REGISTER' ? (
            <div>
              <label
                htmlFor="auth-name-input"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Nome Completo
              </label>
              <input
                id="auth-name-input"
                data-testid="auth-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Allan Dayrell"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          ) : null}

          <div>
            <label
              htmlFor="auth-email-input"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              E-mail
            </label>
            <div className="relative flex items-center">
              <Mail className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400" />
              <input
                id="auth-email-input"
                data-testid="auth-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="w-full rounded-xl border border-slate-300 py-2.5 pr-3.5 pl-10 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="auth-password-input"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Senha
            </label>
            <div className="relative flex items-center">
              <KeyRound className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400" />
              <input
                id="auth-password-input"
                data-testid="auth-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full rounded-xl border border-slate-300 py-2.5 pr-3.5 pl-10 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {mode === 'REGISTER' ? (
            <div>
              <label
                htmlFor="auth-avatar-input"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                URL da Foto de Perfil (Opcional)
              </label>
              <input
                id="auth-avatar-input"
                data-testid="auth-avatar-input"
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          ) : null}

          {errorMessage ? (
            <div
              data-testid="auth-error-alert"
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700"
            >
              {errorMessage}
            </div>
          ) : null}

          <button
            data-testid="auth-submit-btn"
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700"
          >
            {mode === 'LOGIN' ? (
              <>
                <LogIn className="h-4 w-4" />
                Entrar
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Cadastrar e Entrar
              </>
            )}
          </button>
        </form>

        <div className="border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-semibold text-slate-500">
            Acesso Rápido (Contas Cadastradas • Senha: <code className="font-mono">senha123</code>):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {seededUsers.map((u) => (
              <button
                key={u.id}
                data-testid={`quick-login-${u.id}`}
                type="button"
                onClick={() => {
                  setMode('LOGIN');
                  setEmail(u.email);
                  setPassword('senha123');
                  onLogin(u.email, 'senha123');
                }}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
              >
                {u.name} ({u.email})
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
