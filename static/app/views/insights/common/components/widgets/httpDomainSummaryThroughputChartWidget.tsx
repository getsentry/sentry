import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useHttpDomainSummaryChartFilter} from 'sentry/views/insights/common/components/widgets/hooks/useHttpDomainSummaryChartFilter';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {getThroughputChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {Referrer} from 'sentry/views/insights/http/referrers';

export default function HttpDomainSummaryThroughputChartWidget(
  props: LoadableChartWidgetProps
) {
  const chartFilters = useHttpDomainSummaryChartFilter();
  const referrer = Referrer.DOMAIN_SUMMARY_THROUGHPUT_CHART;
  const search = MutableSearch.fromQueryObject(chartFilters);

  const {
    isPending: isThroughputDataLoading,
    data: throughputData,
    error: throughputError,
  } = useFetchSpanTimeSeries(
    {
      query: search,
      yAxis: ['epm()'],
      pageFilters: props.pageFilters,
    },
    Referrer.DOMAIN_SUMMARY_THROUGHPUT_CHART
  );

  return (
    <InsightsLineChartWidget
      {...props}
      id="httpDomainSummaryThroughputChartWidget"
      title={getThroughputChartTitle('http')}
      queryInfo={{search, referrer}}
      timeSeries={throughputData?.timeSeries}
      isLoading={isThroughputDataLoading}
      error={throughputError}
    />
  );
}
