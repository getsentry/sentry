import moment from 'moment-timezone';

import type {DateTimeInput, DateTimePreferences} from '@sentry/scraps/dateTime';

import {getLocaleSnapshot} from 'sentry/locale';
import {getUserTimezone, shouldUse24Hours} from 'sentry/utils/dates';

const formats = {
  ordinalDate: 'MMM Do',
  longOrdinalDate: 'MMMM Do',
  ordinalDateWithYear: 'MMM Do YYYY',
  year: 'YYYY',
  timezone: 'z',
} as const;

// shortcut: preserves axis ordinals, OAuth dates, and replay's missing day period until Moment is removed.
export function formatChartDateTime(
  date: DateTimeInput,
  style: keyof typeof formats | 'replayTime',
  {
    timezone = getUserTimezone() ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    clock = shouldUse24Hours() ? '24' : '12',
  }: Partial<DateTimePreferences> = {}
): string {
  if (!moment.tz.zone(timezone)) {
    return 'Invalid date';
  }
  const value = moment.tz(date, timezone).locale(getLocaleSnapshot().locale);
  return value.format(
    style === 'replayTime'
      ? clock === '24'
        ? 'HH:mm:ss.SSS'
        : 'hh:mm:ss.SSS'
      : formats[style]
  );
}
