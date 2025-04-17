import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useParams} from 'sentry/utils/useParams';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {getDurationChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {DEFAULT_DURATION_AGGREGATE} from 'sentry/views/insights/database/settings';
import type {SpanMetricsQueryFilters} from 'sentry/views/insights/types';
import {SpanMetricsField} from 'sentry/views/insights/types';

export default function DatabaseSummaryDurationChartWidget(
  props: LoadableChartWidgetProps
) {
  const {groupId} = useParams();
  const filters: SpanMetricsQueryFilters = {
    'span.group': groupId,
  };
  const {isPending, data, error} = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(filters),
      yAxis: [`${DEFAULT_DURATION_AGGREGATE}(${SpanMetricsField.SPAN_SELF_TIME})`],
      enabled: Boolean(groupId),
      transformAliasToInputFormat: true,
    },
    'api.starfish.span-summary-page-metrics-chart'
  );

  return (
    <InsightsLineChartWidget
      {...props}
      id="databaseSummaryDurationChartWidget"
      title={getDurationChartTitle('db')}
      series={[data[`${DEFAULT_DURATION_AGGREGATE}(${SpanMetricsField.SPAN_SELF_TIME})`]]}
      isLoading={isPending}
      error={error}
    />
  );
}
