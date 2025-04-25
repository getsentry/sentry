import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useResourceLandingSeries} from 'sentry/views/insights/common/components/widgets/hooks/useResourceLandingSeries';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {getThroughputChartTitle} from 'sentry/views/insights/common/views/spans/types';

export default function ResourceLandingThroughputChartWidget(
  props: LoadableChartWidgetProps
) {
  const {data, isPending, error} = useResourceLandingSeries({
    pageFilters: props.pageFilters,
  });

  return (
    <InsightsLineChartWidget
      {...props}
      id="resourceLandingThroughputChartWidget"
      title={getThroughputChartTitle('resource')}
      series={[data['epm()']]}
      isLoading={isPending}
      error={error}
    />
  );
}
