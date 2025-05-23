import {useParams} from 'sentry/utils/useParams';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useResourceSummarySeries} from 'sentry/views/insights/common/components/widgets/hooks/useResourceSummarySeries';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {getDurationChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {SpanMetricsField} from 'sentry/views/insights/types';

const {SPAN_SELF_TIME} = SpanMetricsField;

export default function ResourceSummaryDurationChartWidget(
  props: LoadableChartWidgetProps
) {
  const {groupId} = useParams();

  const {data, isPending, error} = useResourceSummarySeries({
    groupId,
    pageFilters: props.pageFilters,
  });

  return (
    <InsightsLineChartWidget
      {...props}
      id="resourceSummaryDurationChartWidget"
      title={getDurationChartTitle('resource')}
      series={[data?.[`avg(${SPAN_SELF_TIME})`]]}
      isLoading={isPending}
      error={error}
    />
  );
}
