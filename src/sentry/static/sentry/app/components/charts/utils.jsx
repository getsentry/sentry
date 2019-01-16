import moment from 'moment';

const DEFAULT_TRUNCATE_LENGTH = 80;

export function truncationFormatter(value, truncate) {
  if (!truncate) {
    return value;
  }
  let truncationLength =
    truncate && typeof truncate === 'number' ? truncate : DEFAULT_TRUNCATE_LENGTH;
  return value.length > truncationLength
    ? value.substring(0, truncationLength) + '…'
    : value;
}

/**
 * Use a shorter interval if the time difference is <= 24 hours.
 */
export function useShortInterval(datetimeObj) {
  const {period, start, end} = datetimeObj;

  if (typeof period === 'string') {
    return period.endsWith('h') || period === '1d';
  }

  return moment(end).diff(start, 'hours') <= 24;
}

export function getInterval(datetimeObj) {
  return useShortInterval(datetimeObj) ? '5m' : '30m';
}
