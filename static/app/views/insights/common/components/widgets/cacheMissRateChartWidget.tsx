import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {Referrer} from 'sentry/views/insights/cache/referrers';
import {BASE_FILTERS} from 'sentry/views/insights/cache/settings';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';
import {SpanFunction} from 'sentry/views/insights/types';

const {CACHE_MISS_RATE} = SpanFunction;

export default function CacheMissRateChartWidget(props: LoadableChartWidgetProps) {
  const {isPending, data, error} = useSpanMetricsSeries(
    {
      yAxis: [`${CACHE_MISS_RATE}()`],
      search: MutableSearch.fromQueryObject(BASE_FILTERS),
      transformAliasToInputFormat: true,
    },
    Referrer.LANDING_CACHE_HIT_MISS_CHART,
    props.pageFilters
  );

  return (
    <InsightsLineChartWidget
      {...props}
      id="cacheMissRateChartWidget"
      title={DataTitles[`${CACHE_MISS_RATE}()`]}
      series={[data[`${CACHE_MISS_RATE}()`]]}
      isLoading={isPending}
      error={error}
    />
  );
}
