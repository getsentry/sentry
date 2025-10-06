import {useParams} from 'sentry/utils/useParams';
import {Referrer} from 'sentry/views/insights/browser/resources/referrer';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {
  useResourceSummarySeries,
  useResourceSummarySeriesSearch,
} from 'sentry/views/insights/common/components/widgets/hooks/useResourceSummarySeries';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {getDurationChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {SpanFields} from 'sentry/views/insights/types';

const {SPAN_SELF_TIME} = SpanFields;

export default function ResourceSummaryDurationChartWidget(
  props: LoadableChartWidgetProps
) {
  const {groupId} = useParams();
  const referrer = Referrer.RESOURCE_SUMMARY_DURATION_CHART;

  const {search, enabled} = useResourceSummarySeriesSearch(groupId);
  const {data, isPending, error} = useResourceSummarySeries({
    search,
    enabled,
    pageFilters: props.pageFilters,
    referrer,
  });

  const timeSeries = data?.timeSeries || [];
  const durationSeries = timeSeries.find(ts => ts.yAxis === `avg(${SPAN_SELF_TIME})`);

  return (
    <InsightsLineChartWidget
      {...props}
      queryInfo={{search, referrer}}
      id="resourceSummaryDurationChartWidget"
      title={getDurationChartTitle('resource')}
      timeSeries={durationSeries ? [durationSeries] : []}
      isLoading={isPending}
      error={error}
    />
  );
}
