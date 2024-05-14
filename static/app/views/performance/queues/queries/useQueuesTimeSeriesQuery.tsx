import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/performance/queues/settings';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useDiscoverSeries';
import type {SpanMetricsProperty} from 'sentry/views/starfish/types';

type Props = {
  destination?: string;
  enabled?: boolean;
};

const yAxis: SpanMetricsProperty[] = [
  'avg_if(span.duration,span.op,queue.publish)',
  'avg_if(span.duration,span.op,queue.process)',
  'avg(messaging.message.receive.latency)',
  'count_op(queue.publish)',
  'count_op(queue.process)',
];

export function useQueuesTimeSeriesQuery({enabled, destination}: Props) {
  const mutableSearch = new MutableSearch(DEFAULT_QUERY_FILTER);
  if (destination) {
    mutableSearch.addFilterValue('messaging.destination.name', destination, false);
  }

  return useSpanMetricsSeries(
    {
      yAxis,
      search: mutableSearch,
      enabled,
    },
    'api.performance.queues.module-chart'
  );
}
