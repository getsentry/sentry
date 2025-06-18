import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useHttpLandingChartFilter} from 'sentry/views/insights/common/components/widgets/hooks/useHttpLandingChartFilter';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {getDurationChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {Referrer} from 'sentry/views/insights/http/referrers';

export default function HttpDurationChartWidget(props: LoadableChartWidgetProps) {
  const chartFilters = useHttpLandingChartFilter();
  const search = MutableSearch.fromQueryObject(chartFilters);
  const referrer = Referrer.LANDING_DURATION_CHART;

  const {
    isPending: isDurationDataLoading,
    data: durationData,
    error: durationError,
  } = useSpanMetricsSeries(
    {
      search,
      yAxis: ['avg(span.self_time)'],
      transformAliasToInputFormat: true,
    },
    referrer,
    props.pageFilters
  );

  return (
    <InsightsLineChartWidget
      {...props}
      queryInfo={{search, referrer}}
      id="httpDurationChartWidget"
      title={getDurationChartTitle('http')}
      series={[durationData['avg(span.self_time)']]}
      isLoading={isDurationDataLoading}
      error={durationError}
    />
  );
}
