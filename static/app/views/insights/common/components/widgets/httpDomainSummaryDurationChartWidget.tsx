import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useHttpDomainSummaryChartFilter} from 'sentry/views/insights/common/components/widgets/hooks/useHttpDomainSummaryChartFilter';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {getDurationChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {Referrer} from 'sentry/views/insights/http/referrers';
import {SpanMetricsField} from 'sentry/views/insights/types';

export default function HttpDomainSummaryDurationChartWidget(
  props: LoadableChartWidgetProps
) {
  const chartFilters = useHttpDomainSummaryChartFilter();
  const referrer = Referrer.DOMAIN_SUMMARY_DURATION_CHART;
  const search = MutableSearch.fromQueryObject(chartFilters);

  const {
    isPending: isDurationDataLoading,
    data: durationData,
    error: durationError,
  } = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(chartFilters),
      yAxis: [`avg(${SpanMetricsField.SPAN_SELF_TIME})`],
      transformAliasToInputFormat: true,
    },
    referrer,
    props.pageFilters
  );

  return (
    <InsightsLineChartWidget
      {...props}
      id="httpDomainSummaryDurationChartWidget"
      title={getDurationChartTitle('http')}
      queryInfo={{search, referrer}}
      series={[durationData['avg(span.self_time)']]}
      isLoading={isDurationDataLoading}
      error={durationError}
    />
  );
}
