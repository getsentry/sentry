import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {Referrer} from 'sentry/views/insights/cache/referrers';
import {BASE_FILTERS} from 'sentry/views/insights/cache/settings';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {getThroughputChartTitle} from 'sentry/views/insights/common/views/spans/types';

export default function CacheThroughputChartWidget(props: LoadableChartWidgetProps) {
  const search = MutableSearch.fromQueryObject(BASE_FILTERS);
  const referrer = Referrer.LANDING_CACHE_THROUGHPUT_CHART;

  const {isPending, data, error} = useFetchSpanTimeSeries(
    {
      query: search,
      yAxis: ['epm()'],
      pageFilters: props.pageFilters,
    },
    referrer
  );

  return (
    <InsightsLineChartWidget
      {...props}
      queryInfo={{search, referrer}}
      id="cacheThroughputChartWidget"
      title={getThroughputChartTitle('cache.get_item')}
      timeSeries={data?.timeSeries}
      isLoading={isPending}
      error={error}
    />
  );
}
