import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {Referrer} from 'sentry/views/insights/database/referrers';

type Props = {
  search: MutableSearch;
  enabled?: boolean;
};

export function useDatabaseLandingThroughputQuery({search, enabled}: Props) {
  return useFetchSpanTimeSeries(
    {
      query: search,
      yAxis: ['epm()'],
      enabled,
    },
    Referrer.LANDING_THROUGHPUT_CHART
  );
}
