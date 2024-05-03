import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSeries';
import type {SpanMetricsProperty} from 'sentry/views/starfish/types';

type Props = {
  destination?: string;
  enabled?: boolean;
};

const yAxis: SpanMetricsProperty[] = [
  'avg_if(span.self_time,span.op,queue.publish)',
  'avg_if(span.self_time,span.op,queue.process)',
  'avg(messaging.message.receive.latency)',
  'count_op(queue.publish)',
  'count_op(queue.process)',
];

export function useQueuesTimeSeriesQuery({enabled, destination}: Props) {
  return useSpanMetricsSeries({
    yAxis,
    search: destination
      ? MutableSearch.fromQueryObject({
          'messaging.destination.name': destination,
        })
      : undefined,
    referrer: 'api.performance.queues.module-chart',
    enabled,
  });
}
