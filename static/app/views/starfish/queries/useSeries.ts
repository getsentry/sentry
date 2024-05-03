import keyBy from 'lodash/keyBy';

import type {Series} from 'sentry/types/echarts';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getSeriesEventView} from 'sentry/views/starfish/queries/getSeriesEventView';
import type {MetricsProperty, SpanMetricsProperty} from 'sentry/views/starfish/types';
import {useWrappedDiscoverTimeseriesQuery} from 'sentry/views/starfish/utils/useSpansQuery';

export interface MetricTimeseriesRow {
  [key: string]: number;
  interval: number;
}

interface UseMetricsSeriesOptions<Fields> {
  enabled?: boolean;
  referrer?: string;
  search?: MutableSearch;
  yAxis?: Fields;
}

export const useSpanMetricsSeries = <Fields extends SpanMetricsProperty[]>(
  options: UseMetricsSeriesOptions<Fields> = {}
) => {
  return useSeries<Fields>(options, DiscoverDatasets.SPANS_METRICS);
};

export const useMetricsSeries = <Fields extends MetricsProperty[]>(
  options: UseMetricsSeriesOptions<Fields> = {}
) => {
  return useSeries<Fields>(options, DiscoverDatasets.METRICS);
};

const useSeries = <T extends string[]>(
  options: UseMetricsSeriesOptions<T> = {},
  dataset: DiscoverDatasets
) => {
  const {search = undefined, yAxis = [], referrer = 'span-metrics-series'} = options;

  const pageFilters = usePageFilters();

  const eventView = getSeriesEventView(
    search,
    undefined,
    pageFilters.selection,
    yAxis,
    undefined,
    dataset
  );

  const result = useWrappedDiscoverTimeseriesQuery<MetricTimeseriesRow[]>({
    eventView,
    initialData: [],
    referrer,
    enabled: options.enabled,
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
  ) as Record<T[number], Series>;

  return {...result, data: parsedData};
};
