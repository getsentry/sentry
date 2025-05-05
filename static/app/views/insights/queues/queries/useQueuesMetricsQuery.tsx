import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import type {Referrer} from 'sentry/views/insights/queues/referrers';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/insights/queues/settings';
import type {SpanMetricsProperty} from 'sentry/views/insights/types';

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
  const useEap = useInsightsEap();
  if (destination) {
    mutableSearch.addFilterValue('messaging.destination.name', destination);
  }
  if (transaction) {
    mutableSearch.addFilterValue('transaction', transaction);
  }

  const timeSpentField: SpanMetricsProperty = useEap
    ? 'time_spent_percentage(span.duration)'
    : 'time_spent_percentage(app,span.duration)';

  const result = useSpanMetrics(
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
        timeSpentField,
      ],
      enabled,
      sorts: [],
      limit: 10,
    },
    referrer
  );

  // TODO - temporary utn
  const finalData = result.data.map(item => ({
    ...item,
    ['time_spent_percentage(span.duration)']: item[timeSpentField] ?? 0,
  }));

  if (result.meta?.fields) {
    result.meta.fields['time_spent_percentage(span.duration)'] = 'percentage';
  }

  return {
    ...result,
    data: finalData,
  };
}
