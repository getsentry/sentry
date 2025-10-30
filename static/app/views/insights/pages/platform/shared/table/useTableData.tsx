import {useMemo} from 'react';

import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useTableSortParams} from 'sentry/views/insights/agents/components/headSortCell';
import {useTableCursor} from 'sentry/views/insights/agents/hooks/useTableCursor';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import type {SpanProperty} from 'sentry/views/insights/types';

const PER_PAGE = 10;

export function useSpanTableData<Fields extends SpanProperty>({
  fields,
  referrer,
  query,
}: {
  fields: Fields[];
  query: string | MutableSearch;
  referrer: string;
}) {
  const {sortField, sortOrder} = useTableSortParams();
  const {cursor} = useTableCursor();

  const isValidSortKey = fields.includes(sortField as Fields);

  return useSpans(
    {
      search: query,
      sorts: isValidSortKey ? [{field: sortField, kind: sortOrder}] : undefined,
      fields,
      limit: PER_PAGE,
      keepPreviousData: true,
      cursor,
    },
    referrer
  );
}

export function useTableDataWithController<Fields extends SpanProperty>({
  fields,
  referrer,
  query,
}: {
  fields: Fields[];
  query: string | MutableSearch;
  referrer: string;
}) {
  const transactionsRequest = useSpanTableData({
    query,
    fields: ['transaction', ...fields],
    referrer,
  });

  // Get the list of transactions from the first request
  const transactionPaths = useMemo(() => {
    return transactionsRequest.data?.map(transactions => transactions.transaction) ?? [];
  }, [transactionsRequest.data]);

  // The controller name is available in the span.description field on the `span.op:http.route` span in the same transaction
  const routeControllersRequest = useSpans(
    {
      search: `transaction.op:http.server span.op:http.route transaction:[${
        transactionPaths.map(transactions => `"${transactions}"`).join(',') || '""'
      }]`,
      fields: [
        'span.description',
        'transaction',
        'http.request.method',
        // We need an aggregation so we do not receive individual events
        'count()',
      ],
      limit: PER_PAGE,
      enabled: !!transactionsRequest.data && transactionPaths.length > 0,
    },
    referrer
  );

  const tableData = useMemo(() => {
    if (!transactionsRequest.data) {
      return [];
    }

    // Create a mapping of transaction path to controller
    const controllerMap = new Map(
      routeControllersRequest.data?.map(item => [
        item.transaction,
        item['span.description'],
      ])
    );

    return transactionsRequest.data.map(transaction => ({
      ...transaction,
      isControllerLoading: routeControllersRequest.isLoading,
      controller: controllerMap.get(transaction.transaction),
    }));
  }, [
    transactionsRequest.data,
    routeControllersRequest.data,
    routeControllersRequest.isLoading,
  ]);

  return {
    data: tableData,
    isPending: transactionsRequest.isPending,
    error: transactionsRequest.error,
    pageLinks: transactionsRequest.pageLinks,
    isPlaceholderData: transactionsRequest.isPlaceholderData,
  };
}
