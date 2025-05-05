import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useDatabaseLandingChartFilter} from 'sentry/views/insights/common/components/widgets/hooks/useDatabaseLandingChartFilter';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {DEFAULT_DURATION_AGGREGATE} from 'sentry/views/insights/database/settings';
import {SpanMetricsField} from 'sentry/views/insights/types';

export function useDatabaseLandingDurationQuery() {
  const chartFilters = useDatabaseLandingChartFilter();
  return useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(chartFilters),
      yAxis: [`${DEFAULT_DURATION_AGGREGATE}(${SpanMetricsField.SPAN_SELF_TIME})`],
      transformAliasToInputFormat: true,
    },
    'api.starfish.span-landing-page-metrics-chart'
  );
}
