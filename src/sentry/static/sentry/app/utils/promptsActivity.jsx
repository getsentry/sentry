import moment from 'moment';

/**
 * Given a snoozed unix timestamp in seconds,
 * returns the number of days since the prompt was snoozed
 *
 * @param {Number} snoozed_ts Snoozed timestamp
 */
export function snoozedDays(snoozed_ts) {
  const now = moment.utc();
  const snoozedDay = moment.unix(snoozed_ts).utc();
  return now.diff(snoozedDay, 'days');
}
