import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {Referrer} from 'sentry/views/insights/cache/referrers';
import {BASE_FILTERS} from 'sentry/views/insights/cache/settings';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {getThroughputChartTitle} from 'sentry/views/insights/common/views/spans/types';

export default function CacheThroughputChartWidget(props: LoadableChartWidgetProps) {
  const search = MutableSearch.fromQueryObject(BASE_FILTERS);
  const referrer = Referrer.LANDING_CACHE_THROUGHPUT_CHART;
  const {isPending, data, error} = useSpanMetricsSeries(
    {
      search,
      yAxis: ['epm()'],
      transformAliasToInputFormat: true,
    },
    referrer,
    props.pageFilters
  );

  return (
    <InsightsLineChartWidget
      {...props}
      queryInfo={{search, referrer}}
      id="cacheThroughputChartWidget"
      title={getThroughputChartTitle('cache.get_item')}
      series={[data['epm()']]}
      isLoading={isPending}
      error={error}
    />
  );
}
