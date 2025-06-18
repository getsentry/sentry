import {useParams} from 'sentry/utils/useParams';
import {Referrer} from 'sentry/views/insights/browser/resources/referrer';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {
  useResourceSummarySeries,
  useResourceSummarySeriesSearch,
} from 'sentry/views/insights/common/components/widgets/hooks/useResourceSummarySeries';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {getDurationChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {SpanMetricsField} from 'sentry/views/insights/types';

const {SPAN_SELF_TIME} = SpanMetricsField;

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

  return (
    <InsightsLineChartWidget
      {...props}
      queryInfo={{search, referrer}}
      id="resourceSummaryDurationChartWidget"
      title={getDurationChartTitle('resource')}
      series={[data?.[`avg(${SPAN_SELF_TIME})`]]}
      isLoading={isPending}
      error={error}
    />
  );
}
