import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {Referrer} from 'sentry/views/insights/database/referrers';

type Props = {
  search: MutableSearch;
  enabled?: boolean;
};

export function useDatabaseLandingThroughputQuery({search, enabled}: Props) {
  return useSpanMetricsSeries(
    {
      search,
      yAxis: ['epm()'],
      transformAliasToInputFormat: true,
      enabled,
    },
    Referrer.LANDING_THROUGHPUT_CHART
  );
}
