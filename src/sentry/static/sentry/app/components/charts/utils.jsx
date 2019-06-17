import moment from 'moment';

import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {parsePeriodToHours} from 'app/utils/dates';

const DEFAULT_TRUNCATE_LENGTH = 80;

// In minutes
const TWENTY_FOUR_HOURS = 1440;
const THIRTY_MINUTES = 30;

export function truncationFormatter(value, truncate) {
  if (!truncate) {
    return value;
  }
  const truncationLength =
    truncate && typeof truncate === 'number' ? truncate : DEFAULT_TRUNCATE_LENGTH;
  return value.length > truncationLength
    ? value.substring(0, truncationLength) + '…'
    : value;
}

/**
 * Use a shorter interval if the time difference is <= 24 hours.
 */
export function useShortInterval(datetimeObj) {
  const diffInMinutes = getDiffInMinutes(datetimeObj);

  return diffInMinutes <= TWENTY_FOUR_HOURS;
}

export function getInterval(datetimeObj, highFidelity = false) {
  const diffInMinutes = getDiffInMinutes(datetimeObj);

  if (diffInMinutes > TWENTY_FOUR_HOURS) {
    // Greater than 24 hours
    if (highFidelity) {
      return '30m';
    } else {
      return '24h';
    }
  } else if (diffInMinutes < THIRTY_MINUTES) {
    // Less than 30 minutes
    if (highFidelity) {
      return '1m';
    } else {
      return '5m';
    }
  } else {
    // Between 30 minutes and 24 hours
    if (highFidelity) {
      return '5m';
    } else {
      return '15m';
    }
  }
}

export function getDiffInMinutes(datetimeObj) {
  const {period, start, end} = datetimeObj;

  if (start && end) {
    return moment(end).diff(start, 'minutes');
  }

  return (
    parsePeriodToHours(typeof period === 'string' ? period : DEFAULT_STATS_PERIOD) * 60
  );
}
