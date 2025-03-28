import {Fragment, memo, useCallback, useMemo, useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Placeholder from 'sentry/components/placeholder';
import {Tooltip} from 'sentry/components/tooltip';
import {IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import getDuration from 'sentry/utils/duration/getDuration';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {QueryValue} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/backend/laravel/utils';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

interface DiscoverQueryResponse {
  data: Array<{
    'avg(transaction.duration)': number;
    'count()': number;
    'count_unique(user)': number;
    'failure_rate()': number;
    'http.method': string;
    'p95()': number;
    'project.id': string;
    'sum(transaction.duration)': number;
    transaction: string;
  }>;
}

type SortableField = keyof DiscoverQueryResponse['data'][number];

interface RouteControllerMapping {
  'count(span.duration)': number;
  'span.description': string;
  transaction: string;
  'transaction.method': string;
}

interface TableData {
  avg: number;
  controller: string | undefined;
  errorRate: number;
  isControllerLoading: boolean;
  method: string;
  p95: number;
  projectId: string;
  requests: number;
  sum: number;
  transaction: string;
  users: number;
}

const errorRateColorThreshold = {
  error: 0.1,
  warning: 0.05,
} as const;

const getP95Threshold = (avg: number) => {
  return {
    error: avg * 3,
    warning: avg * 2,
  };
};

const getCellColor = (value: number, thresholds: Record<string, number>) => {
  return Object.entries(thresholds).find(([_, threshold]) => value >= threshold)?.[0] as
    | 'error'
    | 'warning'
    | undefined;
};

const getOrderBy = (field: string, order: 'asc' | 'desc') => {
  return order === 'asc' ? field : `-${field}`;
};

const EMPTY_ARRAY: never[] = [];
const PER_PAGE = 10;

const defaultColumnOrder: Array<GridColumnOrder<SortableField>> = [
  {key: 'http.method', name: t('Method'), width: 90},
  {key: 'transaction', name: t('Path'), width: COL_WIDTH_UNDEFINED},
  {key: 'count()', name: t('Requests'), width: 112},
  {key: 'failure_rate()', name: t('Error Rate'), width: 124},
  {key: 'avg(transaction.duration)', name: t('AVG'), width: 90},
  {key: 'p95()', name: t('P95'), width: 90},
  {key: 'sum(transaction.duration)', name: t('Total'), width: 90},
  {key: 'count_unique(user)', name: t('Users'), width: 90},
];

function isSortField(value: string): value is SortableField {
  return defaultColumnOrder.some(column => column.key === value);
}

function decodeSortField(value: QueryValue): SortableField {
  if (typeof value === 'string' && isSortField(value)) {
    return value;
  }
  return 'count()';
}

function isSortOrder(value: string): value is 'asc' | 'desc' {
  return value === 'asc' || value === 'desc';
}

function decodeSortOrder(value: QueryValue): 'asc' | 'desc' {
  if (typeof value === 'string' && isSortOrder(value)) {
    return value;
  }
  return 'desc';
}

function useTableSortParams() {
  const {field: sortField, order: sortOrder} = useLocationQuery({
    fields: {
      field: decodeSortField,
      order: decodeSortOrder,
    },
  });
  return {sortField, sortOrder};
}

export function PathsTable({query}: {query?: string}) {
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams();
  const [columnOrder, setColumnOrder] = useState(defaultColumnOrder);
  const {sortField, sortOrder} = useTableSortParams();

  const transactionsRequest = useApiQuery<DiscoverQueryResponse>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'metrics',
          field: [
            'http.method',
            'project.id',
            'transaction',
            'avg(transaction.duration)',
            'p95()',
            'failure_rate()',
            'count()',
            'count_unique(user)',
            'sum(transaction.duration)',
          ],
          query: `(transaction.op:http.server) event.type:transaction ${query}`,
          referrer: 'api.performance.landing-table',
          orderby: getOrderBy(sortField, sortOrder),
          per_page: PER_PAGE,
        },
      },
    ],
    {staleTime: 0}
  );

  // Get the list of transactions from the first request
  const transactionPaths = useMemo(() => {
    return (
      transactionsRequest.data?.data.map(transactions => transactions.transaction) ?? []
    );
  }, [transactionsRequest.data]);

  const routeControllersRequest = useApiQuery<{data: RouteControllerMapping[]}>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'spans',
          field: [
            'span.description',
            'transaction',
            'transaction.method',
            'count(span.duration)',
          ],
          // Add transaction filter to route controller request
          query: `transaction.op:http.server span.op:http.route transaction:[${
            transactionPaths.map(transactions => `"${transactions}"`).join(',') || '""'
          }]`,
          sort: '-transaction',
          per_page: PER_PAGE,
        },
      },
    ],
    {
      staleTime: 0,
      // Only fetch after we have the transactions data and there are transactions to look up
      enabled: !!transactionsRequest.data?.data && transactionPaths.length > 0,
    }
  );

  const tableData = useMemo<TableData[]>(() => {
    if (!transactionsRequest.data?.data) {
      return [];
    }

    // Create a mapping of transaction path to controller
    const controllerMap = new Map(
      routeControllersRequest.data?.data.map(item => [
        item.transaction,
        item['span.description'],
      ])
    );

    return transactionsRequest.data.data.map(transaction => ({
      method: transaction['http.method'],
      transaction: transaction.transaction,
      requests: transaction['count()'],
      avg: transaction['avg(transaction.duration)'],
      p95: transaction['p95()'],
      errorRate: transaction['failure_rate()'],
      users: transaction['count_unique(user)'],
      isControllerLoading: routeControllersRequest.isLoading,
      controller: controllerMap.get(transaction.transaction),
      projectId: transaction['project.id'],
      sum: transaction['sum(transaction.duration)'],
    }));
  }, [
    transactionsRequest.data,
    routeControllersRequest.data,
    routeControllersRequest.isLoading,
  ]);

  const handleResizeColumn = useCallback(
    (columnIndex: number, nextColumn: GridColumnHeader<SortableField>) => {
      setColumnOrder(prev => {
        const newColumnOrder = [...prev];
        newColumnOrder[columnIndex] = {
          ...newColumnOrder[columnIndex]!,
          width: nextColumn.width,
        };
        return newColumnOrder;
      });
    },
    []
  );

  const renderHeadCell = useCallback((column: GridColumnHeader<SortableField>) => {
    return <HeadCell column={column} />;
  }, []);

  const renderBodyCell = useCallback(
    (column: GridColumnOrder<SortableField>, dataRow: TableData) => {
      return <BodyCell column={column} dataRow={dataRow} />;
    },
    []
  );

  return (
    <GridEditable
      isLoading={transactionsRequest.isLoading}
      error={transactionsRequest.error}
      data={tableData}
      columnOrder={columnOrder}
      columnSortBy={EMPTY_ARRAY}
      stickyHeader
      grid={{
        renderBodyCell,
        renderHeadCell,
        onResizeColumn: handleResizeColumn,
      }}
    />
  );
}

const HeadCell = memo(function HeadCell({
  column,
}: {
  column: GridColumnHeader<SortableField>;
}) {
  const location = useLocation();
  const {sortField, sortOrder} = useTableSortParams();
  return (
    <SortLink
      align={column.key === 'count_unique(user)' ? 'right' : 'left'}
      direction={sortField === column.key ? sortOrder : undefined}
      canSort
      generateSortLink={() => ({
        ...location,
        query: {
          ...location.query,
          field: column.key,
          order:
            sortField === column.key ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'desc',
        },
      })}
      title={
        <Fragment>
          {column.key === 'transaction' && <CellExpander />}
          {column.name}
        </Fragment>
      }
    />
  );
});

const BodyCell = memo(function BodyCell({
  column,
  dataRow,
}: {
  column: GridColumnHeader<SortableField>;
  dataRow: TableData;
}) {
  const theme = useTheme();
  const organization = useOrganization();
  const p95Color = getCellColor(dataRow.p95, getP95Threshold(dataRow.avg));
  const errorRateColor = getCellColor(dataRow.errorRate, errorRateColorThreshold);

  switch (column.key) {
    case 'http.method':
      return dataRow.method;
    case 'transaction':
      return (
        <PathCell>
          <Tooltip
            title={dataRow.transaction}
            position="top"
            maxWidth={400}
            showOnlyOnOverflow
            skipWrapper
          >
            <Link
              css={css`
                ${theme.overflowEllipsis};
                min-width: 0px;
              `}
              to={transactionSummaryRouteWithQuery({
                organization,
                transaction: dataRow.transaction,
                view: 'backend',
                projectID: dataRow.projectId,
                query: {},
              })}
            >
              {dataRow.transaction}
            </Link>
          </Tooltip>
          {dataRow.isControllerLoading ? (
            <Placeholder height={theme.fontSizeSmall} width="200px" />
          ) : (
            dataRow.controller && (
              <Tooltip
                title={dataRow.controller}
                position="top"
                maxWidth={400}
                showOnlyOnOverflow
                skipWrapper
              >
                <ControllerText>{dataRow.controller}</ControllerText>
              </Tooltip>
            )
          )}
        </PathCell>
      );
    case 'count()':
      return formatAbbreviatedNumber(dataRow.requests);
    case 'failure_rate()':
      return (
        <div style={{color: errorRateColor && theme[errorRateColor]}}>
          {(dataRow.errorRate * 100).toFixed(2)}%
        </div>
      );
    case 'avg(transaction.duration)':
      return getDuration(dataRow.avg / 1000, 2, true, true);
    case 'p95()':
      return (
        <div style={{color: p95Color && theme[p95Color]}}>
          {getDuration(dataRow.p95 / 1000, 2, true, true)}
        </div>
      );
    case 'sum(transaction.duration)':
      return getDuration(dataRow.sum / 1000, 2, true, true);
    case 'count_unique(user)':
      return (
        <div
          style={{
            minWidth: '0',
            display: 'flex',
            alignItems: 'center',
            gap: space(0.5),
            justifyContent: 'flex-end',
          }}
        >
          {formatAbbreviatedNumber(dataRow.users)}
          <IconUser size="xs" />
        </div>
      );
    default:
      return null;
  }
});

const PathCell = styled('div')`
  overflow: hidden;
  white-space: nowrap;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: ${space(0.5)};
  min-width: 0px;
`;

/**
 * Used to force the cell to expand take as much width as possible in the table layout
 * otherwise grid editable will let the last column grow
 */
const CellExpander = styled('div')`
  width: 100vw;
`;

const ControllerText = styled('div')`
  ${p => p.theme.overflowEllipsis};
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  min-width: 0px;
`;
