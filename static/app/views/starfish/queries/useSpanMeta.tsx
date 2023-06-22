import {Location} from 'history';

import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

export type SpanMeta = {
  'span.action': string;
  'span.description': string;
  'span.domain': string;
  'span.op': string;
};

export const useSpanMeta = (
  group: string,
  queryFilters: {transactionName?: string} = {},
  referrer: string = 'span-metrics'
) => {
  const location = useLocation();

  return useSpansQuery<SpanMeta[]>({
    eventView: getEventView(group, location, queryFilters.transactionName),
    initialData: [],
    referrer,
  });
};

function getEventView(groupId, location: Location, transaction?: string) {
  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      query: `span.group:${groupId}${transaction ? ` transaction:${transaction}` : ''}`,
      fields: ['span.op', 'span.description', 'span.action', 'span.domain', 'count()'], // TODO: Failing to pass a field like `count()` causes an error
      dataset: DiscoverDatasets.SPANS_METRICS,
      projects: [1],
      version: 2,
    },
    location
  );
}
