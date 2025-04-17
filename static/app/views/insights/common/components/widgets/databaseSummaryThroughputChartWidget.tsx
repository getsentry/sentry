import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useParams} from 'sentry/utils/useParams';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {getThroughputChartTitle} from 'sentry/views/insights/common/views/spans/types';
import type {SpanMetricsQueryFilters} from 'sentry/views/insights/types';

export default function DatabaseSummaryThroughputChartWidget(
  props: LoadableChartWidgetProps
) {
  const {groupId} = useParams();
  const filters: SpanMetricsQueryFilters = {
    'span.group': groupId,
  };
  const {isPending, data, error} = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(filters),
      yAxis: ['epm()'],
      enabled: Boolean(groupId),
      transformAliasToInputFormat: true,
    },
    'api.starfish.span-summary-page-metrics-chart'
  );

  return (
    <InsightsLineChartWidget
      {...props}
      id="databaseSummaryThroughputChartWidget"
      title={getThroughputChartTitle('db')}
      series={[data['epm()']]}
      isLoading={isPending}
      error={error}
    />
  );
}
