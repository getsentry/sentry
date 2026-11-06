import {Temporal} from '@js-temporal/polyfill';

import type {DateTimeInput, DateTimePreferences} from '@sentry/scraps/dateTime';

import {getLocaleSnapshot} from 'sentry/locale';
import {getUserTimezone, shouldUse24Hours} from 'sentry/utils/dates';

type ChartDateStyle =
  | 'ordinalDate'
  | 'longOrdinalDate'
  | 'ordinalDateWithYear'
  | 'year'
  | 'timezone'
  | 'replayTime';

export function parseChartDateTime(
  date: DateTimeInput,
  timezone: string
): Temporal.ZonedDateTime | null {
  try {
    const instant =
      typeof date === 'string'
        ? Temporal.Instant.from(date)
        : typeof date === 'number' || date instanceof Date
          ? Temporal.Instant.fromEpochMilliseconds(
              Math.trunc(typeof date === 'number' ? date : date.valueOf())
            )
          : null;
    return instant?.toZonedDateTimeISO(timezone) ?? null;
  } catch (error) {
    if (error instanceof RangeError || error instanceof TypeError) {
      return null;
    }
    throw error;
  }
}

export function formatChartDateTime(
  date: DateTimeInput,
  style: ChartDateStyle,
  {
    timezone = getUserTimezone() ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    clock = shouldUse24Hours() ? '24' : '12',
  }: Partial<DateTimePreferences> = {}
): string {
  const value = parseChartDateTime(date, timezone);
  if (!value) {
    return 'Invalid date';
  }
  const {locale} = getLocaleSnapshot();
  try {
    const base = {timeZone: timezone, calendar: 'gregory'};
    const formatYear = () =>
      new Intl.NumberFormat(locale, {minimumIntegerDigits: 4, useGrouping: false}).format(
        value.year
      );
    if (style === 'year') {
      return formatYear();
    }
    if (style === 'timezone') {
      return (
        new Intl.DateTimeFormat(locale, {...base, timeZoneName: 'short'})
          .formatToParts(value.epochMilliseconds)
          .find(part => part.type === 'timeZoneName')?.value ?? ''
      );
    }
    if (style === 'replayTime') {
      const parts = new Intl.DateTimeFormat(locale, {
        ...base,
        hourCycle: clock === '24' ? 'h23' : 'h12',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
      }).formatToParts(value.epochMilliseconds);
      const part = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find(item => item.type === type)?.value ?? '';
      return `${part('hour')}:${part('minute')}:${part('second')}.${part('fractionalSecond')}`;
    }

    const formatter = new Intl.DateTimeFormat(locale, {
      ...base,
      month: style === 'longOrdinalDate' ? 'long' : 'short',
      day: 'numeric',
      ...(style === 'ordinalDateWithYear' ? {year: 'numeric'} : {}),
    });
    if (new Intl.Locale(locale).language !== 'en') {
      return formatter
        .formatToParts(value.epochMilliseconds)
        .map(part => (part.type === 'year' ? formatYear() : part.value))
        .join('');
    }
    const parts = formatter.formatToParts(value.epochMilliseconds);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find(item => item.type === type)?.value ?? '';
    const category = new Intl.PluralRules(locale, {type: 'ordinal'}).select(value.day);
    const suffix =
      category === 'one'
        ? 'st'
        : category === 'two'
          ? 'nd'
          : category === 'few'
            ? 'rd'
            : 'th';
    return `${part('month')} ${part('day')}${suffix}${style === 'ordinalDateWithYear' ? ` ${formatYear()}` : ''}`;
  } catch (error) {
    if (error instanceof RangeError) {
      return 'Invalid date';
    }
    throw error;
  }
}
