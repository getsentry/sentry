import type {DropdownOption} from 'sentry/components/discover/transactionsList';
import type {Sort} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {type EAPSpanProperty, SpanIndexedField} from 'sentry/views/insights/types';
import {TransactionFilterOptions} from 'sentry/views/performance/transactionSummary/utils';

type Options = {
  p95: number;
  query: string;
  selected: DropdownOption;
  sort: Sort;
  transactionName: string;
};

const LIMIT = 5;
const CURSOR_NAME = 'serviceEntrySpansCursor';

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
  selected,
}: Options) {
  const location = useLocation();
  const spanCategoryUrlParam = decodeScalar(
    location.query?.[SpanIndexedField.SPAN_CATEGORY]
  );

  const isSingleQueryEnabled =
    selected.value === TransactionFilterOptions.RECENT || !spanCategoryUrlParam;

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
    selected,
    enabled: isSingleQueryEnabled,
  });

  const isMultipleQueriesEnabled = Boolean(
    spanCategoryUrlParam && selected.value !== TransactionFilterOptions.RECENT
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
    selected,
    enabled: isMultipleQueriesEnabled,
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
  p95: number;
  query: string;
  selected: DropdownOption;
  sort: Sort;
  enabled?: boolean;
};

// Hook for executing the default query to fetch table data for spans when no category is selected
function useSingleQuery(options: UseSingleQueryOptions) {
  const location = useLocation();
  const cursor = decodeScalar(location.query?.[CURSOR_NAME]);
  const {selection} = usePageFilters();
  const {query, sort, p95, selected, enabled} = options;
  const newQuery = new MutableSearch(query);

  if (selected.value === TransactionFilterOptions.SLOW && p95) {
    newQuery.addFilterValue('span.duration', `<=${p95.toFixed(0)}`);
  }

  // selected.value === TransactionFilterOptions.RECENT || !spanCategoryUrlParam,

  const {data, isLoading, pageLinks, meta, error} = useEAPSpans(
    {
      search: query,
      fields: FIELDS,
      sorts: [sort],
      limit: LIMIT,
      cursor,
      pageFilters: selection,
      enabled,
    },
    'api.performance.service-entry-spans-table',
    true
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
  p95: number;
  selected: DropdownOption;
  sort: Sort;
  transactionName: string;
  enabled?: boolean;
};

function useMultipleQueries(options: UseMultipleQueriesOptions) {
  const {transactionName, sort, p95, selected, enabled} = options;
  const location = useLocation();
  const cursor = decodeScalar(location.query?.[CURSOR_NAME]);
  const {selection} = usePageFilters();
  const spanCategoryUrlParam = decodeScalar(
    location.query?.[SpanIndexedField.SPAN_CATEGORY]
  );

  const categorizedSpansQuery = new MutableSearch(
    `transaction:${transactionName} span.category:${spanCategoryUrlParam}`
  );

  // The slow (p95) option is the only one that requires an explicit duration filter
  if (selected.value === TransactionFilterOptions.SLOW && p95) {
    categorizedSpansQuery.addFilterValue('span.duration', `<=${p95.toFixed(0)}`);
  }

  const {
    data: categorizedSpanIds,
    isLoading: isCategorizedSpanIdsLoading,
    error: categorizedSpanIdsError,
  } = useEAPSpans(
    {
      search: categorizedSpansQuery,
      fields: ['transaction.span_id', 'sum(span.self_time)'],
      sorts: [
        {
          field: 'sum(span.self_time)',
          kind: sort.kind,
        },
      ],
      limit: LIMIT,
      cursor,
      pageFilters: selection,
      // This query does not apply when the Recent option is selected
      enabled,
    },
    'api.performance.service-entry-spans-table',
    true
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
  } = useEAPSpans(
    {
      search: specificSpansQuery,
      fields: FIELDS,
      cursor,
      limit: LIMIT,
      enabled: !!categorizedSpanIds && categorizedSpanIds.length > 0,
    },
    'api.performance.service-entry-spans-table-with-category',
    true
  );

  return {
    data: categorizedSpansData,
    isLoading: isCategorizedSpanIdsLoading || isCategorizedSpansLoading,
    pageLinks: categorizedSpansPageLinks,
    meta: categorizedSpansMeta,
    error: categorizedSpanIdsError || categorizedSpansError,
  };
}
