import type {PageFilters} from 'sentry/types/core';
import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {useWrappedDiscoverQuery} from 'sentry/views/insights/common/queries/useSpansQuery';
import type {SpanProperty, SpanResponse} from 'sentry/views/insights/types';

interface UseDiscoverQueryOptions {
  additonalQueryKey?: string[];
}

interface UseDiscoverOptions<Fields> {
  cursor?: string;
  enabled?: boolean;
  fields?: Fields;
  keepPreviousData?: boolean;
  limit?: number;
  noPagination?: boolean;
  orderby?: string | string[];
  pageFilters?: PageFilters;
  projectIds?: number[];
  samplingMode?: SamplingMode;
  /**
   * TODO - ideally this probably would be only `Mutable Search`, but it doesn't handle some situations well
   */
  search?: MutableSearch | string;
  sorts?: Sort[];
  useQueryOptions?: UseDiscoverQueryOptions;
}

// The default sampling mode for eap queries
export const DEFAULT_SAMPLING_MODE: SamplingMode = 'NORMAL';

export const useSpans = <Fields extends SpanProperty[]>(
  options: UseDiscoverOptions<Fields> = {},
  referrer: string
) => {
  return useDiscover<Fields, SpanResponse>(options, DiscoverDatasets.SPANS, referrer);
};

const useDiscover = <T extends Array<Extract<keyof ResponseType, string>>, ResponseType>(
  options: UseDiscoverOptions<T> = {},
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
    noPagination,
    projectIds,
    orderby,
    samplingMode = DEFAULT_SAMPLING_MODE,
    useQueryOptions,
  } = options;

  const pageFilters = usePageFilters();

  const eventView = getEventView(
    search,
    fields,
    sorts,
    pageFiltersFromOptions ?? pageFilters.selection,
    dataset,
    projectIds,
    orderby
  );

  const result = useWrappedDiscoverQuery({
    eventView,
    initialData: [],
    limit,
    enabled: options.enabled,
    referrer,
    cursor,
    noPagination,
    samplingMode,
    additionalQueryKey: useQueryOptions?.additonalQueryKey,
    keepPreviousData: options.keepPreviousData,
  });

  // This type is a little awkward but it explicitly states that the response could be empty. This doesn't enable unchecked access errors, but it at least indicates that it's possible that there's no data
  const data = (result?.data ?? []) as Array<Pick<ResponseType, T[number]>>;

  return {
    ...result,
    data,
    isEnabled: options.enabled,
  };
};

export function getEventView(
  search: MutableSearch | string | undefined,
  fields: string[] = [],
  sorts: Sort[] = [],
  pageFilters: PageFilters,
  dataset: DiscoverDatasets,
  projectIds?: number[],
  orderby?: string | string[]
) {
  const query = typeof search === 'string' ? search : (search?.formatString() ?? '');

  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      name: '',
      query,
      fields,
      dataset,
      version: 2,
      orderby,
    },
    pageFilters
  );

  if (projectIds) {
    eventView.project = projectIds;
  }

  if (sorts.length > 0) {
    eventView.sorts = sorts;
  }

  return eventView;
}
