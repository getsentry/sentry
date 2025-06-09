import {Referrer} from 'sentry/views/insights/browser/resources/referrer';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {
  useResourceLandingSeries,
  useResourceLandingSeriesSearch,
} from 'sentry/views/insights/common/components/widgets/hooks/useResourceLandingSeries';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {getThroughputChartTitle} from 'sentry/views/insights/common/views/spans/types';

export default function ResourceLandingThroughputChartWidget(
  props: LoadableChartWidgetProps
) {
  const {search, enabled} = useResourceLandingSeriesSearch();
  const referrer = Referrer.RESOURCE_LANDING_SERIES;

  const {data, isPending, error} = useResourceLandingSeries({
    search,
    pageFilters: props.pageFilters,
    enabled,
  });

  return (
    <InsightsLineChartWidget
      {...props}
      queryInfo={{search, referrer}}
      id="resourceLandingThroughputChartWidget"
      title={getThroughputChartTitle('resource')}
      series={[data['epm()']]}
      isLoading={isPending}
      error={error}
    />
  );
}
