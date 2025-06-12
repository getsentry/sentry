import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {Referrer} from 'sentry/views/insights/cache/referrers';
import {BASE_FILTERS} from 'sentry/views/insights/cache/settings';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';
import {SpanFields, SpanFunction} from 'sentry/views/insights/types';

const {CACHE_MISS_RATE, COUNT} = SpanFunction;

export default function CacheMissRateChartWidget(props: LoadableChartWidgetProps) {
  const search = MutableSearch.fromQueryObject(BASE_FILTERS);
  const referrer = Referrer.LANDING_CACHE_HIT_MISS_CHART;

  const {isPending, data, error} = useSpanMetricsSeries(
    {
      yAxis: [`${CACHE_MISS_RATE}()`],
      search,
      transformAliasToInputFormat: true,
    },
    referrer,
    props.pageFilters
  );

  // explore/alerts doesn't support `cache_miss_rate`, so this is used as a comparable query
  const queryInfo = {
    yAxis: [`${COUNT}(span.duration)`],
    search,
    groupBy: [SpanFields.CACHE_HIT],
    referrer,
  };

  return (
    <InsightsLineChartWidget
      {...props}
      queryInfo={queryInfo}
      id="cacheMissRateChartWidget"
      title={DataTitles[`${CACHE_MISS_RATE}()`]}
      series={[data[`${CACHE_MISS_RATE}()`]]}
      isLoading={isPending}
      error={error}
    />
  );
}
