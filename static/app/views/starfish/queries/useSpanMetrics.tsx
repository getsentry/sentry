import {Location} from 'history';
import moment, {Moment} from 'moment';

import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {IndexedSpan} from 'sentry/views/starfish/queries/types';
import {getDateFilters} from 'sentry/views/starfish/utils/dates';
import {getDateQueryFilter} from 'sentry/views/starfish/utils/getDateQueryFilter';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

export type SpanMetrics = {
  'first_seen()': string;
  'last_seen()': string;
  'p95(span.duration)': number;
  'sps()': number;
  'sum(span.duration)': number;
  'time_spent_percentage()': number;
};

export const useSpanMetrics = (
  span?: Pick<IndexedSpan, 'group'>,
  queryFilters: {transactionName?: string} = {},
  _referrer = 'span-metrics'
) => {
  const location = useLocation();
  const pageFilters = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilters);
  const dateFilters = getDateQueryFilter(startTime, endTime);

  const filters: string[] = [];
  if (queryFilters.transactionName) {
    filters.push(`transaction = ${queryFilters.transactionName}`);
  }

  const query = span
    ? getQuery(span, startTime, endTime, dateFilters, queryFilters.transactionName)
    : '';
  const eventView = span
    ? getEventView(span, location, queryFilters.transactionName)
    : undefined;

  // TODO: Add referrer
  const {isLoading, data} = useSpansQuery<SpanMetrics[]>({
    eventView,
    queryString: query,
    initialData: [],
    enabled: Boolean(query),
  });

  return {isLoading, data: data[0] ?? {}};
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
    count() as count,
    min(timestamp) as "first_seen()",
    max(timestamp) as "last_seen()",
    quantile(0.95)(exclusive_time) as "p95(span.duration)",
    sum(exclusive_time) as "sum(span.duration)",
    divide(count(), ${
      moment(endTime ?? undefined).unix() - moment(startTime).unix()
    }) as "spm()"
    FROM spans_experimental_starfish
    WHERE group_id = '${span.group}'
    ${dateFilters}
    ${transaction ? `AND transaction = '${transaction}'` : ''}
  `;
}

function getEventView(span: {group: string}, location: Location, transaction?: string) {
  const cleanGroupId = span.group.replaceAll('-', '').slice(-16);

  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      query: `span.group:${cleanGroupId}${
        transaction ? ` transaction:${transaction}` : ''
      }`,
      fields: [
        'sps()',
        'sum(span.duration)',
        'p95(span.duration)',
        'time_spent_percentage()',
      ],
      dataset: DiscoverDatasets.SPANS_METRICS,
      projects: [1],
      version: 2,
    },
    location
  );
}
