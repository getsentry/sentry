import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';

type Props = {
  enabled: boolean;
  search: MutableSearch;
};

export function useDatabaseLandingThroughputQuery({search, enabled}: Props) {
  return useSpanMetricsSeries(
    {
      search,
      yAxis: ['epm()'],
      transformAliasToInputFormat: true,
      enabled,
    },
    'api.starfish.span-landing-page-metrics-chart'
  );
}
