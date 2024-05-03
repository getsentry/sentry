import type {PageFilters} from 'sentry/types/core';
import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {SpanMetricsProperty, SpanMetricsResponse} from 'sentry/views/starfish/types';
import {useWrappedDiscoverQuery} from 'sentry/views/starfish/utils/useSpansQuery';

interface UseSpanMetricsOptions<Fields> {
  cursor?: string;
  enabled?: boolean;
  fields?: Fields;
  limit?: number;
  referrer?: string;
  search?: MutableSearch;
  sorts?: Sort[];
}

export const useSpanMetrics = <Fields extends SpanMetricsProperty[]>(
  options: UseSpanMetricsOptions<Fields> = {}
) => {
  const {fields = [], search = undefined, sorts = [], limit, cursor, referrer} = options;

  const pageFilters = usePageFilters();

  const eventView = getEventView(search, fields, sorts, pageFilters.selection);

  const result = useWrappedDiscoverQuery({
    eventView,
    initialData: [],
    limit,
    enabled: options.enabled,
    referrer,
    cursor,
  });

  // This type is a little awkward but it explicitly states that the response could be empty. This doesn't enable unchecked access errors, but it at least indicates that it's possible that there's no data
  // eslint-disable-next-line @typescript-eslint/ban-types
  const data = (result?.data ?? []) as Pick<SpanMetricsResponse, Fields[number]>[] | [];

  return {
    ...result,
    data,
    isEnabled: options.enabled,
  };
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
      dataset: DiscoverDatasets.SPANS_METRICS,
      version: 2,
    },
    pageFilters
  );

  if (sorts.length > 0) {
    eventView.sorts = sorts;
  }

  return eventView;
}
