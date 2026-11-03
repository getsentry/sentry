import type {RequestError} from 'sentry/utils/requestError/requestError';

import {BILLION, MILLION} from 'getsentry/constants';

/**
 * Extracts a user-facing message from a failed API request. Falls back to the
 * provided message when the request failed without a usable response body
 * (e.g. a network failure, where `responseJSON` is undefined).
 */
export function getRequestErrorMessage(err: unknown, fallback: string): string {
  const detail = (err as RequestError | undefined)?.responseJSON?.detail;
  if (typeof detail === 'string' && detail) {
    return detail;
  }
  if (typeof detail === 'object' && detail?.message) {
    return detail.message;
  }
  return fallback;
}

export enum BigNumUnits {
  NUMBERS = 0,
  KILO_BYTES = 1,
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
      (units === BigNumUnits.KILO_BYTES ? 'kB' : 'K')
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
