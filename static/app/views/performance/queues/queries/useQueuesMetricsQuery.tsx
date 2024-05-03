import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/performance/queues/settings';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';

type Props = {
  destination?: string;
  enabled?: boolean;
  transaction?: string;
};

export function useQueuesMetricsQuery({destination, transaction, enabled}: Props) {
  const mutableSearch = new MutableSearch(DEFAULT_QUERY_FILTER);
  if (destination) {
    mutableSearch.addFilterValue('messaging.destination.name', destination);
  }
  if (transaction) {
    mutableSearch.addFilterValue('transaction', transaction);
  }
  const response = useSpanMetrics({
    search: mutableSearch,
    fields: [
      'count()',
      'count_op(queue.publish)',
      'count_op(queue.process)',
      'sum(span.self_time)',
      'avg(span.self_time)',
      'avg_if(span.self_time,span.op,queue.publish)',
      'avg_if(span.self_time,span.op,queue.process)',
      'avg(messaging.message.receive.latency)',
    ],
    enabled,
    sorts: [],
    limit: 10,
    referrer: 'api.performance.queues.destination-summary',
  });

  return response;
}
