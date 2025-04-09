import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {getThroughputChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {Referrer} from 'sentry/views/insights/cache/referrers';
import {BASE_FILTERS} from 'sentry/views/insights/cache/settings';

export function CacheThroughputWidget() {
  const {
    isPending: isThroughputDataLoading,
    data: throughputData,
    error: throughputError,
  } = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(BASE_FILTERS),
      yAxis: ['epm()'],
      transformAliasToInputFormat: true,
    },
    Referrer.LANDING_CACHE_THROUGHPUT_CHART
  );

  return (
    <InsightsLineChartWidget
      title={getThroughputChartTitle('cache.get_item')}
      series={[throughputData['epm()']]}
      isLoading={isThroughputDataLoading}
      error={throughputError}
    />
  );
}
