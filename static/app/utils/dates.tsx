import moment from 'moment';

import {parseStatsPeriod} from 'sentry/components/organizations/pageFilters/parse';
import ConfigStore from 'sentry/stores/configStore';
import {DateString} from 'sentry/types';

// TODO(billy): Move to TimeRangeSelector specific utils
export const DEFAULT_DAY_START_TIME = '00:00:00';
export const DEFAULT_DAY_END_TIME = '23:59:59';
const DATE_FORMAT_NO_TIMEZONE = 'YYYY/MM/DD HH:mm:ss';

function getParser(local: boolean = false): typeof moment | typeof moment.utc {
  return local ? moment : moment.utc;
}

/**
 * Checks if string is valid time. Only accepts 24 hour format.
 *
 * Chrome's time input will (at least for US locale), allow you to input 12
 * hour format with AM/PM but the raw value is in 24 hour.
 *
 * Safari does not do any validation so you could get a value of > 24 hours
 */
export function isValidTime(str: string): boolean {
  return moment(str, 'HH:mm', true).isValid();
}

/**
 * Given a date object, format in datetime in UTC
 * given: Tue Oct 09 2018 00:00:00 GMT-0700 (Pacific Daylight Time)
 * returns: "2018-10-09T07:00:00.000"
 */
export function getUtcDateString(dateObj: moment.MomentInput): string {
  return moment.utc(dateObj).format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS);
}

export function getFormattedDate(
  dateObj: moment.MomentInput,
  format: string,
  {local}: {local?: boolean} = {}
): string {
  return getParser(local)(dateObj).format(format);
}

/**
 * Returns user timezone from their account preferences
 */
export function getUserTimezone(): string {
  return ConfigStore.get('user')?.options?.timezone;
}

/**
 * Given a UTC date, return a Date object in local time
 */
export function getUtcToLocalDateObject(date: moment.MomentInput): Date {
  return moment.utc(date).local().toDate();
}

/**
 * Sets time (hours + minutes) of the current date object
 *
 * @param timeStr Time in 24hr format (HH:mm)
 */
export function setDateToTime(
  dateObj: string | Date,
  timeStr: string,
  {local}: {local?: boolean} = {}
): Date {
  const [hours, minutes, seconds] = timeStr.split(':').map(t => parseInt(t, 10));

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
export function getUtcToSystem(dateObj: moment.MomentInput): Date {
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
export function getLocalToSystem(dateObj: moment.MomentInput): Date {
  // This is required because if your system timezone !== user configured timezone
  // then there will be a mismatch of dates with `react-date-picker`
  //
  // We purposely strip the timezone when formatting from the utc timezone
  return new Date(moment(dateObj).format(DATE_FORMAT_NO_TIMEZONE));
}

/**
 * Get the beginning of day (e.g. midnight)
 */
export function getStartOfDay(date: moment.MomentInput): Date {
  return moment(date)
    .startOf('day')
    .startOf('hour')
    .startOf('minute')
    .startOf('second')
    .local()
    .toDate();
}

/**
 * Get tomorrow at midnight so that default endtime is inclusive of today
 */
export function getEndOfDay(date: moment.MomentInput): Date {
  return moment(date)
    .add(1, 'day')
    .startOf('hour')
    .startOf('minute')
    .startOf('second')
    .subtract(1, 'second')
    .local()
    .toDate();
}

export function getPeriodAgo(
  period: moment.unitOfTime.DurationConstructor,
  unit: number
): moment.Moment {
  return moment().local().subtract(unit, period);
}

/**
 * Get the start of the day (midnight) for a period ago
 *
 * e.g. 2 weeks ago at midnight
 */
export function getStartOfPeriodAgo(
  period: moment.unitOfTime.DurationConstructor,
  unit: number
): Date {
  return getStartOfDay(getPeriodAgo(period, unit));
}

/**
 * Convert an interval string into a number of seconds.
 * This allows us to create end timestamps from starting ones
 * enabling us to find events in narrow windows.
 *
 * @param {String} interval The interval to convert.
 * @return {Integer}
 */
export function intervalToMilliseconds(interval: string): number {
  const pattern = /^(\d+)(w|d|h|m)$/;
  const matches = pattern.exec(interval);
  if (!matches) {
    return 0;
  }
  const [, value, unit] = matches;
  const multipliers = {
    w: 60 * 60 * 24 * 7,
    d: 60 * 60 * 24,
    h: 60 * 60,
    m: 60,
  };
  return parseInt(value, 10) * multipliers[unit] * 1000;
}

/**
 * This parses our period shorthand strings (e.g. <int><unit>)
 * and converts it into hours
 */
export function parsePeriodToHours(str: string): number {
  const result = parseStatsPeriod(str);

  if (!result) {
    return -1;
  }

  const {period, periodLength} = result;

  const periodNumber = parseInt(period, 10);

  switch (periodLength) {
    case 's':
      return periodNumber / (60 * 60);
    case 'm':
      return periodNumber / 60;
    case 'h':
      return periodNumber;
    case 'd':
      return periodNumber * 24;
    case 'w':
      return periodNumber * 24 * 7;
    default:
      return -1;
  }
}

export function statsPeriodToDays(
  statsPeriod?: string | null,
  start?: DateString,
  end?: DateString
) {
  if (statsPeriod && statsPeriod.endsWith('d')) {
    return parseInt(statsPeriod.slice(0, -1), 10);
  }
  if (statsPeriod && statsPeriod.endsWith('h')) {
    return parseInt(statsPeriod.slice(0, -1), 10) / 24;
  }
  if (start && end) {
    return (new Date(end).getTime() - new Date(start).getTime()) / (24 * 60 * 60 * 1000);
  }
  return 0;
}

/**
 * Does the user prefer a 24 hour clock?
 */
export function shouldUse24Hours() {
  return ConfigStore.get('user')?.options?.clock24Hours;
}

/**
 * Get a common date format
 */
export function getDateFormat({year}: {year?: boolean}) {
  // "Jan 1, 2022" or "Jan 1"
  return year ? 'MMM D, YYYY' : 'MMM D';
}

/**
 * Get a common time format
 */
export function getTimeFormat({
  clock24Hours,
  seconds,
  timeZone,
}: {
  clock24Hours?: boolean;
  seconds?: boolean;
  timeZone?: boolean;
} = {}) {
  let format = '';

  if (clock24Hours ?? shouldUse24Hours()) {
    format = seconds ? 'HH:mm:ss' : 'HH:mm';
  } else {
    format = seconds ? 'LTS' : 'LT';
  }

  if (timeZone) {
    format += ' z';
  }

  return format;
}

interface FormatProps {
  /**
   * Should show a 24hour clock? If not set the users preference will be used
   */
  clock24Hours?: boolean;
  /**
   * If true, will only return the date part, e.g. "Jan 1".
   */
  dateOnly?: boolean;
  /**
   * Whether to show the seconds.
   */
  seconds?: boolean;
  /**
   * If true, will only return the time part, e.g. "2:50 PM"
   */
  timeOnly?: boolean;
  /**
   * Whether to show the time zone.
   */
  timeZone?: boolean;
  /**
   * Whether to show the year. If not specified, the returned date string will
   * not contain the year _if_ the date is not in the current calendar year.
   * For example: "Feb 1" (2022), "Jan 1" (2022), "Dec 31, 2021".
   */
  year?: boolean;
}

export function getFormat({
  dateOnly,
  timeOnly,
  year,
  seconds,
  timeZone,
  clock24Hours,
}: FormatProps = {}) {
  if (dateOnly) {
    return getDateFormat({year});
  }

  if (timeOnly) {
    return getTimeFormat({clock24Hours, seconds, timeZone});
  }

  const dateFormat = getDateFormat({year});
  const timeFormat = getTimeFormat({
    clock24Hours,
    seconds,
    timeZone,
  });

  // If the year is shown, then there's already a comma in dateFormat ("Jan 1, 2020"),
  // so we don't need to add another comma between the date and time
  return year ? `${dateFormat} ${timeFormat}` : `${dateFormat}, ${timeFormat}`;
}

export function getInternalDate(date: string | Date, utc?: boolean | null) {
  if (utc) {
    return getUtcToSystem(date);
  }
  return new Date(
    moment.tz(moment.utc(date), getUserTimezone()).format('YYYY/MM/DD HH:mm:ss')
  );
}

/**
 * Strips timezone from local date, creates a new moment date object with timezone
 * returns the moment as a Date object
 */
export function getDateWithTimezoneInUtc(date?: Date, utc?: boolean | null) {
  return moment
    .tz(
      moment(date).local().format('YYYY-MM-DD HH:mm:ss'),
      utc ? 'UTC' : getUserTimezone()
    )
    .utc()
    .toDate();
}
