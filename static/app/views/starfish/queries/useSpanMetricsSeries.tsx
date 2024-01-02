import keyBy from 'lodash/keyBy';
import sortBy from 'lodash/sortBy';

import {PageFilters} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {intervalToMilliseconds} from 'sentry/utils/dates';
import EventView from 'sentry/utils/discover/eventView';
import {parseFunction} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getIntervalForMetricFunction} from 'sentry/views/performance/database/getIntervalForMetricFunction';
import {DEFAULT_INTERVAL} from 'sentry/views/performance/database/settings';
import {SpanMetricsQueryFilters} from 'sentry/views/starfish/types';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';
import {EMPTY_OPTION_VALUE} from 'sentry/views/starfish/views/spans/selectors/emptyOption';

export type SpanMetrics = {
  interval: number;
  'p95(span.self_time)': number;
  'spm()': number;
  'sum(span.self_time)': number;
  'time_spent_percentage()': number;
};

export const useSpanMetricsSeries = (
  filters: SpanMetricsQueryFilters,
  yAxis: string[] = [],
  referrer = 'span-metrics-series'
) => {
  const pageFilters = usePageFilters();

  const eventView = getEventView(filters, pageFilters.selection, yAxis);

  const enabled = Object.values(filters).every(value => Boolean(value));

  const result = useSpansQuery<SpanMetrics[]>({
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
          name: datum.interval,
        })),
      };

      return series;
    }),
    'seriesName'
  );

  return {...result, data: parsedData};
};

function getEventView(
  filters: SpanMetricsQueryFilters,
  pageFilters: PageFilters,
  yAxis: string[]
) {
  const query = new MutableSearch('');

  Object.entries(filters).forEach(([key, value]) => {
    if (!value) {
      return;
    }

    if (value === EMPTY_OPTION_VALUE) {
      query.addFilterValue('!has', key);
    }

    query.addFilterValue(key, value, !ALLOWED_WILDCARD_FIELDS.includes(key));
  });

  // TODO: This condition should be enforced everywhere
  // query.addFilterValue('has', 'span.description');

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

const ALLOWED_WILDCARD_FIELDS = ['span.description'];
