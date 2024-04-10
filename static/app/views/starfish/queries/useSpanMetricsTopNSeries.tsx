import type {Series} from 'sentry/types/echarts';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getSeriesEventView} from 'sentry/views/starfish/queries/getSeriesEventView';
import type {MetricsProperty} from 'sentry/views/starfish/types';
import {useWrappedDiscoverTimeseriesQuery} from 'sentry/views/starfish/utils/useSpansQuery';

interface SpanMetricTimeseriesRow {
  [key: string]: number;
  interval: number;
}

interface UseSpanMetricsSeriesOptions<Fields> {
  enabled?: boolean;
  fields?: Fields;
  referrer?: string;
  search?: MutableSearch;
  topEvents?: number;
  yAxis?: Fields;
}

export const useSpanMetricsTopNSeries = <Fields extends MetricsProperty[]>(
  options: UseSpanMetricsSeriesOptions<Fields> = {}
) => {
  const {
    search = undefined,
    fields = [],
    yAxis = [],
    topEvents,
    referrer = 'span-metrics-top-n-series',
  } = options;

  // TODO: Forbid multi-axis top-N queries

  const pageFilters = usePageFilters();

  const eventView = getSeriesEventView(
    search,
    fields,
    pageFilters.selection,
    yAxis,
    topEvents
  );

  const result = useWrappedDiscoverTimeseriesQuery<SpanMetricTimeseriesRow[]>({
    eventView,
    initialData: [],
    referrer,
    enabled: options.enabled,
  });

  const seriesByKey: {[key: string]: Series} = {};

  (result?.data ?? []).forEach(datum => {
    // `interval` is the timestamp of the data point. Every other key is the value of a requested or found timeseries. `groups` is used to disambiguate top-N multi-axis series, which aren't supported here so the value is useless
    const {interval, group: _group, ...data} = datum;

    Object.keys(data).forEach(key => {
      const value = {
        name: interval,
        value: datum[key],
      };

      if (seriesByKey[key]) {
        seriesByKey[key].data.push(value);
      } else {
        seriesByKey[key] = {
          seriesName: key,
          data: [value],
        };
      }
    });
  });

  return {...result, data: seriesByKey as {[key: string]: Series | undefined}};
};
