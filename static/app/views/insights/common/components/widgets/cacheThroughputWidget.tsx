import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {Referrer} from 'sentry/views/insights/cache/referrers';
import {BASE_FILTERS} from 'sentry/views/insights/cache/settings';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {getThroughputChartTitle} from 'sentry/views/insights/common/views/spans/types';

export default function CacheThroughputWidget() {
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
      id="cacheThroughputWidget"
      title={getThroughputChartTitle('cache.get_item')}
      series={[throughputData['epm()']]}
      isLoading={isThroughputDataLoading}
      error={throughputError}
    />
  );
}
