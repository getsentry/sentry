import {t} from 'sentry/locale';
import {useProcessQueuesTimeSeriesQuery} from 'sentry/views/insights/queues/queries/useProcessQueuesTimeSeriesQuery';
import type {Referrer} from 'sentry/views/insights/queues/referrers';

import {InsightsAreaChartWidget} from '../../common/components/insightsAreaChartWidget';
import {FIELD_ALIASES} from '../settings';

interface Props {
  referrer: Referrer;
  destination?: string;
  error?: Error | null;
}

export function LatencyChart({error, destination, referrer}: Props) {
  const {
    data,
    isPending,
    error: latencyError,
  } = useProcessQueuesTimeSeriesQuery({
    destination,
    referrer,
  });

  return (
    <InsightsAreaChartWidget
      title={t('Average Duration')}
      series={[
        data['avg(messaging.message.receive.latency)'],
        data['avg(span.duration)'],
      ]}
      aliases={FIELD_ALIASES}
      error={error ?? latencyError}
      isLoading={isPending}
    />
  );
}
