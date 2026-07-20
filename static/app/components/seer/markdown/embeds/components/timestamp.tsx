import {DateTime} from 'sentry/components/dateTime';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {TimeSince} from 'sentry/components/timeSince';

export const Timestamp = defineSeerEmbed({
  name: 'timestamp',
  render({format, value}) {
    if (format === 'relative') {
      return <TimeSince date={value} />;
    }
    return <DateTime date={value} />;
  },
});
