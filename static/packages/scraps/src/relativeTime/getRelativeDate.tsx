import {Temporal} from '@js-temporal/polyfill';

import type {DateTimeInput} from '@sentry/scraps/dateTime';

import {getSnapshot, type FormattingSnapshot} from '../dateTime/config';
import {parseDate} from '../dateTime/parseDate';
import {getDurationWithMessages} from '../duration/getDuration';

export type RelaxedDateType = DateTimeInput;

export interface RelativeTimeOptions {
  prefix?: string;
  /** Fuzzy preserves thresholds; English keeps articles, other locales use numeric counts. */
  rounding?: 'fuzzy' | 'unit';
  /** Unit width when rounding is "unit". */
  style?: 'long' | 'short' | 'narrow';
  suffix?: string;
}

export function getDateObj(date: RelaxedDateType): Date {
  return typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
}

type FuzzyUnit = 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year';

function getFuzzyDuration(
  value: Temporal.ZonedDateTime,
  now: Temporal.ZonedDateTime
): {count: number; unit: FuzzyUnit} {
  const milliseconds = Math.abs(value.epochMilliseconds - now.epochMilliseconds);
  const seconds = Math.round(milliseconds / 1000);
  if (seconds <= 44) {
    return {unit: 'second', count: seconds};
  }
  for (const {unit, size, limit} of [
    {unit: 'minute', size: 60000, limit: 45},
    {unit: 'hour', size: 3600000, limit: 22},
    {unit: 'day', size: 86400000, limit: 26},
  ] as const) {
    const count = Math.round(milliseconds / size);
    if (count <= 1) {
      return {unit, count: 1};
    }
    if (count < limit) {
      return {unit, count};
    }
  }

  const earlier = value.epochNanoseconds < now.epochNanoseconds ? value : now;
  const later = earlier === value ? now : value;
  let wholeMonths = (later.year - earlier.year) * 12 + later.month - earlier.month;
  let anchor: Temporal.ZonedDateTime;
  try {
    anchor = earlier.add({months: wholeMonths});
  } catch (error) {
    if (!(error instanceof RangeError)) {
      throw error;
    }
    // A clamped date in the final supported month can exceed Temporal's range.
    anchor = earlier.add({months: --wholeMonths});
  }
  if (anchor.epochNanoseconds > later.epochNanoseconds) {
    anchor = earlier.add({months: --wholeMonths});
  }
  const remainder = later.epochMilliseconds - anchor.epochMilliseconds;
  const months = wholeMonths + (remainder / 86400000) * (4800 / 146097);
  const roundedMonths = Math.round(months);
  return roundedMonths < 11
    ? {unit: 'month', count: Math.max(1, roundedMonths)}
    : {unit: 'year', count: Math.max(1, Math.round(months / 12))};
}

function englishFuzzyDuration(unit: FuzzyUnit, count: number): string {
  if (unit === 'second') {
    return 'a few seconds';
  }
  if (count === 1) {
    return unit === 'hour' ? 'an hour' : `a ${unit}`;
  }
  return `${count} ${unit}s`;
}

export function formatRelativeDate(
  date: DateTimeInput,
  {suffix, prefix, style = 'long', rounding = 'fuzzy'}: RelativeTimeOptions,
  snapshot: Readonly<FormattingSnapshot>
): string {
  const value = parseDate(date, snapshot.timezone);
  if (!value) {
    return 'Invalid date';
  }
  const now = Temporal.Instant.fromEpochMilliseconds(Date.now()).toZonedDateTimeISO(
    snapshot.timezone
  );
  const isFuture = value.epochNanoseconds > now.epochNanoseconds;
  let duration: string;
  if (rounding === 'fuzzy') {
    const {unit, count} = getFuzzyDuration(value, now);
    const isEnglish = snapshot.locale.toLowerCase().split('-')[0] === 'en';
    if (!isEnglish && (isFuture ? prefix : suffix) === undefined) {
      return new Intl.RelativeTimeFormat(snapshot.locale, {numeric: 'always'}).format(
        isFuture ? count : -count,
        unit
      );
    }
    duration = isEnglish
      ? englishFuzzyDuration(unit, count)
      : new Intl.NumberFormat(snapshot.locale, {
          style: 'unit',
          unit,
          unitDisplay: 'long',
        }).format(count);
  } else {
    duration = getDurationWithMessages(
      Math.trunc((now.epochMilliseconds - value.epochMilliseconds) / 1000),
      {style, absolute: isFuture},
      snapshot.messages
    );
  }

  if (isFuture) {
    if (prefix === undefined) {
      return snapshot.messages.t('in %s', duration);
    }
    return prefix ? `${prefix} ${duration}` : duration;
  }
  if (suffix === undefined) {
    return snapshot.messages.t('%s ago', duration);
  }
  return suffix ? `${duration} ${suffix}` : duration;
}

export function getRelativeDate(
  date: DateTimeInput,
  options: RelativeTimeOptions = {}
): string {
  return formatRelativeDate(date, options, getSnapshot());
}
