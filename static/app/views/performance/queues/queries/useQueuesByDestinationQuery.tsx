import type {Sort} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/performance/queues/settings';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useDiscover';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

type Props = {
  destination?: string;
  enabled?: boolean;
  sort?: Sort;
};

export function useQueuesByDestinationQuery({enabled, destination, sort}: Props) {
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
      limit: 10,
      cursor,
    },
    'api.performance.queues.destination-summary'
  );

  return response;
}
