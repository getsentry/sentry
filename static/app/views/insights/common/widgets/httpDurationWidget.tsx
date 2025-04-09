import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {getDurationChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {Referrer} from 'sentry/views/insights/http/referrers';
import {BASE_FILTERS} from 'sentry/views/insights/http/settings';

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
