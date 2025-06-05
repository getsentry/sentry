import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useHttpLandingChartFilter} from 'sentry/views/insights/common/components/widgets/hooks/useHttpLandingChartFilter';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {getThroughputChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {Referrer} from 'sentry/views/insights/http/referrers';

export default function HttpThroughputChartWidget(props: LoadableChartWidgetProps) {
  const chartFilters = useHttpLandingChartFilter();
  const search = MutableSearch.fromQueryObject(chartFilters);
  const {
    isPending: isThroughputDataLoading,
    data: throughputData,
    error: throughputError,
  } = useSpanMetricsSeries(
    {
      search,
      yAxis: ['epm()'],
      transformAliasToInputFormat: true,
    },
    Referrer.LANDING_THROUGHPUT_CHART,
    props.pageFilters
  );

  return (
    <InsightsLineChartWidget
      {...props}
      queryInfo={{search}}
      id="httpThroughputChartWidget"
      title={getThroughputChartTitle('http')}
      series={[throughputData['epm()']]}
      isLoading={isThroughputDataLoading}
      error={throughputError}
    />
  );
}
