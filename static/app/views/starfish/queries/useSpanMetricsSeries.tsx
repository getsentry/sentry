import keyBy from 'lodash/keyBy';
import sortBy from 'lodash/sortBy';

import type {PageFilters} from 'sentry/types';
import type {Series} from 'sentry/types/echarts';
import {intervalToMilliseconds} from 'sentry/utils/dates';
import EventView from 'sentry/utils/discover/eventView';
import {parseFunction} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getIntervalForMetricFunction} from 'sentry/views/performance/database/getIntervalForMetricFunction';
import {DEFAULT_INTERVAL} from 'sentry/views/performance/database/settings';
import type {MetricsProperty, SpanMetricsQueryFilters} from 'sentry/views/starfish/types';
import {useWrappedDiscoverTimeseriesQuery} from 'sentry/views/starfish/utils/useSpansQuery';

interface SpanMetricTimeseriesRow {
  [key: string]: number;
  interval: number;
}

interface UseSpanMetricsSeriesOptions<Fields> {
  enabled?: boolean;
  filters?: SpanMetricsQueryFilters;
  referrer?: string;
  yAxis?: Fields;
}

export const useSpanMetricsSeries = <Fields extends MetricsProperty[]>(
  options: UseSpanMetricsSeriesOptions<Fields> = {}
) => {
  const {filters = {}, yAxis = [], referrer = 'span-metrics-series'} = options;

  const pageFilters = usePageFilters();

  const eventView = getEventView(filters, pageFilters.selection, yAxis);

  // TODO: Checking that every filter has a value might not be a good choice, since this API is not convenient. Instead, it's probably fine to omit keys with blank values
  const enabled =
    options.enabled && Object.values(filters).every(value => Boolean(value));

  const result = useWrappedDiscoverTimeseriesQuery<SpanMetricTimeseriesRow[]>({
    eventView,
    initialData: [],
    referrer,
    enabled,
  });

  const parsedData = keyBy(
    yAxis.map(seriesName => {
      const series: Series = {
        seriesName,
        data: (result?.data ?? []).map(datum => ({
          value: datum[seriesName],
          name: datum?.interval,
        })),
      };

      return series;
    }),
    'seriesName'
  ) as Record<Fields[number], Series>;

  return {...result, data: parsedData};
};

function getEventView(
  filters: SpanMetricsQueryFilters,
  pageFilters: PageFilters,
  yAxis: string[]
) {
  const query = MutableSearch.fromQueryObject(filters);

  // Pick the highest possible interval for the given yAxis selection. Find the ideal interval for each function, then choose the largest one. This results in the lowest granularity, but best performance.
  const interval = sortBy(
    yAxis.map(yAxisFunctionName => {
      const parseResult = parseFunction(yAxisFunctionName);

      if (!parseResult) {
        return DEFAULT_INTERVAL;
      }

      return getIntervalForMetricFunction(parseResult.name, pageFilters.datetime);
    }),
    result => {
      return intervalToMilliseconds(result);
    }
  ).at(-1);

  return EventView.fromNewQueryWithPageFilters(
    {
      name: '',
      query: query.formatString(),
      fields: [],
      yAxis,
      dataset: DiscoverDatasets.SPANS_METRICS,
      interval,
      version: 2,
    },
    pageFilters
  );
}
