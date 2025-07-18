import {useMemo} from 'react';

import {useLocation} from 'sentry/utils/useLocation';
import {useTableSortParams} from 'sentry/views/insights/agentMonitoring/components/headSortCell';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import type {EAPSpanProperty} from 'sentry/views/insights/types';

const PER_PAGE = 10;

export function useSpanTableData<Fields extends EAPSpanProperty>({
  fields,
  referrer,
  query,
  cursorParamName,
}: {
  cursorParamName: string;
  fields: Fields[];
  query: string;
  referrer: string;
}) {
  const location = useLocation();
  const {sortField, sortOrder} = useTableSortParams();

  const isValidSortKey = fields.includes(sortField as Fields);

  return useSpans(
    {
      search: query,
      sorts: isValidSortKey ? [{field: sortField, kind: sortOrder}] : undefined,
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
  const transactionsRequest = useSpanTableData({
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
