import type {Location} from 'history';

import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import type {SpanIndexedField, SpanIndexedFieldTypes} from 'sentry/views/starfish/types';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

export interface Filters {
  [key: string]: string | string[];
}

export const useIndexedSpans = ({
  filters,
  sorts,
  cursor,
  limit,
  enabled = true,
  referrer,
  fields,
}: {
  fields: SpanIndexedField[];
  filters: Filters;
  limit: number;
  referrer: string;
  sorts: Sort[];
  cursor?: string;
  enabled?: boolean;
}) => {
  const location = useLocation();
  const eventView = getEventView(filters, location, fields, sorts);

  return useSpansQuery<SpanIndexedFieldTypes[]>({
    eventView,
    cursor,
    limit,
    initialData: [],
    enabled,
    referrer,
  });
};

function getEventView(
  filters: Filters,
  location: Location,
  fields: SpanIndexedField[],
  sorts?: Sort[]
) {
  // TODO: Add a `MutableSearch` constructor that accept a key-value mapping
  const search = new MutableSearch([]);

  for (const filterName in filters) {
    const filter = filters[filterName];
    if (Array.isArray(filter)) {
      search.addFilterValues(filterName, filter);
    } else {
      search.addFilterValue(filterName, filter);
    }
  }

  const eventView = EventView.fromNewQueryWithLocation(
    {
      name: '',
      query: search.formatString(),
      fields,
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
