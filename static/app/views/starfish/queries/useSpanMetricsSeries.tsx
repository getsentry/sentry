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
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

export type SpanMetrics = {
  interval: number;
  'p95(span.duration)': number;
  'sps()': number;
  'sum(span.duration)': number;
  'time_spent_percentage()': number;
};

export const useSpanMetricsSeries = (
  span?: Pick<IndexedSpan, 'group'>,
  queryFilters: {transactionName?: string} = {},
  yAxis: string[] = [],
  referrer = 'span-metrics-series'
) => {
  const location = useLocation();
  const pageFilters = usePageFilters();

  const eventView = span
    ? getEventView(
        span,
        location,
        pageFilters.selection,
        yAxis,
        queryFilters.transactionName
      )
    : undefined;

  // TODO: Add referrer
  const {isLoading, data} = useSpansQuery<SpanMetrics[]>({
    eventView,
    initialData: [],
    enabled: Boolean(eventView),
    referrer,
  });

  const parsedData = keyBy(
    yAxis.map(seriesName => {
      const series: Series = {
        seriesName,
        data: data.map(datum => ({value: datum[seriesName], name: datum.interval})),
      };

      return series;
    }),
    'seriesName'
  );

  return {isLoading, data: parsedData};
};

function getEventView(
  span: {group: string},
  location: Location,
  pageFilters: PageFilters,
  yAxis: string[],
  transaction?: string
) {
  const cleanGroupId = span.group.replaceAll('-', '').slice(-16);

  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      query: `span.group:${cleanGroupId}${
        transaction ? ` transaction:${transaction}` : ''
      }`,
      fields: [],
      yAxis,
      dataset: DiscoverDatasets.SPANS_METRICS,
      interval: getInterval(pageFilters.datetime, 'low'),
      projects: [1],
      version: 2,
    },
    location
  );
}
