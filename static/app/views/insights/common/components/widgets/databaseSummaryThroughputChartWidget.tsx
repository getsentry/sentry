import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useParams} from 'sentry/utils/useParams';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {getThroughputChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {Referrer} from 'sentry/views/insights/database/referrers';
import type {SpanMetricsQueryFilters} from 'sentry/views/insights/types';

export default function DatabaseSummaryThroughputChartWidget(
  props: LoadableChartWidgetProps
) {
  const {groupId} = useParams();
  const filters: SpanMetricsQueryFilters = {
    'span.group': groupId,
  };
  const search = MutableSearch.fromQueryObject(filters);
  const referrer = Referrer.SUMMARY_THROUGHPUT_CHART;

  const {isPending, data, error} = useSpanMetricsSeries(
    {
      search,
      yAxis: ['epm()'],
      enabled: Boolean(groupId),
      transformAliasToInputFormat: true,
    },
    referrer
  );

  return (
    <InsightsLineChartWidget
      {...props}
      queryInfo={{search, referrer}}
      id="databaseSummaryThroughputChartWidget"
      title={getThroughputChartTitle('db')}
      series={[data['epm()']]}
      isLoading={isPending}
      error={error}
    />
  );
}
