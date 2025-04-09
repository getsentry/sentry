import {HTTPMetricsWidget} from 'sentry/views/insights/common/components/httpMetricsWidget';
import {Referrer} from 'sentry/views/insights/http/referrers';

export function HTTPDurationWidget() {
  const {
    isPending: isDurationDataLoading,
    data: durationData,
    error: durationError,
  } = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(BASE_FILTERS),
      yAxis: ['avg(span.self_time)'],
      transformAliasToInputFormat: true,
    },
    Referrer.LANDING_DURATION_CHART
  );

  return (
    <InsightsLineChartWidget
      title={getDurationChartTitle('http')}
      series={[durationData['avg(span.self_time)']]}
      isLoading={isDurationDataLoading}
      error={durationError}
    />
  );
}
