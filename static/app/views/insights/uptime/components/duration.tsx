import {Text} from 'sentry/components/core/text';
import type {BaseTextProps} from 'sentry/components/core/text/text';
import getDuration from 'sentry/utils/duration/getDuration';
import type {UptimeSummary} from 'sentry/views/alerts/rules/uptime/types';

type UptimeDurationProps = {
  summary: UptimeSummary;
  size?: BaseTextProps['size'];
};

export function UptimeDuration({summary, size}: UptimeDurationProps) {
  if (summary.avgDurationUs === null) {
    return null;
  }

  const avgDurationSeconds = summary.avgDurationUs / 1000000;
  const avgDurationMs = summary.avgDurationUs / 1000;

  const variant: BaseTextProps['variant'] =
    avgDurationMs < 200 ? undefined : avgDurationMs < 500 ? 'warning' : 'danger';

  return (
    <Text tabular size={size} variant={variant}>
      {getDuration(avgDurationSeconds, 0, true)}
    </Text>
  );
}
