import {MutableSearch} from 'sentry/utils/tokenizeSearch';
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
  return useSpanMetricsSeries(
    {
      yAxis,
      search: destination
        ? MutableSearch.fromQueryObject({
            'messaging.destination.name': destination,
          })
        : undefined,
      enabled,
    },
    'api.performance.queues.module-chart'
  );
}
