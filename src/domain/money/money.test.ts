import { describe, expect, it } from 'vitest';
import {
  allocatePenniesEqual,
  allocatePenniesWeighted,
  convertCurrencyToBRL,
  formatBRL,
  toCents,
} from './money';
import { DomainValidationError } from '../errors';

describe('Money Domain Engine', () => {
  it('converts decimal BRL amount string or number to exact integer cents', () => {
    expect(toCents(10.5)).toBe(1050);
    expect(toCents(19.99)).toBe(1999);
    expect(toCents('125,75')).toBe(12575);
    expect(toCents(' 42.10 ')).toBe(4210);
  });

  it('rejects NaN, Infinity, empty strings, or non-numeric monetary values', () => {
    expect(() => toCents(Number.NaN)).toThrow(DomainValidationError);
    expect(() => toCents(Number.POSITIVE_INFINITY)).toThrow(DomainValidationError);
    expect(() => toCents('')).toThrow(DomainValidationError);
    expect(() => toCents('abc')).toThrow(DomainValidationError);
  });

  it('formats integer cents to localized BRL currency string (R$ X,XX)', () => {
    expect(formatBRL(0)).toBe('R$ 0,00');
    expect(formatBRL(5)).toBe('R$ 0,05');
    expect(formatBRL(1050)).toBe('R$ 10,50');
    expect(formatBRL(123456)).toBe('R$ 1.234,56');
  });

  it('formats negative integer cents properly for debtor balances', () => {
    expect(formatBRL(-3333)).toBe('-R$ 33,33');
    expect(formatBRL(-150000)).toBe('-R$ 1.500,00');
  });

  it('allocates equal penny shares without remainder when total is divisible', () => {
    const shares = allocatePenniesEqual(9000, 3);
    expect(shares).toEqual([3000, 3000, 3000]);
  });

  it('distributes 1 leftover cent deterministically to the first participant', () => {
    const shares = allocatePenniesEqual(100, 3);
    expect(shares).toEqual([34, 33, 33]);
  });

  it('distributes 2 leftover cents deterministically to the first two participants', () => {
    const shares = allocatePenniesEqual(101, 3);
    expect(shares).toEqual([34, 34, 33]);
  });

  it('allocates weighted pennies proportionally and distributes remainder by deterministic participant order', () => {
    const exactWeighted = allocatePenniesWeighted(10000, [2, 1, 1]);
    expect(exactWeighted).toEqual([5000, 2500, 2500]);

    const remainderWeighted = allocatePenniesWeighted(100, [1, 1, 1]);
    expect(remainderWeighted).toEqual([34, 33, 33]);

    const zeroFirstWeight = allocatePenniesWeighted(100, [0, 1, 1, 1]);
    expect(zeroFirstWeight).toEqual([0, 34, 33, 33]);
  });

  it('converts foreign currency amount to base BRL cents using fixed exchange rate with half-up rounding', () => {
    const convertedUSD = convertCurrencyToBRL(1000, 5.75);
    expect(convertedUSD).toBe(5750);

    const convertedWithRounding = convertCurrencyToBRL(333, 5.125);
    expect(convertedWithRounding).toBe(1707);
  });

  it('rejects currency conversion or penny allocation when inputs violate domain invariants', () => {
    expect(() => convertCurrencyToBRL(1000, 0)).toThrow(DomainValidationError);
    expect(() => convertCurrencyToBRL(1000, -5.2)).toThrow(DomainValidationError);
    expect(() => convertCurrencyToBRL(0, 5.5)).toThrow(DomainValidationError);
    expect(() => allocatePenniesEqual(0, 3)).toThrow(DomainValidationError);
    expect(() => allocatePenniesEqual(100, 0)).toThrow(DomainValidationError);
    expect(() => allocatePenniesWeighted(100, [])).toThrow(DomainValidationError);
    expect(() => allocatePenniesWeighted(100, [0, 0])).toThrow(DomainValidationError);
    expect(() => allocatePenniesWeighted(100, [1, -1])).toThrow(DomainValidationError);
    expect(() => formatBRL(10.5)).toThrow(DomainValidationError);
  });
});
