import moment from 'moment-timezone';

import {useClockDisplay, useTimezone} from '@sentry/scraps/datetime';

import {DateTime} from 'sentry/components/dateTime';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {TimeSince, getRelativeDate} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {getFormat} from 'sentry/utils/dates';

/**
 * Formatted the way `DateTime` draws it, so a copied date matches the one on
 * screen. A component because the timezone and clock preferences are hooks.
 */
function AbsoluteTimestampMarkdown({value}: {value: EmbedOutput<'timestamp'>['value']}) {
  const clockDisplay = useClockDisplay();
  const timeZone = useTimezone();

  return moment.tz(value, timeZone).format(
    getFormat({
      year: moment.tz(timeZone).year() !== moment.tz(value, timeZone).year(),
      clock24Hours: clockDisplay === '24',
    })
  );
}

export const Timestamp = defineSeerEmbed({
  name: 'timestamp',
  render({format, value}, level) {
    switch (level) {
      case 'markdown':
        // The rendered relative time ticks; a copy fixes it at the moment
        // it was taken.
        return format === 'relative' ? (
          getRelativeDate(value, t('ago'), t('in'))
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
