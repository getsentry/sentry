import type {PageFilters} from 'sentry/types/core';
import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {
  MetricsProperty,
  MetricsResponse,
  SpanMetricsProperty,
  SpanMetricsResponse,
} from 'sentry/views/starfish/types';
import {useWrappedDiscoverQuery} from 'sentry/views/starfish/utils/useSpansQuery';

interface UseMetricsOptions<Fields> {
  cursor?: string;
  enabled?: boolean;
  fields?: Fields;
  limit?: number;
  pageFilters?: PageFilters;
  referrer?: string;
  search?: MutableSearch | string; // TODO - ideally this probably would be only `Mutable Search`, but it doesn't handle some situations well
  sorts?: Sort[];
}

export const useSpanMetrics = <Fields extends SpanMetricsProperty[]>(
  options: UseMetricsOptions<Fields> = {},
  referrer: string
) => {
  return useDiscover<Fields, SpanMetricsResponse>(
    options,
    DiscoverDatasets.SPANS_METRICS,
    referrer
  );
};

export const useMetrics = <Fields extends MetricsProperty[]>(
  options: UseMetricsOptions<Fields> = {},
  referrer: string
) => {
  return useDiscover<Fields, MetricsResponse>(
    options,
    DiscoverDatasets.METRICS,
    referrer
  );
};

const useDiscover = <T extends Extract<keyof ResponseType, string>[], ResponseType>(
  options: UseMetricsOptions<T> = {},
  dataset: DiscoverDatasets,
  referrer: string
) => {
  const {
    fields = [],
    search = undefined,
    sorts = [],
    limit,
    cursor,
    pageFilters: pageFiltersFromOptions,
  } = options;

  const pageFilters = usePageFilters();

  const eventView = getEventView(
    search,
    fields,
    sorts,
    pageFiltersFromOptions ?? pageFilters.selection,
    dataset
  );

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
  const data = (result?.data ?? []) as Pick<ResponseType, T[number]>[];

  return {
    ...result,
    data,
    isEnabled: options.enabled,
  };
};

function getEventView(
  search: MutableSearch | string | undefined,
  fields: string[] = [],
  sorts: Sort[] = [],
  pageFilters: PageFilters,
  dataset: DiscoverDatasets
) {
  const query = typeof search === 'string' ? search : search?.formatString() ?? '';

  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      name: '',
      query,
      fields,
      dataset,
      version: 2,
    },
    pageFilters
  );

  if (sorts.length > 0) {
    eventView.sorts = sorts;
  }

  return eventView;
}
