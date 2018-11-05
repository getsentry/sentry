import moment from 'moment';

import {RETENTION_DAYS} from 'app/constants';

function getParser(local = false) {
  return local ? moment : moment.utc;
}

/**
 * Returns date "RETENTION_DAYS" ago
 */
export function getEarliestRetentionDate() {
  return moment()
    .subtract(RETENTION_DAYS, 'days')
    .toDate();
}

/**
 * Return a date object in local time, when given a UTC timestamp
 */
export function getLocalDateObject(str) {
  return moment.utc(str).toDate();
}

/**
 * Given a date object, format in datetime in UTC
 * given: Tue Oct 09 2018 00:00:00 GMT-0700 (Pacific Daylight Time)
 * returns: "2018-10-09T07:00:00.000"
 */
export function getUtcDateString(dateObj) {
  return moment.utc(dateObj).format(moment.HTML5_FMT.DATETIME_LOCAL_MS);
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
 * Given a local date, return a UTC date object with the same date
 * e.g. given: 1/1/2001 @ 22:00 GMT-7, return:  1/1/2001 @ 22:00 UTC
 */
export function getLocalToUtc(dateObj) {
  const localDate = moment(dateObj);
  const format = 'YYYY-MM-DD HH:mm:ss';

  return moment.utc(localDate.format(format), format).toDate();
}

export function isSameDay(start, end) {
  return (
    moment(start)
      .add(1, 'day')
      .subtract(1, 'second') === moment(end)
  );
}

// Get the beginning of day (e.g. midnight)
export function getStartOfDay(date) {
  return moment(date)
    .hour(0)
    .minute(0)
    .second(0)
    .toDate();
}

// Get tomorrow at midnight so that default endtime
// is inclusive of today
export function getEndOfDay(date) {
  return moment(date)
    .add(1, 'day')
    .hour(0)
    .minute(0)
    .second(0)
    .subtract(1, 'second')
    .toDate();
}

export function getHoursAgo(hours) {
  // Get date "days" ago at midnight
  return getStartOfDay(moment().subtract(hours, 'hours'));
}
