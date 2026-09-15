import moment from 'moment-timezone';

import {useClockDisplay, useTimezone} from '@sentry/scraps/datetime';

import {DateTime} from 'sentry/components/dateTime';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {TimeSince, getRelativeDate} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {getFormat} from 'sentry/utils/dates';

/**
 * The absolute timestamp as text, formatted the way `DateTime` would draw it --
 * same viewer timezone, same clock preference, same shared `getFormat` rules --
 * so a copied date reads as the one on screen rather than as a raw ISO string.
 *
 * A component rather than a plain helper because both preferences come from
 * hooks, and the markdown level is only one branch of the embed's render.
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
        // The rendered relative time ticks; a copy is taken once, so it says
        // how long ago the event was at the moment it was copied.
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
