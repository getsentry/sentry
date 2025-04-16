import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useDatabaseLandingChartFilter} from 'sentry/views/insights/common/components/widgets/hooks/useDatabaseLandingChartFilter';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';

export function useDatabaseLandingThroughputQuery() {
  const chartFilters = useDatabaseLandingChartFilter();
  return useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(chartFilters),
      yAxis: ['epm()'],
      transformAliasToInputFormat: true,
    },
    'api.starfish.span-landing-page-metrics-chart'
  );
}
