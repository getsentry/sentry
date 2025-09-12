import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useParams} from 'sentry/utils/useParams';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {getThroughputChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {Referrer} from 'sentry/views/insights/database/referrers';
import {FIELD_ALIASES} from 'sentry/views/insights/database/settings';
import type {SpanQueryFilters} from 'sentry/views/insights/types';

export default function DatabaseSummaryThroughputChartWidget(
  props: LoadableChartWidgetProps
) {
  const {groupId} = useParams();
  const filters: SpanQueryFilters = {
    'span.group': groupId,
  };
  const search = MutableSearch.fromQueryObject(filters);
  const referrer = Referrer.SUMMARY_THROUGHPUT_CHART;

  const {isPending, data, error} = useFetchSpanTimeSeries(
    {
      query: search,
      yAxis: ['epm()'],
      enabled: Boolean(groupId),
    },
    referrer
  );

  return (
    <InsightsLineChartWidget
      {...props}
      aliases={FIELD_ALIASES}
      queryInfo={{search, referrer}}
      id="databaseSummaryThroughputChartWidget"
      title={getThroughputChartTitle('db')}
      timeSeries={data?.timeSeries}
      isLoading={isPending}
      error={error}
    />
  );
}
