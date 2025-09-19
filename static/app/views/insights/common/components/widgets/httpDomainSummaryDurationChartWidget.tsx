import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useHttpDomainSummaryChartFilter} from 'sentry/views/insights/common/components/widgets/hooks/useHttpDomainSummaryChartFilter';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {getDurationChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {Referrer} from 'sentry/views/insights/http/referrers';
import {SpanFields} from 'sentry/views/insights/types';

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
  } = useFetchSpanTimeSeries(
    {
      query: MutableSearch.fromQueryObject(chartFilters),
      yAxis: [`avg(${SpanFields.SPAN_SELF_TIME})`],
      pageFilters: props.pageFilters,
    },
    referrer
  );

  return (
    <InsightsLineChartWidget
      {...props}
      id="httpDomainSummaryDurationChartWidget"
      title={getDurationChartTitle('http')}
      queryInfo={{search, referrer}}
      timeSeries={durationData?.timeSeries}
      isLoading={isDurationDataLoading}
      error={durationError}
    />
  );
}
