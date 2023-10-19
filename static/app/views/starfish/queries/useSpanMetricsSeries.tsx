import keyBy from 'lodash/keyBy';

import {getInterval} from 'sentry/components/charts/utils';
import {PageFilters} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SpanSummaryQueryFilters} from 'sentry/views/starfish/queries/useSpanMetrics';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

const {SPAN_GROUP} = SpanMetricsField;

export type SpanMetrics = {
  interval: number;
  'p95(span.self_time)': number;
  'spm()': number;
  'sum(span.self_time)': number;
  'time_spent_percentage()': number;
};

export const useSpanMetricsSeries = (
  group: string,
  queryFilters: SpanSummaryQueryFilters,
  yAxis: string[] = [],
  referrer = 'span-metrics-series'
) => {
  const pageFilters = usePageFilters();

  const eventView = group
    ? getEventView(group, pageFilters.selection, yAxis, queryFilters)
    : undefined;

  const enabled =
    Boolean(group) && Object.values(queryFilters).every(value => Boolean(value));

  // TODO: Add referrer
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
  group: string,
  pageFilters: PageFilters,
  yAxis: string[],
  queryFilters: SpanSummaryQueryFilters
) {
  return EventView.fromNewQueryWithPageFilters(
    {
      name: '',
      query: `${SPAN_GROUP}:${group}${
        queryFilters?.transactionName
          ? ` transaction:"${queryFilters?.transactionName}"`
          : ''
      }${
        queryFilters?.['transaction.method']
          ? ` transaction.method:${queryFilters?.['transaction.method']}`
          : ''
      }`,
      fields: [],
      yAxis,
      dataset: DiscoverDatasets.SPANS_METRICS,
      interval: getInterval(pageFilters.datetime, STARFISH_CHART_INTERVAL_FIDELITY),
      version: 2,
    },
    pageFilters
  );
}
