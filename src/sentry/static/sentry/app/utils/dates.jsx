import moment from 'moment';

import ConfigStore from 'app/stores/configStore';

// TODO(billy): Move to TimeRangeSelector specific utils
export const DEFAULT_DAY_START_TIME = '00:00:00';
export const DEFAULT_DAY_END_TIME = '23:59:59';
const DATE_FORMAT_NO_TIMEZONE = 'YYYY-MM-DD HH:mm:ss';

function getParser(local = false) {
  return local ? moment : moment.utc;
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
 * Returns user timezone from their account preferences
 */
export function getUserTimezone() {
  const user = ConfigStore.get('user');
  return user && user.options && user.options.timezone;
}

// TODO(billy): The below functions should be refactored to a TimeRangeSelector specific utils

/**
 * Given a UTC date, return a Date object in local time
 */
export function getUtcToLocalDateObject(date) {
  return moment
    .utc(date)
    .local()
    .toDate();
}

/**
 * Sets time (hours + minutes) of the current date object
 *
 * @param {String} timeStr Time in 24hr format (HH:mm)
 */
export function setDateToTime(dateObj, timeStr, {local} = {}) {
  const [hours, minutes, seconds] = timeStr.split(':');

  const date = new Date(+dateObj);

  if (local) {
    date.setHours(hours, minutes);
  } else {
    date.setUTCHours(hours, minutes);
  }

  if (typeof seconds !== 'undefined') {
    date.setSeconds(seconds);
  }

  return date;
}

/**
 * Given a UTC timestamp, return a system date object with the same date
 * e.g. given: system is -0700 (PST),
 * 1/1/2001 @ 22:00 UTC, return:  1/1/2001 @ 22:00 -0700 (PST)
 */
export function getUtcToSystem(dateObj) {
  // This is required because if your system timezone !== user configured timezone
  // then there will be a mismatch of dates with `react-date-picker`
  //
  // We purposely strip the timezone when formatting from the utc timezone
  return new Date(moment.utc(dateObj).format(DATE_FORMAT_NO_TIMEZONE));
}

/**
 * Given a timestamp, format to user preference timezone, and strip timezone to
 * return a system date object with the same date
 *
 * e.g. given: system is -0700 (PST) and user preference is -0400 (EST),
 * 1/1/2001 @ 22:00 UTC --> 1/1/2001 @ 18:00 -0400 (EST) -->
 * return:  1/1/2001 @ 18:00 -0700 (PST)
 */
export function getLocalToSystem(dateObj) {
  // This is required because if your system timezone !== user configured timezone
  // then there will be a mismatch of dates with `react-date-picker`
  //
  // We purposely strip the timezone when formatting from the utc timezone
  return new Date(moment(dateObj).format(DATE_FORMAT_NO_TIMEZONE));
}

// Get the beginning of day (e.g. midnight)
export function getStartOfDay(date) {
  return moment(date)
    .startOf('day')
    .startOf('hour')
    .startOf('minute')
    .startOf('second')
    .local()
    .toDate();
}

// Get tomorrow at midnight so that default endtime
// is inclusive of today
export function getEndOfDay(date) {
  return moment(date)
    .add(1, 'day')
    .startOf('hour')
    .startOf('minute')
    .startOf('second')
    .subtract(1, 'second')
    .local()
    .toDate();
}

export function getPeriodAgo(period, unit) {
  return moment()
    .local()
    .subtract(period, unit);
}

// Get the start of the day (midnight) for a period ago
//
// e.g. 2 weeks ago at midnight
export function getStartOfPeriodAgo(period, unit, options) {
  return getStartOfDay(getPeriodAgo(period, unit), options);
}
