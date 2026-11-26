import { DomainValidationError } from '../errors';
import { applySettlementsToBalances } from '../settlement/debtSimplifier';
import type { Expense, ExpensePayer, Group, GroupLedgerState, NetBalance } from '../types';

function checkedCents(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new DomainValidationError('INVALID_LEDGER_CENTS', 'O valor deve ser representável em centavos inteiros.');
  }
  return value;
}

function validateEntries(
  entries: readonly ExpensePayer[],
  participantIds: ReadonlySet<string>,
): number {
  let sum = 0;
  const seen = new Set<string>();
  for (const { participantId, amountCents } of entries) {
    if (!participantIds.has(participantId)) {
      throw new DomainValidationError('UNKNOWN_EXPENSE_PARTICIPANT', 'A despesa faz referência a alguém fora do projeto.');
    }
    if (seen.has(participantId)) {
      throw new DomainValidationError('DUPLICATE_EXPENSE_PARTICIPANT', 'O mesmo participante aparece mais de uma vez.');
    }
    if (checkedCents(amountCents) < 0) {
      throw new DomainValidationError('NEGATIVE_EXPENSE_SHARE', 'Valores de pagamentos e cotas devem ser positivos ou zero.');
    }
    seen.add(participantId);
    sum = checkedCents(sum + amountCents);
  }
  return sum;
}

export function validateExpense(group: Group, expense: Expense): void {
  if (expense.groupId !== group.id) {
    throw new DomainValidationError('WRONG_EXPENSE_GROUP', 'A despesa pertence a outro projeto.');
  }
  if (!expense.description.trim()) {
    throw new DomainValidationError('EMPTY_EXPENSE_DESCRIPTION', 'Informe a descrição da despesa.');
  }
  if (checkedCents(expense.amountCents) <= 0) {
    throw new DomainValidationError('INVALID_EXPENSE_TOTAL', 'O total da despesa deve ser maior que zero.');
  }
  const participantIds = new Set(group.participants.map(({ id }) => id));
  if (validateEntries(expense.payers, participantIds) !== expense.amountCents) {
    throw new DomainValidationError('PAYER_TOTAL_MISMATCH', 'A soma dos valores pagos deve ser igual ao total da despesa.');
  }
  if (validateEntries(expense.splits, participantIds) !== expense.amountCents) {
    throw new DomainValidationError('SHARE_TOTAL_MISMATCH', 'A soma das cotas deve ser igual ao total da despesa.');
  }
}

export function saveExpense(project: GroupLedgerState, expense: Expense): GroupLedgerState {
  validateExpense(project.group, expense);
  const record = { ...expense, description: expense.description.trim() };
  const exists = project.expenses.some(({ id }) => id === expense.id);
  const expenses = exists
    ? project.expenses.map((current) => current.id === expense.id ? record : current)
    : [record, ...project.expenses];
  return { ...project, expenses };
}

export function removeExpense(project: GroupLedgerState, expenseId: string): GroupLedgerState {
  const expenses = project.expenses.filter(({ id }) => id !== expenseId);
  if (expenses.length === project.expenses.length) {
    throw new DomainValidationError('EXPENSE_NOT_FOUND', 'A despesa não foi encontrada.');
  }
  return { ...project, expenses };
}

export function calculateLedgerBalances(project: GroupLedgerState): NetBalance[] {
  const balances = project.group.participants.map<NetBalance>(({ id }) => ({
    participantId: id,
    totalPaidCents: 0,
    totalOwedCents: 0,
    settlementsPaidCents: 0,
    settlementsReceivedCents: 0,
    netBalanceCents: 0,
  }));
  const byParticipant = new Map(balances.map((balance) => [balance.participantId, balance]));
  for (const expense of project.expenses) {
    validateExpense(project.group, expense);
    for (const payer of expense.payers) {
      const balance = byParticipant.get(payer.participantId)!;
      balance.totalPaidCents = checkedCents(balance.totalPaidCents + payer.amountCents);
    }
    for (const split of expense.splits) {
      const balance = byParticipant.get(split.participantId)!;
      balance.totalOwedCents = checkedCents(balance.totalOwedCents + split.amountCents);
    }
  }
  for (const balance of balances) {
    balance.netBalanceCents = balance.totalPaidCents - balance.totalOwedCents;
  }
  const effective = applySettlementsToBalances(balances, project.settlements);
  for (const settlement of project.settlements) {
    if (
      settlement.groupId !== project.group.id ||
      settlement.fromParticipantId === settlement.toParticipantId
    ) {
      throw new DomainValidationError('INVALID_LEDGER_SETTLEMENT', 'O projeto tem um registro de acerto inválido.');
    }
    const payer = byParticipant.get(settlement.fromParticipantId)!;
    const receiver = byParticipant.get(settlement.toParticipantId)!;
    payer.settlementsPaidCents = checkedCents(payer.settlementsPaidCents + settlement.amountCents);
    receiver.settlementsReceivedCents = checkedCents(receiver.settlementsReceivedCents + settlement.amountCents);
  }
  return effective.map(({ participantId, netBalanceCents }) => ({
    ...byParticipant.get(participantId)!,
    netBalanceCents: checkedCents(netBalanceCents),
  }));
}
