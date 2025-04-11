import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useHttpLandingChartFilter} from 'sentry/views/insights/common/components/widgets/hooks/useHttpLandingChartFilter';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {getThroughputChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {Referrer} from 'sentry/views/insights/http/referrers';

export default function HttpThroughputChartWidget() {
  const chartFilters = useHttpLandingChartFilter();
  const {
    isPending: isThroughputDataLoading,
    data: throughputData,
    error: throughputError,
  } = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(chartFilters),
      yAxis: ['epm()'],
      transformAliasToInputFormat: true,
    },
    Referrer.LANDING_THROUGHPUT_CHART
  );

  return (
    <InsightsLineChartWidget
      id="httpThroughputChartWidget"
      title={getThroughputChartTitle('http')}
      series={[throughputData['epm()']]}
      isLoading={isThroughputDataLoading}
      error={throughputError}
    />
  );
}
