import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/performance/queues/settings';
import {useCheckMessagingMetricExists} from 'sentry/views/performance/queues/utils/useCheckMessagingMetricExists';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useDiscover';
import type {SpanMetricsProperty} from 'sentry/views/starfish/types';

type Props = {
  destination?: string;
  enabled?: boolean;
  transaction?: string;
};

const fields: SpanMetricsProperty[] = [
  'count()',
  'count_op(queue.publish)',
  'count_op(queue.process)',
  'sum(span.duration)',
  'avg(span.duration)',
  'avg_if(span.duration,span.op,queue.publish)',
  'avg_if(span.duration,span.op,queue.process)',
  'avg(messaging.message.receive.latency)',
];

export function useQueuesMetricsQuery({destination, transaction, enabled}: Props) {
  const {isLoading, receiveLatencyExists} = useCheckMessagingMetricExists();
  const mutableSearch = new MutableSearch(DEFAULT_QUERY_FILTER);
  if (destination) {
    mutableSearch.addFilterValue('messaging.destination.name', destination);
  }
  if (transaction) {
    mutableSearch.addFilterValue('transaction', transaction);
  }
  const response = useSpanMetrics({
    search: mutableSearch,
    fields: fields.filter(
      aggregate =>
        aggregate !== 'avg(messaging.message.receive.latency)' || receiveLatencyExists
    ),
    enabled: enabled && !isLoading,
    sorts: [],
    limit: 10,
    referrer: 'api.performance.queues.destination-summary',
  });

  return response;
}
