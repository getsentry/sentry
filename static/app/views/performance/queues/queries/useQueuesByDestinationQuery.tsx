import type {Sort} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import type {Referrer} from 'sentry/views/performance/queues/referrers';
import {
  DEFAULT_QUERY_FILTER,
  TABLE_ROWS_LIMIT,
} from 'sentry/views/performance/queues/settings';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useDiscover';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

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

  const mutableSearch = new MutableSearch(DEFAULT_QUERY_FILTER);
  if (destination) {
    mutableSearch.addFilterValue('messaging.destination.name', destination, false);
  }
  const response = useSpanMetrics(
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
        'time_spent_percentage(app,span.duration)',
      ],
      enabled,
      sorts: sort ? [sort] : [],
      limit: TABLE_ROWS_LIMIT,
      cursor,
    },
    referrer
  );

  return response;
}
