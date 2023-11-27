import {Location} from 'history';

import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {SpanIndexedField, SpanIndexedFieldTypes} from 'sentry/views/starfish/types';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

const DEFAULT_LIMIT = 10;

interface Filters {
  [key: string]: string;
}

export const useIndexedSpans = (
  filters: Filters,
  limit: number = DEFAULT_LIMIT,
  enabled: boolean = true,
  referrer: string = 'use-indexed-spans'
) => {
  const location = useLocation();
  const eventView = getEventView(filters, location);

  eventView.sorts = [{field: 'timestamp', kind: 'desc'}];

  return useSpansQuery<SpanIndexedFieldTypes[]>({
    eventView,
    limit,
    initialData: [],
    enabled,
    referrer,
  });
};

function getEventView(filters: Filters, location: Location) {
  // TODO: Add a `MutableSearch` constructor that accept a key-value mapping
  const search = new MutableSearch([]);

  for (const filterName in filters) {
    search.addFilterValue(filterName, filters[filterName]);
  }

  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      query: search.formatString(),
      fields: Object.values(SpanIndexedField),
      dataset: DiscoverDatasets.SPANS_INDEXED,
      version: 2,
    },
    location
  );
}
