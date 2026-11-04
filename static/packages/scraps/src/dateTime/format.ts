import {Temporal} from '@js-temporal/polyfill';

import {getSnapshot, type DateTimePreferences, type FormattingSnapshot} from './config';
import {parseDate} from './parseDate';

/** Numbers are epoch milliseconds; strings must be ISO timestamps with an offset. */
export type DateTimeInput = Date | number | string;
export type TimePrecision = 'minute' | 'second' | 'millisecond';
export type YearDisplay = 'auto' | 'always' | 'never';

export type DateTimeOptions = Partial<DateTimePreferences> & {
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

export function formatTimezone(
  epochMilliseconds: number,
  timezone: string,
  locale: string
) {
  if (timezone === 'UTC') {
    return 'UTC';
  }
  return (
    new Intl.DateTimeFormat(locale, {timeZone: timezone, timeZoneName: 'short'})
      .formatToParts(epochMilliseconds)
      .find(part => part.type === 'timeZoneName')?.value ?? ''
  );
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
  // The suffix follows the caller pinning the render to UTC, not the viewer's own
  // timezone preference happening to be UTC.
  const showTimezone = options.showTimezone ?? options.timezone === 'UTC';

  const value = parseDate(date, timezone);
  if (!value) {
    return 'Invalid date';
  }

  const currentYear = Temporal.Instant.fromEpochMilliseconds(
    Date.now()
  ).toZonedDateTimeISO(timezone).year;
  const showYear = year === 'always' || (year === 'auto' && value.year !== currentYear);
  const dateParts = new Intl.DateTimeFormat(snapshot.locale, {
    calendar: 'gregory',
    timeZone: timezone,
    year: showYear ? 'numeric' : undefined,
    month: 'short',
    day: 'numeric',
  }).formatToParts(value.epochMilliseconds);
  const dateText = dateParts
    .map(part =>
      part.type === 'year' && value.year < 1000
        ? new Intl.NumberFormat(snapshot.locale, {
            minimumIntegerDigits: 4,
            useGrouping: false,
          }).format(value.year)
        : part.value
    )
    .join('');
  const timeText = new Intl.DateTimeFormat(snapshot.locale, {
    timeZone: timezone,
    hour: clock === '24' ? '2-digit' : 'numeric',
    minute: '2-digit',
    second: precision === 'minute' ? undefined : '2-digit',
    fractionalSecondDigits: precision === 'millisecond' ? 3 : undefined,
    hourCycle: clock === '24' ? 'h23' : 'h12',
  })
    .format(value.epochMilliseconds)
    .replaceAll('\u202F', ' ');
  const text =
    mode === 'date'
      ? dateText
      : mode === 'time'
        ? timeText
        : `${dateText}${showYear ? ' ' : ', '}${timeText}`;
  return showTimezone
    ? `${text} ${formatTimezone(value.epochMilliseconds, timezone, snapshot.locale)}`
    : text;
}
