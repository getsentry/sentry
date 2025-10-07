import {useParams} from 'sentry/utils/useParams';
import {Referrer} from 'sentry/views/insights/browser/resources/referrer';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {
  useResourceSummarySeries,
  useResourceSummarySeriesSearch,
} from 'sentry/views/insights/common/components/widgets/hooks/useResourceSummarySeries';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {getThroughputChartTitle} from 'sentry/views/insights/common/views/spans/types';

export default function ResourceSummaryThroughputChartWidget(
  props: LoadableChartWidgetProps
) {
  const {groupId} = useParams();
  const referrer = Referrer.RESOURCE_SUMMARY_THROUGHPUT_CHART;
  const {search, enabled} = useResourceSummarySeriesSearch(groupId);

  const {data, isPending, error} = useResourceSummarySeries({
    search,
    enabled,
    pageFilters: props.pageFilters,
    referrer,
  });

  const timeSeries = data?.timeSeries || [];
  const throughputSeries = timeSeries.find(ts => ts.yAxis === 'epm()');

  return (
    <InsightsLineChartWidget
      {...props}
      queryInfo={{search, referrer}}
      id="resourceSummaryThroughputChartWidget"
      title={getThroughputChartTitle('resource')}
      timeSeries={throughputSeries ? [throughputSeries] : []}
      isLoading={isPending}
      error={error}
    />
  );
}
