import type {Location} from 'history';

import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import type {SpanIndexedField, SpanIndexedFieldTypes} from 'sentry/views/starfish/types';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

interface Filters {
  [key: string]: string;
}

export const useIndexedSpans = ({
  filters,
  sorts,
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
  enabled?: boolean;
}) => {
  const location = useLocation();
  const eventView = getEventView(filters, location, fields, sorts);

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
  fields: SpanIndexedField[],
  sorts?: Sort[]
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
