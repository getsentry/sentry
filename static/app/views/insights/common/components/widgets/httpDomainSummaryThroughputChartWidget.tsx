import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useHttpDomainSummaryChartFilter} from 'sentry/views/insights/common/components/widgets/hooks/useHttpDomainSummaryChartFilter';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {getThroughputChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {Referrer} from 'sentry/views/insights/http/referrers';

export default function HttpDomainSummaryThroughputChartWidget(
  props: LoadableChartWidgetProps
) {
  const chartFilters = useHttpDomainSummaryChartFilter();
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
    Referrer.DOMAIN_SUMMARY_THROUGHPUT_CHART,
    props.pageFilters
  );

  return (
    <InsightsLineChartWidget
      {...props}
      id="httpDomainSummaryThroughputChartWidget"
      title={getThroughputChartTitle('http')}
      series={[throughputData['epm()']]}
      isLoading={isThroughputDataLoading}
      error={throughputError}
    />
  );
}
