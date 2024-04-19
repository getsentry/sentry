import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

type Props = {
  destination?: string;
  enabled?: boolean;
};

export function useQueueByTransactionQuery({destination, enabled}: Props) {
  const location = useLocation();
  const cursor = decodeScalar(location.query?.[QueryParameterNames.DOMAINS_CURSOR]);

  const mutableSearch = new MutableSearch(
    'span.op:[queue.task.celery,queue.submit.celery]'
  );
  if (destination) {
    // TODO: This should filter by destination, not transaction
    mutableSearch.addFilterValue('transaction', destination);
  }
  const response = useSpanMetrics({
    search: mutableSearch,
    fields: [
      'transaction',
      'count()',
      'count_op(queue.submit.celery)',
      'count_op(queue.task.celery)',
      'sum(span.self_time)',
      'avg(span.self_time)',
      'avg_if(span.self_time,span.op,queue.submit.celery)',
      'avg_if(span.self_time,span.op,queue.task.celery)',
    ],
    enabled,
    sorts: [],
    limit: 10,
    cursor,
    referrer: 'api.starfish.queues-module-destination-summary',
  });

  return response;
}
