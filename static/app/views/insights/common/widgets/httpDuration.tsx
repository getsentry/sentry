import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {getDurationChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {useHttpChartFilters} from 'sentry/views/insights/common/widgets/hooks/useHttpChartFilters';
import {Referrer} from 'sentry/views/insights/http/referrers';

export function HttpDuration() {
  const chartFilters = useHttpChartFilters();

  const {
    isPending: isDurationDataLoading,
    data: durationData,
    error: durationError,
  } = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(chartFilters),
      yAxis: ['avg(span.self_time)'],
      transformAliasToInputFormat: true,
    },
    Referrer.LANDING_DURATION_CHART
  );

  return (
    <InsightsLineChartWidget
      id="httpDuration"
      title={getDurationChartTitle('http')}
      series={[durationData['avg(span.self_time)']]}
      isLoading={isDurationDataLoading}
      error={durationError}
    />
  );
}
