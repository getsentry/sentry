import type {Sort} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import type {Referrer} from 'sentry/views/insights/queues/referrers';
import {
  DEFAULT_QUERY_FILTER,
  TABLE_ROWS_LIMIT,
} from 'sentry/views/insights/queues/settings';
import type {SpanMetricsProperty} from 'sentry/views/insights/types';

type Props = {
  referrer: Referrer;
  destination?: string;
  enabled?: boolean;
  sort?: Sort;
};

export function useQueuesByDestinationQuery({
  enabled,
  destination,
  sort,
  referrer,
}: Props) {
  const location = useLocation();
  const cursor = decodeScalar(location.query?.[QueryParameterNames.DESTINATIONS_CURSOR]);
  const useEap = useInsightsEap();

  const timeSpentField: SpanMetricsProperty = useEap
    ? 'time_spent_percentage(span.duration)'
    : 'time_spent_percentage(app,span.duration)';

  if (
    sort?.field === 'time_spent_percentage(span.duration)' ||
    sort?.field === 'time_spent_percentage(app,span.duration)'
  ) {
    sort.field = timeSpentField;
  }

  const mutableSearch = new MutableSearch(DEFAULT_QUERY_FILTER);
  if (destination) {
    mutableSearch.addFilterValue('messaging.destination.name', destination, false);
  }
  const result = useSpanMetrics(
    {
      search: mutableSearch,
      fields: [
        'messaging.destination.name',
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
      sorts: sort ? [sort] : [],
      limit: TABLE_ROWS_LIMIT,
      cursor,
    },
    referrer
  );

  // TODO - temporary until eap is enabled
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
