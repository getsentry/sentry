import type {Series} from 'sentry/types/echarts';
import type {Sort} from 'sentry/utils/discover/fields';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getSeriesEventView} from 'sentry/views/insights/common/queries/getSeriesEventView';
import {useWrappedDiscoverTimeseriesQuery} from 'sentry/views/insights/common/queries/useSpansQuery';
import type {SpanMetricsProperty} from 'sentry/views/insights/types';

interface SpanMetricTimeseriesRow {
  [key: string]: number;
  interval: number;
}

interface UseSpanMetricsSeriesOptions<Fields> {
  topEvents: number;
  enabled?: boolean;
  fields?: Fields;
  referrer?: string;
  search?: MutableSearch;
  sorts?: Sort[];
  yAxis?: Fields;
}

export const useSpanMetricsTopNSeries = <Fields extends SpanMetricsProperty[]>(
  options: UseSpanMetricsSeriesOptions<Fields> = {topEvents: DEFAULT_EVENT_COUNT}
) => {
  const {
    search = undefined,
    fields = [],
    yAxis = [],
    topEvents,
    sorts = [],
    referrer = 'span-metrics-top-n-series',
  } = options;

  if (yAxis.length > 1) {
    throw new Error(
      'Multi-axis top-N queries are not supported by this hook. Try using `useSpansQuery` directly.'
    );
  }

  const pageFilters = usePageFilters();

  const eventView = getSeriesEventView(
    search,
    fields,
    pageFilters.selection,
    yAxis,
    topEvents
  );

  if (sorts.length > 0) {
    eventView.sorts = sorts;
  }

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
        value: datum[key]!,
      };

      if (seriesByKey[key]) {
        seriesByKey[key]!.data.push(value);
      } else {
        seriesByKey[key] = {
          seriesName: key,
          data: [value],
        };
      }
    });
  });

  return {...result, data: seriesByKey as {[key: string]: Series}};
};

const DEFAULT_EVENT_COUNT = 5;
