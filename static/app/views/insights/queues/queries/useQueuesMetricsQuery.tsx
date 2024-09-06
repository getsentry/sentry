import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import type {Referrer} from 'sentry/views/insights/queues/referrers';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/insights/queues/settings';

type Props = {
  referrer: Referrer;
  destination?: string;
  enabled?: boolean;
  transaction?: string;
};

export function useQueuesMetricsQuery({
  destination,
  transaction,
  enabled,
  referrer,
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
