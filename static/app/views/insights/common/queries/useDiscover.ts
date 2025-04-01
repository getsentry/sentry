import type {PageFilters} from 'sentry/types/core';
import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {OurLogFieldKey, OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {useWrappedDiscoverQuery} from 'sentry/views/insights/common/queries/useSpansQuery';
import type {
  EAPSpanProperty,
  EAPSpanResponse,
  MetricsProperty,
  MetricsResponse,
  SpanIndexedField,
  SpanIndexedProperty,
  SpanIndexedResponse,
  SpanMetricsProperty,
  SpanMetricsResponse,
} from 'sentry/views/insights/types';

interface UseDiscoverOptions<Fields> {
  cursor?: string;
  enabled?: boolean;
  fields?: Fields;
  limit?: number;
  noPagination?: boolean;
  pageFilters?: PageFilters;
  projectIds?: number[];
  /**
   * TODO - ideally this probably would be only `Mutable Search`, but it doesn't handle some situations well
   */
  search?: MutableSearch | string;
  sorts?: Sort[];
}

export const useSpansIndexed = <Fields extends SpanIndexedProperty[]>(
  options: UseDiscoverOptions<Fields> = {},
  referrer: string
) => {
  // Indexed spans dataset always returns an `id`
  return useDiscover<Fields | [SpanIndexedField.ID], SpanIndexedResponse>(
    options,
    DiscoverDatasets.SPANS_INDEXED,
    referrer
  );
};

export const useOurlogs = <Fields extends OurLogFieldKey[]>(
  options: UseDiscoverOptions<Fields> = {},
  referrer: string
) => {
  const {data, ...rest} = useDiscover<Fields, OurLogsResponseItem>(
    options,
    DiscoverDatasets.OURLOGS,
    referrer
  );
  const castData = data as OurLogsResponseItem[];
  return {...rest, data: castData};
};

export const useEAPSpans = <Fields extends EAPSpanProperty[]>(
  options: UseDiscoverOptions<Fields> = {},
  referrer: string,
  useRpc?: boolean
) => {
  return useDiscover<Fields, EAPSpanResponse>(
    options,
    useRpc ? DiscoverDatasets.SPANS_EAP_RPC : DiscoverDatasets.SPANS_EAP,
    referrer
  );
};

export const useSpanMetrics = <Fields extends SpanMetricsProperty[]>(
  options: UseDiscoverOptions<Fields> = {},
  referrer: string
) => {
  const location = useLocation();
  const useEap = location.query?.useEap === '1';
  return useDiscover<Fields, SpanMetricsResponse>(
    options,
    useEap ? DiscoverDatasets.SPANS_EAP_RPC : DiscoverDatasets.SPANS_METRICS,
    referrer
  );
};

export const useMetrics = <Fields extends MetricsProperty[]>(
  options: UseDiscoverOptions<Fields> = {},
  referrer: string
) => {
  return useDiscover<Fields, MetricsResponse>(
    options,
    DiscoverDatasets.METRICS,
    referrer
  );
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
  } = options;

  const pageFilters = usePageFilters();

  const eventView = getEventView(
    search,
    fields,
    sorts,
    pageFiltersFromOptions ?? pageFilters.selection,
    dataset,
    projectIds
  );

  const result = useWrappedDiscoverQuery({
    eventView,
    initialData: [],
    limit,
    enabled: options.enabled,
    referrer,
    cursor,
    noPagination,
  });

  // This type is a little awkward but it explicitly states that the response could be empty. This doesn't enable unchecked access errors, but it at least indicates that it's possible that there's no data
  const data = (result?.data ?? []) as Array<Pick<ResponseType, T[number]>>;

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
  dataset: DiscoverDatasets,
  projectIds?: number[]
) {
  const query = typeof search === 'string' ? search : (search?.formatString() ?? '');

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

  if (projectIds) {
    eventView.project = projectIds;
  }

  if (sorts.length > 0) {
    eventView.sorts = sorts;
  }

  return eventView;
}
