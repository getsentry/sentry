import type {Sort} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {type EAPSpanProperty, SpanIndexedField} from 'sentry/views/insights/types';
import {SERVICE_ENTRY_SPANS_CURSOR_NAME} from 'sentry/views/performance/transactionSummary/transactionOverview/content';
import {TransactionFilterOptions} from 'sentry/views/performance/transactionSummary/utils';

type Options = {
  p95: number;
  query: string;
  sort: Sort;
  transactionName: string;
  limit?: number;
};

const DEFAULT_LIMIT = 5;

const FIELDS: EAPSpanProperty[] = [
  'span_id',
  'user.id',
  'user.email',
  'user.username',
  'user.ip',
  'span.duration',
  'trace',
  'timestamp',
  'replayId',
  'profile.id',
  'profiler.id',
  'thread.id',
  'precise.start_ts',
  'precise.finish_ts',
];

export function useServiceEntrySpansQuery({
  query,
  transactionName,
  sort,
  p95,
  limit = DEFAULT_LIMIT,
}: Options) {
  const location = useLocation();
  const spanCategoryUrlParam = decodeScalar(
    location.query?.[SpanIndexedField.SPAN_CATEGORY]
  );
  const selectedOption = decodeScalar(location.query?.showTransactions);

  const isSingleQueryEnabled =
    selectedOption === TransactionFilterOptions.RECENT || !spanCategoryUrlParam;

  const {
    data: singleQueryData,
    isLoading: isSingleQueryLoading,
    error: singleQueryError,
    pageLinks: singleQueryPageLinks,
    meta: singleQueryMeta,
  } = useSingleQuery({
    query,
    sort,
    p95,
    enabled: isSingleQueryEnabled,
    limit,
  });

  const isMultipleQueriesEnabled = Boolean(
    spanCategoryUrlParam && selectedOption !== TransactionFilterOptions.RECENT
  );

  const {
    data: multipleQueriesData,
    isLoading: isMultipleQueriesLoading,
    error: multipleQueriesError,
    pageLinks: multipleQueriesPageLinks,
    meta: multipleQueriesMeta,
  } = useMultipleQueries({
    transactionName,
    sort,
    p95,
    enabled: isMultipleQueriesEnabled,
    limit,
  });

  if (isSingleQueryEnabled) {
    return {
      data: singleQueryData,
      isLoading: isSingleQueryLoading,
      error: singleQueryError,
      pageLinks: singleQueryPageLinks,
      meta: singleQueryMeta,
    };
  }

  return {
    data: multipleQueriesData,
    isLoading: isMultipleQueriesLoading,
    error: multipleQueriesError,
    pageLinks: multipleQueriesPageLinks,
    meta: multipleQueriesMeta,
  };
}

type UseSingleQueryOptions = {
  limit: number;
  p95: number;
  query: string;
  sort: Sort;
  enabled?: boolean;
};

// Hook for executing the default query to fetch table data for spans when no category is selected
function useSingleQuery(options: UseSingleQueryOptions) {
  const location = useLocation();
  const cursor = decodeScalar(location.query?.[SERVICE_ENTRY_SPANS_CURSOR_NAME]);
  const selectedOption = decodeScalar(location.query?.showTransactions);
  const {selection} = usePageFilters();
  const {query, sort, p95, enabled, limit} = options;
  const newQuery = new MutableSearch(query);

  if (selectedOption === TransactionFilterOptions.SLOW && p95) {
    newQuery.addFilterValue('span.duration', `<=${p95.toFixed(0)}`);
  }

  if (selectedOption === TransactionFilterOptions.RECENT) {
    newQuery.removeFilter('span.category');
  }

  const {data, isLoading, pageLinks, meta, error} = useSpans(
    {
      search: newQuery,
      fields: FIELDS,
      sorts: [sort],
      limit,
      cursor,
      pageFilters: selection,
      enabled,
    },
    'api.performance.service-entry-spans-table'
  );

  return {
    data,
    isLoading,
    pageLinks,
    meta,
    error,
  };
}

type UseMultipleQueriesOptions = {
  limit: number;
  p95: number;
  sort: Sort;
  transactionName: string;
  enabled?: boolean;
};

function useMultipleQueries(options: UseMultipleQueriesOptions) {
  const {transactionName, sort, p95, enabled, limit} = options;
  const location = useLocation();
  const cursor = decodeScalar(location.query?.[SERVICE_ENTRY_SPANS_CURSOR_NAME]);
  const selectedOption = decodeScalar(location.query?.showTransactions);
  const {selection} = usePageFilters();
  const spanCategoryUrlParam = decodeScalar(
    location.query?.[SpanIndexedField.SPAN_CATEGORY]
  );

  const categorizedSpansQuery = new MutableSearch(
    `transaction:${transactionName} span.category:${spanCategoryUrlParam}`
  );

  // The slow (p95) option is the only one that requires an explicit duration filter
  if (selectedOption === TransactionFilterOptions.SLOW && p95) {
    categorizedSpansQuery.addFilterValue('span.duration', `<=${p95.toFixed(0)}`);
  }

  const {
    data: categorizedSpanIds,
    isLoading: isCategorizedSpanIdsLoading,
    error: categorizedSpanIdsError,
  } = useSpans(
    {
      search: categorizedSpansQuery,
      fields: ['transaction.span_id', 'sum(span.self_time)'],
      sorts: [
        {
          field: 'sum(span.self_time)',
          kind: sort.kind,
        },
      ],
      limit,
      cursor,
      pageFilters: selection,
      enabled,
    },
    'api.performance.service-entry-spans-table'
  );

  const specificSpansQuery = new MutableSearch('');
  if (categorizedSpanIds && !isCategorizedSpanIdsLoading) {
    const spanIdsString = categorizedSpanIds
      .map(datum => datum['transaction.span_id'])
      .join(',');
    specificSpansQuery.addFilterValue('span_id', `[${spanIdsString}]`);
  }

  // Second query to fetch the table data for these spans
  const {
    data: categorizedSpansData,
    isLoading: isCategorizedSpansLoading,
    pageLinks: categorizedSpansPageLinks,
    meta: categorizedSpansMeta,
    error: categorizedSpansError,
  } = useSpans(
    {
      search: specificSpansQuery,
      fields: FIELDS,
      cursor,
      sorts: [sort],
      limit,
      enabled: !!categorizedSpanIds && categorizedSpanIds.length > 0,
    },
    'api.performance.service-entry-spans-table-with-category'
  );

  return {
    data: categorizedSpansData,
    isLoading: isCategorizedSpanIdsLoading || isCategorizedSpansLoading,
    pageLinks: categorizedSpansPageLinks,
    meta: categorizedSpansMeta,
    error: categorizedSpanIdsError || categorizedSpansError,
  };
}
