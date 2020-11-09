import moment from 'moment';

import {GlobalSelection} from 'app/types';
import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {parsePeriodToHours} from 'app/utils/dates';
import {escape} from 'app/utils';

const DEFAULT_TRUNCATE_LENGTH = 80;

// In minutes
export const THIRTY_DAYS = 43200;
export const TWO_WEEKS = 20160;
export const ONE_WEEK = 10080;
export const TWENTY_FOUR_HOURS = 1440;
export const ONE_HOUR = 60;

export type DateTimeObject = Partial<GlobalSelection['datetime']>;

export function truncationFormatter(
  value: string,
  truncate: number | boolean | undefined
): string {
  if (!truncate) {
    return escape(value);
  }
  const truncationLength =
    truncate && typeof truncate === 'number' ? truncate : DEFAULT_TRUNCATE_LENGTH;
  const truncated =
    value.length > truncationLength ? value.substring(0, truncationLength) + '…' : value;
  return escape(truncated);
}

/**
 * Use a shorter interval if the time difference is <= 24 hours.
 */
export function useShortInterval(datetimeObj: DateTimeObject): boolean {
  const diffInMinutes = getDiffInMinutes(datetimeObj);

  return diffInMinutes <= TWENTY_FOUR_HOURS;
}

export function getInterval(datetimeObj: DateTimeObject, highFidelity = false) {
  const diffInMinutes = getDiffInMinutes(datetimeObj);

  if (diffInMinutes >= THIRTY_DAYS) {
    // Greater than or equal to 30 days
    if (highFidelity) {
      return '1h';
    } else {
      return '24h';
    }
  }

  if (diffInMinutes > TWENTY_FOUR_HOURS) {
    // Greater than 24 hours
    if (highFidelity) {
      return '30m';
    } else {
      return '24h';
    }
  }

  if (diffInMinutes <= ONE_HOUR) {
    // Less than or equal to 1 hour
    if (highFidelity) {
      return '1m';
    } else {
      return '5m';
    }
  }

  // Between 1 hour and 24 hours
  if (highFidelity) {
    return '5m';
  } else {
    return '15m';
  }
}

export function getDiffInMinutes(datetimeObj: DateTimeObject): number {
  const {period, start, end} = datetimeObj;

  if (start && end) {
    return moment(end).diff(start, 'minutes');
  }

  return (
    parsePeriodToHours(typeof period === 'string' ? period : DEFAULT_STATS_PERIOD) * 60
  );
}

// Max period (in hours) before we can no long include previous period
const MAX_PERIOD_HOURS_INCLUDE_PREVIOUS = 45 * 24;

export function canIncludePreviousPeriod(
  includePrevious: boolean | undefined,
  period: string | undefined
) {
  if (!includePrevious) {
    return false;
  }

  if (period && parsePeriodToHours(period) > MAX_PERIOD_HOURS_INCLUDE_PREVIOUS) {
    return false;
  }

  // otherwise true
  return !!includePrevious;
}
