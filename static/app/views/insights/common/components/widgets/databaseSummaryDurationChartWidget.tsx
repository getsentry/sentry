import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useParams} from 'sentry/utils/useParams';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {getDurationChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {Referrer} from 'sentry/views/insights/database/referrers';
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
  const search = MutableSearch.fromQueryObject(filters);
  const referrer = Referrer.SUMMARY_DURATION_CHART;

  const {isPending, data, error} = useSpanMetricsSeries(
    {
      search,
      yAxis: [`${DEFAULT_DURATION_AGGREGATE}(${SpanMetricsField.SPAN_SELF_TIME})`],
      enabled: Boolean(groupId),
      transformAliasToInputFormat: true,
    },
    referrer
  );

  return (
    <InsightsLineChartWidget
      {...props}
      queryInfo={{search, referrer}}
      id="databaseSummaryDurationChartWidget"
      title={getDurationChartTitle('db')}
      series={[data[`${DEFAULT_DURATION_AGGREGATE}(${SpanMetricsField.SPAN_SELF_TIME})`]]}
      isLoading={isPending}
      error={error}
    />
  );
}
