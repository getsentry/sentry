import keyBy from 'lodash/keyBy';

import type {Series} from 'sentry/types/echarts';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getSeriesEventView} from 'sentry/views/insights/common/queries/getSeriesEventView';
import {useWrappedDiscoverTimeseriesQuery} from 'sentry/views/insights/common/queries/useSpansQuery';
import type {
  MetricsProperty,
  SpanFunctions,
  SpanIndexedField,
  SpanMetricsProperty,
} from 'sentry/views/insights/types';

export interface MetricTimeseriesRow {
  [key: string]: number;
  interval: number;
}

interface UseMetricsSeriesOptions<Fields> {
  enabled?: boolean;
  interval?: string;
  overriddenRoute?: string;
  referrer?: string;
  search?: MutableSearch;
  yAxis?: Fields;
}

export const useSpanMetricsSeries = <Fields extends SpanMetricsProperty[]>(
  options: UseMetricsSeriesOptions<Fields> = {},
  referrer: string
) => {
  return useDiscoverSeries<Fields>(options, DiscoverDatasets.SPANS_METRICS, referrer);
};

export const useMetricsSeries = <Fields extends MetricsProperty[]>(
  options: UseMetricsSeriesOptions<Fields> = {},
  referrer: string
) => {
  return useDiscoverSeries<Fields>(options, DiscoverDatasets.METRICS, referrer);
};

/**
 * TODO: Remove string type, added to fix types for 'count()'
 */
export const useSpanIndexedSeries = <
  Fields extends SpanIndexedField[] | SpanFunctions[] | string[],
>(
  options: UseMetricsSeriesOptions<Fields> = {},
  referrer: string,
  dataset?: DiscoverDatasets
) => {
  return useDiscoverSeries<Fields>(
    options,
    dataset ?? DiscoverDatasets.SPANS_INDEXED,
    referrer
  );
};

const useDiscoverSeries = <T extends string[]>(
  options: UseMetricsSeriesOptions<T> = {},
  dataset: DiscoverDatasets,
  referrer: string
) => {
  const {search = undefined, yAxis = [], interval = undefined} = options;

  const pageFilters = usePageFilters();

  const eventView = getSeriesEventView(
    search,
    undefined,
    pageFilters.selection,
    yAxis,
    undefined,
    dataset
  );

  if (interval) {
    eventView.interval = interval;
  }

  const result = useWrappedDiscoverTimeseriesQuery<MetricTimeseriesRow[]>({
    eventView,
    initialData: [],
    referrer,
    enabled: options.enabled,
    overriddenRoute: options.overriddenRoute,
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
