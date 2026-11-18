import moment from 'moment-timezone';

import {getSnapshot, type DateTimePreferences, type FormattingSnapshot} from './config';
import {parseDate} from './parseDate';

/** Numbers are epoch milliseconds; strings must be ISO timestamps with an offset. */
export type DateTimeInput = Date | number | string;
export type TimePrecision = 'minute' | 'second' | 'millisecond';
export type YearDisplay = 'auto' | 'always' | 'never';

export type DateTimeOptions = Partial<DateTimePreferences> & {
  /** Defaults to true only when the caller explicitly selects timezone "UTC". */
  showTimezone?: boolean;
} & (
    | {mode?: 'dateTime'; precision?: TimePrecision; year?: YearDisplay}
    | {mode: 'date'; precision?: never; year?: YearDisplay}
    | {mode: 'time'; precision?: TimePrecision; year?: never}
  );

export function formatDateTime(
  date: DateTimeInput,
  options: DateTimeOptions = {}
): string {
  return formatDateTimeWithSnapshot(date, options, getSnapshot());
}

export function formatDateTimeWithSnapshot(
  date: DateTimeInput,
  options: DateTimeOptions,
  snapshot: Readonly<FormattingSnapshot>
): string {
  const {
    mode = 'dateTime',
    clock = snapshot.clock,
    year = 'auto',
    precision = 'minute',
  } = options;
  const timezone = options.timezone ?? snapshot.timezone;
  const showTimezone = options.showTimezone ?? options.timezone === 'UTC';

  const value = parseDate(date, timezone, snapshot.locale);
  if (!value) {
    return 'Invalid date';
  }

  const showYear =
    year === 'always' || (year === 'auto' && value.year() !== moment.tz(timezone).year());
  const dateFormat = showYear ? 'MMM D, YYYY' : 'MMM D';
  let timeFormat = clock === '24' ? 'HH:mm' : 'h:mm';
  if (precision !== 'minute') {
    timeFormat += ':ss';
  }
  if (precision === 'millisecond') {
    timeFormat += '.SSS';
  }
  if (clock === '12') {
    timeFormat += ' A';
  }

  let format =
    mode === 'date'
      ? dateFormat
      : mode === 'time'
        ? timeFormat
        : `${dateFormat}${showYear ? ' ' : ', '}${timeFormat}`;
  if (showTimezone) {
    format += ' z';
  }
  return value.format(format);
}
