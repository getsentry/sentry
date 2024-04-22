import type {PageFilters} from 'sentry/types/core';
import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {IndexedProperty, SpanIndexedFieldTypes} from 'sentry/views/starfish/types';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

interface UseIndexedSpansOptions<Fields> {
  cursor?: string;
  enabled?: boolean;
  fields?: Fields;
  limit?: number;
  referrer?: string;
  search?: MutableSearch;
  sorts?: Sort[];
}

export const useIndexedSpans = <Fields extends IndexedProperty[]>(
  options: UseIndexedSpansOptions<Fields> = {}
) => {
  const {
    fields = [],
    search = undefined,
    sorts = [],
    limit,
    cursor,
    referrer,
    enabled,
  } = options;

  const pageFilters = usePageFilters();

  const eventView = getEventView(search, fields, sorts, pageFilters.selection);

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
  search: MutableSearch | undefined,
  fields: string[] = [],
  sorts: Sort[] = [],
  pageFilters: PageFilters
) {
  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      name: '',
      query: search?.formatString() ?? '',
      fields,
      dataset: DiscoverDatasets.SPANS_INDEXED,
      version: 2,
    },
    pageFilters
  );

  if (sorts.length > 0) {
    eventView.sorts = sorts;
  }

  return eventView;
}
