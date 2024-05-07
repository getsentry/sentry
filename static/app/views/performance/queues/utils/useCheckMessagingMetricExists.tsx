import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/performance/queues/settings';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useDiscover';

export function useCheckMessagingMetricExists() {
  const mutableSearch = new MutableSearch(DEFAULT_QUERY_FILTER);
  const {isLoading, status} = useSpanMetrics({
    search: mutableSearch,
    fields: ['avg(messaging.message.receive.latency)'],
    referrer: 'api.performance.queues',
  });

  return {isLoading, receiveLatencyExists: status === 'success'};
}
