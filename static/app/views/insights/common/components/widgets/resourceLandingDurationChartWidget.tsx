import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useResourceLandingSeries} from 'sentry/views/insights/common/components/widgets/hooks/useResourceLandingSeries';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {getDurationChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {SpanMetricsField} from 'sentry/views/insights/types';

const {SPAN_SELF_TIME} = SpanMetricsField;

export function ResourceLandingDurationChartWidget(props: LoadableChartWidgetProps) {
  const {data, isPending, error} = useResourceLandingSeries({
    pageFilters: props.pageFilters,
  });

  return (
    <InsightsLineChartWidget
      {...props}
      id="resourceLandingDurationChartWidget"
      title={getDurationChartTitle('resource')}
      series={[data[`avg(${SPAN_SELF_TIME})`]]}
      isLoading={isPending}
      error={error}
    />
  );
}
