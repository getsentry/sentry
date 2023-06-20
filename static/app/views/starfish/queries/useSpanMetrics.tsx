import {Location} from 'history';

import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import type {IndexedSpan} from 'sentry/views/starfish/queries/types';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

export type SpanMetrics = {
  [metric: string]: number;
};

export const useSpanMetrics = (
  span?: Pick<IndexedSpan, 'group'>,
  queryFilters: {transactionName?: string} = {},
  fields: string[] = [],
  referrer: string = 'span-metrics'
) => {
  const location = useLocation();

  const filters: string[] = [];
  if (queryFilters.transactionName) {
    filters.push(`transaction = ${queryFilters.transactionName}`);
  }

  const eventView = span
    ? getEventView(span, location, queryFilters.transactionName, fields)
    : undefined;

  // TODO: Add referrer
  const {isLoading, data} = useSpansQuery<SpanMetrics[]>({
    eventView,
    initialData: [],
    enabled: Boolean(span),
    referrer,
  });

  return {isLoading, data: data[0] ?? {}};
};

function getEventView(
  span: {group: string},
  location: Location,
  transaction?: string,
  fields: string[] = []
) {
  const cleanGroupId = span.group.replaceAll('-', '').slice(-16);

  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      query: `span.group:${cleanGroupId}${
        transaction ? ` transaction:${transaction}` : ''
      }`,
      fields,
      dataset: DiscoverDatasets.SPANS_METRICS,
      projects: [1],
      version: 2,
    },
    location
  );
}
