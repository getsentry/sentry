import {Location} from 'history';
import keyBy from 'lodash/keyBy';
import moment, {Moment} from 'moment';

import {getInterval} from 'sentry/components/charts/utils';
import {PageFilters} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {IndexedSpan} from 'sentry/views/starfish/queries/types';
import {getDateFilters} from 'sentry/views/starfish/utils/dates';
import {getDateQueryFilter} from 'sentry/views/starfish/utils/getDateQueryFilter';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

const INTERVAL = 12;

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
  const {startTime, endTime} = getDateFilters(pageFilters);
  const dateFilters = getDateQueryFilter(startTime, endTime);

  const query = span
    ? getQuery(span, startTime, endTime, dateFilters, queryFilters.transactionName)
    : '';
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
    queryString: query,
    initialData: [],
    enabled: Boolean(query),
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

function getQuery(
  span: {group: string},
  startTime: Moment,
  endTime: Moment,
  dateFilters: string,
  transaction?: string
) {
  return `
    SELECT
      toStartOfInterval(start_timestamp, INTERVAL ${INTERVAL} HOUR) as interval,
      count() as count,
      divide(count(), ${
        moment(endTime ?? undefined).unix() - moment(startTime).unix()
      }) as "spm()"
      quantile(0.95)(exclusive_time) as p95,
      quantile(0.50)(exclusive_time) as p50,
      countIf(greaterOrEquals(status, 400) AND lessOrEquals(status, 599)) as "failure_count",
      "failure_count" / "count" as "failure_rate"
    FROM spans_experimental_starfish
    WHERE group_id = '${span.group}'
    ${dateFilters}
    ${transaction ? `AND transaction = '${transaction}'` : ''}
    GROUP BY interval
    ORDER BY interval
`;
}

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
