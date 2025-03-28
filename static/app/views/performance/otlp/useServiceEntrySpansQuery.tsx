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
  const cursor = decodeScalar(location.query?.[CURSOR_NAME]);
  const {selection} = usePageFilters();

  const fields: EAPSpanProperty[] = [
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

  // If a span category is selected, we must query the data differently for this to work on the EAP dataset.
  // - Make an initial query to fetch service entry spans with the highest cumulative durations of spans that have the span category.
  // - Then make a second query to fetch the table data for these spans
  // - If no span category is selected, only one query is made to fetch the table data.

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
      enabled: Boolean(
        spanCategoryUrlParam && selected.value !== TransactionFilterOptions.RECENT
      ),
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
      fields,
      cursor,
      limit: LIMIT,
      enabled: !!categorizedSpanIds && categorizedSpanIds.length > 0,
    },
    'api.performance.service-entry-spans-table-with-category',
    true
  );

  // The recent option disregards span category
  const finalQuery = new MutableSearch(query);
  if (selected.value === TransactionFilterOptions.RECENT) {
    finalQuery.removeFilter('span.category');
  }

  // Default query to fetch table data for spans when no category is selected
  const {data, isLoading, pageLinks, meta, error} = useEAPSpans(
    {
      search: finalQuery,
      fields,
      sorts: [sort],
      limit: LIMIT,
      cursor,
      pageFilters: selection,
      enabled:
        selected.value === TransactionFilterOptions.RECENT || !spanCategoryUrlParam,
    },
    'api.performance.service-entry-spans-table',
    true
  );

  if (spanCategoryUrlParam && selected.value !== TransactionFilterOptions.RECENT) {
    return {
      data: categorizedSpansData,
      isLoading: isCategorizedSpanIdsLoading || isCategorizedSpansLoading,
      pageLinks: categorizedSpansPageLinks,
      meta: categorizedSpansMeta,
      error: categorizedSpanIdsError || categorizedSpansError,
    };
  }

  return {
    data,
    isLoading,
    pageLinks,
    meta,
    error,
  };
}
