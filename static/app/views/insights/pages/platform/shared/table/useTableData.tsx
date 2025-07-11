import {useMemo} from 'react';

import {useLocation} from 'sentry/utils/useLocation';
import {useTableSortParams} from 'sentry/views/insights/agentMonitoring/components/headSortCell';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';
import type {EAPSpanProperty} from 'sentry/views/insights/types';

const PER_PAGE = 10;

export function useTableData<Fields extends EAPSpanProperty>({
  fields,
  referrer,
  query: baseQuery,
  cursorParamName,
}: {
  cursorParamName: string;
  fields: Fields[];
  query: string;
  referrer: string;
}) {
  const location = useLocation();
  const {query} = useTransactionNameQuery();
  const {sortField, sortOrder} = useTableSortParams();

  return useEAPSpans(
    {
      search: `${baseQuery ?? ''} ${query}`.trim(),
      sorts: [{field: sortField, kind: sortOrder}],
      fields,
      limit: PER_PAGE,
      keepPreviousData: true,
      cursor:
        typeof location.query[cursorParamName] === 'string'
          ? location.query[cursorParamName]
          : undefined,
    },
    referrer
  );
}

export function useTableDataWithController<Fields extends EAPSpanProperty>({
  fields,
  referrer,
  cursorParamName,
  query,
}: {
  cursorParamName: string;
  fields: Fields[];
  query: string;
  referrer: string;
}) {
  const transactionsRequest = useTableData({
    query,
    fields: ['transaction', ...fields],
    cursorParamName,
    referrer,
  });

  // Get the list of transactions from the first request
  const transactionPaths = useMemo(() => {
    return transactionsRequest.data?.map(transactions => transactions.transaction) ?? [];
  }, [transactionsRequest.data]);

  // The controller name is available in the span.description field on the `span.op:http.route` span in the same transaction
  const routeControllersRequest = useEAPSpans(
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
