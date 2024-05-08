import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useCheckMessagingMetricExists} from 'sentry/views/performance/queues/utils/useCheckMessagingMetricExists';
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
  const {isLoading, receiveLatencyExists} = useCheckMessagingMetricExists();
  return useSpanMetricsSeries({
    yAxis: yAxis.filter(
      aggregate =>
        aggregate !== 'avg(messaging.message.receive.latency)' || receiveLatencyExists
    ),
    search: destination
      ? MutableSearch.fromQueryObject({
          'messaging.destination.name': destination,
        })
      : undefined,
    referrer: 'api.performance.queues.module-chart',
    enabled: enabled && !isLoading,
  });
}
