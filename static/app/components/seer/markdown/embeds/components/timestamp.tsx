import {useDateTimeFormatter, DateTime} from '@sentry/scraps/dateTime';
import {getRelativeDate} from '@sentry/scraps/relativeTime';

import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {TimeSince} from 'sentry/components/timeSince';

/**
 * Formatted the way `DateTime` draws it, so a copied date matches the one on
 * screen. A component because the timezone and clock preferences are hooks.
 */
function AbsoluteTimestampMarkdown({value}: {value: EmbedOutput<'timestamp'>['value']}) {
  const formatDateTime = useDateTimeFormatter();
  return formatDateTime(value);
}

export const Timestamp = defineSeerEmbed({
  name: 'timestamp',
  render({format, value}, level) {
    switch (level) {
      case 'markdown':
        // The rendered relative time ticks; a copy fixes it at the moment
        // it was taken.
        return format === 'relative' ? (
          getRelativeDate(value)
        ) : (
          <AbsoluteTimestampMarkdown value={value} />
        );
      case 'block':
      case 'inline':
        return format === 'relative' ? (
          <TimeSince date={value} />
        ) : (
          <DateTime date={value} />
        );
    }
  },
});
