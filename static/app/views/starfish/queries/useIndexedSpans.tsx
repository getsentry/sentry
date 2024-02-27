import type {Location} from 'history';

import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import type {SpanIndexedFieldTypes} from 'sentry/views/starfish/types';
import {SpanIndexedField} from 'sentry/views/starfish/types';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

const DEFAULT_LIMIT = 10;

interface Filters {
  [key: string]: string;
}

export const useIndexedSpans = (
  filters: Filters,
  sorts: Sort[] = [{field: 'timestamp', kind: 'desc'}],
  limit: number = DEFAULT_LIMIT,
  enabled: boolean = true,
  referrer: string = 'use-indexed-spans'
) => {
  const location = useLocation();
  const eventView = getEventView(filters, location, sorts);

  return useSpansQuery<SpanIndexedFieldTypes[]>({
    eventView,
    limit,
    initialData: [],
    enabled,
    referrer,
  });
};

export const useIndexedSpansBetter = ({
  filters,
  sorts = [{field: 'timestamp', kind: 'desc'}],
  limit = DEFAULT_LIMIT,
  enabled = true,
  referrer = 'use-indexed-spans',
  fields = undefined,
}: {
  filters: Filters;
  enabled?: boolean;
  fields?: string[];
  limit?: number;
  referrer?: string;
  sorts?: Sort[];
}) => {
  const location = useLocation();
  const eventView = getEventView(filters, location, sorts, fields);

  return useSpansQuery<SpanIndexedFieldTypes[]>({
    eventView,
    limit,
    initialData: [],
    enabled,
    referrer,
  });
};

function getEventView(
  filters: Filters,
  location: Location,
  sorts?: Sort[],
  fields?: string[]
) {
  // TODO: Add a `MutableSearch` constructor that accept a key-value mapping
  const search = new MutableSearch([]);

  for (const filterName in filters) {
    search.addFilterValue(filterName, filters[filterName]);
  }

  const eventView = EventView.fromNewQueryWithLocation(
    {
      name: '',
      query: search.formatString(),
      fields: fields ?? Object.values(SpanIndexedField),
      dataset: DiscoverDatasets.SPANS_INDEXED,
      version: 2,
    },
    location
  );

  if (sorts) {
    eventView.sorts = sorts;
  }

  return eventView;
}
