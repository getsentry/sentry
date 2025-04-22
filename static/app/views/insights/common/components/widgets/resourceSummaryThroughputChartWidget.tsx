import {useParams} from 'sentry/utils/useParams';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useResourceSummarySeries} from 'sentry/views/insights/common/components/widgets/hooks/useResourceSummarySeries';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {getThroughputChartTitle} from 'sentry/views/insights/common/views/spans/types';

export function ResourceSummaryThroughputChartWidget(props: LoadableChartWidgetProps) {
  const {groupId} = useParams();

  const {data, isPending, error} = useResourceSummarySeries({
    groupId,
    pageFilters: props.pageFilters,
  });

  return (
    <InsightsLineChartWidget
      {...props}
      id="resourceSummaryThroughputChartWidget"
      title={getThroughputChartTitle('resource')}
      series={[data?.[`epm()`]]}
      isLoading={isPending}
      error={error}
    />
  );
}
