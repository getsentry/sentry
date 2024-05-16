import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {Referrer} from 'sentry/views/performance/queues/referrers';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/performance/queues/settings';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useDiscover';

type Props = {
  destination?: string;
  enabled?: boolean;
  referrer?: Referrer;
  transaction?: string;
};

export function useQueuesMetricsQuery({
  destination,
  transaction,
  enabled,
  referrer = Referrer.QUEUES_DEFAULT_REFERRER,
}: Props) {
  const mutableSearch = new MutableSearch(DEFAULT_QUERY_FILTER);
  if (destination) {
    mutableSearch.addFilterValue('messaging.destination.name', destination);
  }
  if (transaction) {
    mutableSearch.addFilterValue('transaction', transaction);
  }
  const response = useSpanMetrics(
    {
      search: mutableSearch,
      fields: [
        'count()',
        'count_op(queue.publish)',
        'count_op(queue.process)',
        'sum(span.duration)',
        'avg(span.duration)',
        'avg_if(span.duration,span.op,queue.publish)',
        'avg_if(span.duration,span.op,queue.process)',
        'avg(messaging.message.receive.latency)',
        'trace_status_rate(ok)',
        'time_spent_percentage(app,span.duration)',
      ],
      enabled,
      sorts: [],
      limit: 10,
    },
    referrer
  );

  return response;
}
