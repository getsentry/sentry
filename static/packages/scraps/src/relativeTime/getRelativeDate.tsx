import moment from 'moment-timezone';

import type {DateTimeInput} from '@sentry/scraps/dateTime';

import {getSnapshot, type FormattingSnapshot} from '../dateTime/config';
import {parseDate} from '../dateTime/parseDate';
import {getDurationWithMessages} from '../duration/getDuration';

export type RelaxedDateType = DateTimeInput;

export interface RelativeTimeOptions {
  prefix?: string;
  /** Fuzzy wording preserves the existing relative-time thresholds. */
  rounding?: 'fuzzy' | 'unit';
  /** Unit width when rounding is "unit". */
  style?: 'long' | 'short' | 'narrow';
  suffix?: string;
}

export function getDateObj(date: RelaxedDateType): Date {
  return typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
}

export function formatRelativeDate(
  date: DateTimeInput,
  {suffix, prefix, style = 'long', rounding = 'fuzzy'}: RelativeTimeOptions,
  snapshot: Readonly<FormattingSnapshot>
): string {
  const value = parseDate(date, snapshot.timezone, snapshot.locale);
  if (!value) {
    return 'Invalid date';
  }
  const now = moment().locale(snapshot.locale);
  const isFuture = value.isAfter(now);
  const duration =
    rounding === 'fuzzy'
      ? value.from(now, true)
      : getDurationWithMessages(
          now.diff(value, 'seconds'),
          {style, absolute: isFuture},
          snapshot.messages
        );

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
