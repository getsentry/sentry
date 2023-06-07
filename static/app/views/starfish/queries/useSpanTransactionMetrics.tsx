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

export type SpanTransactionMetrics = {
  'p50(span.duration)': number;
  'p95(span.duration)': number;
  'spm()': number;
  'sum(span.self_time)': number;
  'time_spent_percentage()': number;
  transaction: string;
};

export const useSpanTransactionMetrics = (
  span?: Pick<IndexedSpan, 'group'>,
  transactions?: string[],
  _referrer = 'span-transaction-metrics'
) => {
  const location = useLocation();
  const pageFilters = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilters);
  const dateFilters = getDateQueryFilter(startTime, endTime);

  const query = span
    ? getQuery(span, startTime, endTime, dateFilters, transactions ?? [])
    : '';
  const eventView = span ? getEventView(span, location, transactions ?? []) : undefined;

  const {isLoading, data} = useSpansQuery<SpanTransactionMetrics[]>({
    eventView,
    queryString: query,
    initialData: [],
    enabled: Boolean(query),
  });

  return {isLoading, data};
};

function getQuery(
  span: {group: string},
  startTime: Moment,
  endTime: Moment,
  dateFilters: string,
  transactions: string[]
) {
  return `
    SELECT
      transaction,
      quantile(0.5)(exclusive_time) as "p50(span.duration)",
      quantile(0.5)(exclusive_time) as "p95(span.duration)",
      sum(exclusive_time) as "sum(span.duration)",
      divide(count(), ${
        moment(endTime ?? undefined).unix() - moment(startTime).unix()
      }) as "spm()"
    FROM spans_experimental_starfish
    WHERE group_id = '${span.group}'
    ${dateFilters}
    AND transaction IN ('${transactions.join("','")}')
    GROUP BY transaction
  `;
}

function getEventView(span: {group: string}, location: Location, transactions: string[]) {
  const cleanGroupId = span.group.replaceAll('-', '').slice(-16);

  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      query: `span.group:${cleanGroupId}${
        transactions.length > 0 ? ` transaction:[${transactions.join(',')}]` : ''
      }`,
      fields: [
        'transaction',
        'spm()',
        'sum(span.duration)',
        'p95(span.duration)',
        'time_spent_percentage()',
      ],
      orderby: '-time_spent_percentage()',
      dataset: DiscoverDatasets.SPANS_METRICS,
      projects: [1],
      version: 2,
    },
    location
  );
}
