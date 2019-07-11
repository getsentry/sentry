import moment from 'moment';

/**
 * Given a snoozed unix timestamp in seconds,
 * returns the number of days since the prompt was snoozed
 *
 * @param {Number} snoozedTs Snoozed timestamp
 */
export function snoozedDays(snoozedTs) {
  const now = moment.utc();
  const snoozedDay = moment.unix(snoozedTs).utc();
  return now.diff(snoozedDay, 'days');
}
