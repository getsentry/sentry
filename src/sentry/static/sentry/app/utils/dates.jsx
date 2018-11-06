import moment from 'moment';

export const DEFAULT_DAY_START_TIME = '00:00:00';
export const DEFAULT_DAY_END_TIME = '23:59:59';

function getParser(local = false) {
  return local ? moment : moment.utc;
}

/**
 * Return a date object in local time, when given a UTC timestamp
 */
export function getLocalDateObject(date) {
  return moment.utc(date).toDate();
}

/**
 * Given a date object, format in datetime in UTC
 * given: Tue Oct 09 2018 00:00:00 GMT-0700 (Pacific Daylight Time)
 * returns: "2018-10-09T07:00:00.000"
 */
export function getUtcDateString(dateObj) {
  return moment.utc(dateObj).format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS);
}

export function getFormattedDate(dateObj, format, {local} = {}) {
  return getParser(local)(dateObj).format(format);
}

/**
 * Sets time (hours + minutes) of the current date object
 *
 * @param {String} timeStr Time in 24hr format (HH:mm)
 */
export function setDateToTime(dateObj, timeStr, {local} = {}) {
  const [hours, minutes, seconds] = timeStr.split(':');

  const date = getParser(local)(dateObj)
    .set('hours', hours)
    .set('minutes', minutes);

  if (typeof seconds !== 'undefined') {
    date.set('seconds', seconds);
  }

  return date.toDate();
}

/**
 * Given a UTC timestamp, return a local date object with the same date
 * e.g. given: 1/1/2001 @ 22:00 UTC, return:  1/1/2001 @ 22:00 GMT-7
 */
export function getUtcInLocal(dateObj) {
  const utc = moment.utc(dateObj);
  const format = 'YYYY-MM-DD HH:mm:ss';

  return moment(utc.format(format), format).toDate();
}

/**
 * Because our date picker library does not support display dates in UTC, we need
 * to make a fake date object for date picker to use.
 */
export function getCoercedUtcOrLocalDate(date, {local} = {}) {
  if (local) {
    return getLocalDateObject(date);
  }

  return getUtcInLocal(date);
}

/**
 * Given a local date, return a UTC date object with the same date
 * e.g. given: 1/1/2001 @ 22:00 GMT-7, return:  1/1/2001 @ 22:00 UTC
 */
export function getLocalToUtc(dateObj) {
  const localDate = moment(dateObj);
  const format = 'YYYY-MM-DD HH:mm:ss';

  return moment.utc(localDate.format(format), format).toDate();
}

// Get the beginning of day (e.g. midnight)
export function getStartOfDay(date, {local} = {}) {
  return getParser(local)(date)
    .hour(0)
    .minute(0)
    .second(0)
    .toDate();
}

// Get tomorrow at midnight so that default endtime
// is inclusive of today
export function getEndOfDay(date, {local} = {}) {
  return getParser(local)(date)
    .add(1, 'day')
    .hour(0)
    .minute(0)
    .second(0)
    .subtract(1, 'second')
    .toDate();
}

function getStartOfPeriodAgo(period, unit, options) {
  return getStartOfDay(moment().subtract(period, unit), options);
}

export function getDaysAgo(days, options) {
  // Get date "days" ago at midnight
  return getStartOfPeriodAgo(days, 'days', options);
}

export function getHoursAgo(hours, options) {
  // Get date "hours" ago at midnight
  return getStartOfPeriodAgo(hours, 'hours', options);
}
