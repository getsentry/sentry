import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {Referrer} from 'sentry/views/performance/queues/referrers';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useDiscoverSeries';
import type {SpanMetricsProperty} from 'sentry/views/starfish/types';

type Props = {
  referrer: Referrer;
  destination?: string;
  enabled?: boolean;
};

const yAxis: SpanMetricsProperty[] = [
  'avg(span.duration)',
  'avg(messaging.message.receive.latency)',
  'spm()',
];

export function useProcessQueuesTimeSeriesQuery({enabled, destination, referrer}: Props) {
  const search = new MutableSearch('span.op:queue.process');
  if (destination) {
    search.addFilterValue('messaging.destination.name', destination, false);
  }

  return useSpanMetricsSeries(
    {
      yAxis,
      search,
      enabled,
    },
    referrer
  );
}
