import moment from 'moment-timezone';

import {useDateTimeFormatter, DateTime} from '@sentry/scraps/dateTime';
import {getRelativeDate} from '@sentry/scraps/relativeTime';

import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {TimeSince} from 'sentry/components/timeSince';

type TimestampValue = EmbedOutput<'timestamp'>['value'];

const CALENDAR_DATE_OPTIONS = {
  mode: 'date',
  timezone: 'UTC',
  showTimezone: false,
} as const;

/**
 * Agents copy page filter times, which have no offset and mean UTC. A
 * calendar date names a day, so it is drawn without shifting into the
 * viewer's timezone.
 */
function parseTimestampValue(value: TimestampValue) {
  return {
    date: moment.utc(value).toDate(),
    options: value.includes('T') ? undefined : CALENDAR_DATE_OPTIONS,
  };
}

/**
 * Formatted the way `DateTime` draws it, so a copied date matches the one on
 * screen. A component because the timezone and clock preferences are hooks.
 */
function AbsoluteTimestampMarkdown({value}: {value: TimestampValue}) {
  const formatDateTime = useDateTimeFormatter();
  const {date, options} = parseTimestampValue(value);
  return formatDateTime(date, options);
}

export const Timestamp = defineSeerEmbed({
  name: 'timestamp',
  render({format, value}, level) {
    switch (level) {
      case 'markdown':
        // The rendered relative time ticks; a copy fixes it at the moment
        // it was taken.
        return format === 'relative' ? (
          getRelativeDate(parseTimestampValue(value).date)
        ) : (
          <AbsoluteTimestampMarkdown value={value} />
        );
      case 'block':
      case 'inline': {
        const {date, options} = parseTimestampValue(value);
        return format === 'relative' ? (
          <TimeSince date={date} />
        ) : (
          <DateTime date={date} {...options} />
        );
      }
    }
  },
});
