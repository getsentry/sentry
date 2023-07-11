import {Location} from 'history';
import keyBy from 'lodash/keyBy';

import {getInterval} from 'sentry/components/charts/utils';
import {PageFilters} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {IndexedSpan} from 'sentry/views/starfish/queries/types';
import {SpanSummaryQueryFilters} from 'sentry/views/starfish/queries/useSpanMetrics';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

export type SpanMetrics = {
  interval: number;
  'p95(span.self_time)': number;
  'sps()': number;
  'sum(span.self_time)': number;
  'time_spent_percentage()': number;
};

export const useSpanMetricsSeries = (
  span: Pick<IndexedSpan, 'group'>,
  queryFilters: SpanSummaryQueryFilters,
  yAxis: string[] = [],
  referrer = 'span-metrics-series'
) => {
  const location = useLocation();
  const pageFilters = usePageFilters();

  const eventView = span
    ? getEventView(span, location, pageFilters.selection, yAxis, queryFilters)
    : undefined;

  const enabled =
    Boolean(span?.group) && Object.values(queryFilters).every(value => Boolean(value));

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
        data: result?.data.map(datum => ({
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
  span: {group: string},
  location: Location,
  pageFilters: PageFilters,
  yAxis: string[],
  queryFilters: SpanSummaryQueryFilters
) {
  const cleanGroupId = span.group.replaceAll('-', '').slice(-16);

  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      query: `span.group:${cleanGroupId}${
        queryFilters?.transactionName
          ? ` transaction:${queryFilters?.transactionName}`
          : ''
      }${
        queryFilters?.['transaction.method']
          ? ` transaction.method:${queryFilters?.['transaction.method']}`
          : ''
      }`,
      fields: [],
      yAxis,
      dataset: DiscoverDatasets.SPANS_METRICS,
      interval: getInterval(pageFilters.datetime, 'low'),
      version: 2,
    },
    location
  );
}
