import {Referrer} from 'sentry/views/insights/browser/resources/referrer';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {
  useResourceLandingSeries,
  useResourceLandingSeriesSearch,
} from 'sentry/views/insights/common/components/widgets/hooks/useResourceLandingSeries';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {getDurationChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {SpanMetricsField} from 'sentry/views/insights/types';

const {SPAN_SELF_TIME} = SpanMetricsField;

export default function ResourceLandingDurationChartWidget(
  props: LoadableChartWidgetProps
) {
  const {search, enabled} = useResourceLandingSeriesSearch();
  const referrer = Referrer.RESOURCE_LANDING_SERIES;

  const {data, isPending, error} = useResourceLandingSeries({
    search,
    enabled,
    pageFilters: props.pageFilters,
  });

  return (
    <InsightsLineChartWidget
      {...props}
      queryInfo={{search, referrer, yAxis: [`avg(${SPAN_SELF_TIME})`]}}
      id="resourceLandingDurationChartWidget"
      title={getDurationChartTitle('resource')}
      series={[data[`avg(${SPAN_SELF_TIME})`]]}
      isLoading={isPending}
      error={error}
    />
  );
}
