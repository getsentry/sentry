import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {getThroughputChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {useHttpChartFilters} from 'sentry/views/insights/common/widgets/hooks/useHttpChartFilters';
import {Referrer} from 'sentry/views/insights/http/referrers';

export default function HttpThroughput() {
  const chartFilters = useHttpChartFilters();

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
      id="httpThroughput"
      title={getThroughputChartTitle('http')}
      series={[throughputData['epm()']]}
      isLoading={isThroughputDataLoading}
      error={throughputError}
    />
  );
}
