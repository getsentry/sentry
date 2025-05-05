import {Fragment, memo, useCallback, useMemo, useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import Placeholder from 'sentry/components/placeholder';
import {IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import getDuration from 'sentry/utils/duration/getDuration';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import type {QueryValue} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import CellAction, {Actions} from 'sentry/views/discover/table/cellAction';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {Referrer} from 'sentry/views/insights/pages/platform/laravel/referrers';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

interface TableData {
  avg: number;
  controller: string | undefined;
  errorRate: number;
  isControllerLoading: boolean;
  method: string;
  p95: number;
  projectId: number;
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
    | 'errorText'
    | 'warningText'
    | undefined;
};

const EMPTY_ARRAY: never[] = [];
const PER_PAGE = 10;

const defaultColumnOrder: Array<GridColumnOrder<string>> = [
  {key: 'request.method', name: t('Method'), width: 90},
  {key: 'transaction', name: t('Path'), width: COL_WIDTH_UNDEFINED},
  {key: 'count()', name: t('Requests'), width: 112},
  {key: 'failure_rate()', name: t('Error Rate'), width: 124},
  {key: 'avg(span.duration)', name: t('AVG'), width: 90},
  {key: 'p95(span.duration)', name: t('P95'), width: 90},
  {key: 'sum(span.duration)', name: t('Total'), width: 90},
  {key: 'count_unique(user)', name: t('Users'), width: 90},
];

function isSortField(value: string): value is string {
  return defaultColumnOrder.some(column => column.key === value);
}

function decodeSortField(value: QueryValue): string {
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

interface PathsTableProps {
  handleAddTransactionFilter: (value: string) => void;
  query?: string;
  showHttpMethodColumn?: boolean;
  showUsersColumn?: boolean;
}

export function PathsTable({
  query,
  handleAddTransactionFilter,
  showHttpMethodColumn = true,
  showUsersColumn = true,
}: PathsTableProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [columnOrder, setColumnOrder] = useState(() => {
    let columns = [...defaultColumnOrder];

    if (!showHttpMethodColumn) {
      columns = columns.filter(column => column.key !== 'request.method');
    }

    if (!showUsersColumn) {
      columns = columns.filter(column => column.key !== 'count_unique(user)');
    }

    return columns;
  });
  const {sortField, sortOrder} = useTableSortParams();

  const transactionsRequest = useEAPSpans(
    {
      search: `transaction.op:http.server is_transaction:True ${query}`,
      sorts: [{field: sortField, kind: sortOrder}],
      fields: [
        'request.method',
        'project.id',
        'transaction',
        'avg(span.duration)',
        'p95(span.duration)',
        'failure_rate()',
        'count()',
        'count_unique(user)',
        'sum(span.duration)',
      ],
      limit: PER_PAGE,
      cursor:
        typeof location.query.pathsCursor === 'string'
          ? location.query.pathsCursor
          : undefined,
    },
    Referrer.PATHS_TABLE
  );

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
        // We need an aggregation so we do not receive individual events
        'count()',
      ],
      limit: PER_PAGE,
      enabled: !!transactionsRequest.data && transactionPaths.length > 0,
    },
    Referrer.PATHS_TABLE
  );

  const tableData = useMemo<TableData[]>(() => {
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
      method: transaction['request.method'],
      transaction: transaction.transaction,
      requests: transaction['count()'],
      avg: transaction['avg(span.duration)'],
      p95: transaction['p95(span.duration)'],
      errorRate: transaction['failure_rate()'],
      users: transaction['count_unique(user)'],
      isControllerLoading: routeControllersRequest.isLoading,
      controller: controllerMap.get(transaction.transaction),
      projectId: transaction['project.id'],
      sum: transaction['sum(span.duration)'],
    }));
  }, [
    transactionsRequest.data,
    routeControllersRequest.data,
    routeControllersRequest.isLoading,
  ]);

  const handleResizeColumn = useCallback(
    (columnIndex: number, nextColumn: GridColumnHeader<string>) => {
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

  const renderHeadCell = useCallback((column: GridColumnHeader<string>) => {
    return <HeadCell column={column} />;
  }, []);

  const renderBodyCell = useCallback(
    (column: GridColumnOrder<string>, dataRow: TableData) => {
      return (
        <BodyCell
          column={column}
          dataRow={dataRow}
          handleAddTransactionFilter={handleAddTransactionFilter}
        />
      );
    },
    [handleAddTransactionFilter]
  );

  return (
    <Fragment>
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
      <Pagination
        pageLinks={transactionsRequest.pageLinks}
        onCursor={(cursor, path, currentQuery) => {
          navigate({
            pathname: path,
            query: {...currentQuery, pathsCursor: cursor},
          });
        }}
      />
    </Fragment>
  );
}

const HeadCell = memo(function HeadCell({column}: {column: GridColumnHeader<string>}) {
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
  handleAddTransactionFilter,
}: {
  column: GridColumnHeader<string>;
  dataRow: TableData;
  handleAddTransactionFilter: (value: string) => void;
}) {
  const theme = useTheme();
  const organization = useOrganization();
  const p95Color = getCellColor(dataRow.p95, getP95Threshold(dataRow.avg));
  const errorRateColor = getCellColor(dataRow.errorRate, errorRateColorThreshold);

  switch (column.key) {
    case 'request.method':
      return dataRow.method;
    case 'transaction':
      return (
        <CellAction
          column={{
            ...column,
            isSortable: true,
            type: 'string',
            column: {kind: 'field', field: 'transaction'},
          }}
          dataRow={dataRow as any}
          allowActions={[Actions.ADD]}
          handleCellAction={() => handleAddTransactionFilter(dataRow.transaction)}
        >
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
                  projectID: dataRow.projectId.toString(),
                  query: {},
                })}
              >
                {dataRow.transaction}
              </Link>
            </Tooltip>
            {dataRow.isControllerLoading ? (
              <Placeholder height={theme.fontSizeSmall} width="200px" />
            ) : (
              dataRow && (
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
        </CellAction>
      );
    case 'count()':
      return formatAbbreviatedNumber(dataRow.requests);
    case 'failure_rate()':
      return (
        <div style={{color: errorRateColor && theme[errorRateColor]}}>
          {(dataRow.errorRate * 100).toFixed(2)}%
        </div>
      );
    case 'avg(span.duration)':
      return getDuration(dataRow.avg / 1000, 2, true, true);
    case 'p95(span.duration)':
      return (
        <div style={{color: p95Color && theme[p95Color]}}>
          {getDuration(dataRow.p95 / 1000, 2, true, true)}
        </div>
      );
    case 'sum(span.duration)':
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
