export type Cents = number;

export type CurrencyCode = 'BRL' | 'USD' | 'EUR' | 'GBP';

export type SplitType = 'EQUAL' | 'PERCENTAGE' | 'EXACT' | 'SHARES';

export type ExpenseCategory =
  | 'FOOD'
  | 'ACCOMMODATION'
  | 'TRANSPORT'
  | 'UTILITIES'
  | 'ENTERTAINMENT'
  | 'OTHER';

export interface Participant {
  id: string;
  name: string;
  defaultWeight: number;
}

export interface ExpensePayer {
  participantId: string;
  amountCents: Cents;
}

export interface SplitShareInput {
  participantId: string;
  value?: number;
}

export interface ExpenseSplit {
  participantId: string;
  amountCents: Cents;
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  category: ExpenseCategory;
  amountCents: Cents;
  originalAmountCents?: Cents;
  currency: CurrencyCode;
  exchangeRate?: number;
  payers: ExpensePayer[];
  splitType: SplitType;
  splits: ExpenseSplit[];
  createdAt: string;
}

export interface SettlementRecord {
  id: string;
  groupId: string;
  fromParticipantId: string;
  toParticipantId: string;
  amountCents: Cents;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  baseCurrency: CurrencyCode;
  participants: Participant[];
  createdAt: string;
}

export interface NetBalance {
  participantId: string;
  totalPaidCents: Cents;
  totalOwedCents: Cents;
  settlementsPaidCents: Cents;
  settlementsReceivedCents: Cents;
  netBalanceCents: Cents;
}

export interface TransferInstruction {
  fromParticipantId: string;
  toParticipantId: string;
  amountCents: Cents;
}

export interface GroupLedgerState {
  group: Group;
  expenses: Expense[];
  settlements: SettlementRecord[];
}
