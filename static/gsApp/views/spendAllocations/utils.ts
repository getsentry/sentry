import {BILLION, MILLION} from 'getsentry/constants';

export enum BigNumUnits {
  NUMBERS,
  KILO_BYTES,
}

const fixDecimals = (num: number, decimals: number) => {
  return Math.floor(num * 10 ** decimals) / 10 ** decimals;
};

export const bigNumFormatter = (
  num: number,
  decimals?: number,
  units: BigNumUnits = BigNumUnits.NUMBERS
) => {
  if (num >= 1000 && num < MILLION) {
    return (
      fixDecimals(num / 1000, decimals || 1) +
      (units === BigNumUnits.KILO_BYTES ? 'KB' : 'K')
    );
  }
  if (MILLION <= num && num < BILLION) {
    return (
      fixDecimals(num / MILLION, decimals || 2) +
      (units === BigNumUnits.KILO_BYTES ? 'MB' : 'M')
    );
  }
  if (num >= BILLION) {
    return (
      fixDecimals(num / BILLION, decimals || 2) +
      (units === BigNumUnits.KILO_BYTES ? 'GB' : 'B')
    );
  }
  return num + (units === BigNumUnits.KILO_BYTES ? ' bytes' : '');
};

export const midPeriod = (period: string[]) => {
  const [start, end] = period;
  const startTimestamp = new Date(start!).getTime() / 1000;
  const endTimestamp = new Date(end!).getTime() / 1000;
  return (startTimestamp + endTimestamp) / 2;
};
