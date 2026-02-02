import {Text} from '@sentry/scraps/text';
import type {TextProps} from '@sentry/scraps/text';

import getDuration from 'sentry/utils/duration/getDuration';
import type {UptimeSummary} from 'sentry/views/alerts/rules/uptime/types';

type UptimeDurationProps = {
  summary: UptimeSummary;
  size?: TextProps<'span'>['size'];
};

export function UptimeDuration({summary, size}: UptimeDurationProps) {
  const avgDurationSeconds = summary.avgDurationUs / 1000000;
  const avgDurationMs = summary.avgDurationUs / 1000;

  const variant: TextProps<'span'>['variant'] =
    avgDurationMs < 200 ? undefined : avgDurationMs < 500 ? 'warning' : 'danger';

  return (
    <Text tabular size={size} variant={variant}>
      {getDuration(avgDurationSeconds, 0, true)}
    </Text>
  );
}
