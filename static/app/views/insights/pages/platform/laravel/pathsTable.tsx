import {useCallback} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import Placeholder from 'sentry/components/placeholder';
import {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {TimeSpentCell} from 'sentry/views/insights/common/components/tableCells/timeSpentCell';
import {
  HeadSortCell,
  useTableSort,
} from 'sentry/views/insights/pages/agents/components/headSortCell';
import {Referrer} from 'sentry/views/insights/pages/platform/laravel/referrers';
import {PlatformInsightsTable} from 'sentry/views/insights/pages/platform/shared/table';
import {DurationCell} from 'sentry/views/insights/pages/platform/shared/table/DurationCell';
import {
  ErrorRateCell,
  getErrorCellIssuesLink,
} from 'sentry/views/insights/pages/platform/shared/table/ErrorRateCell';
import {NumberCell} from 'sentry/views/insights/pages/platform/shared/table/NumberCell';
import {TransactionCell} from 'sentry/views/insights/pages/platform/shared/table/TransactionCell';
import {UserCell} from 'sentry/views/insights/pages/platform/shared/table/UserCell';
import {useTableDataWithController} from 'sentry/views/insights/pages/platform/shared/table/useTableData';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';
import {SpanFields} from 'sentry/views/insights/types';

const getP95Threshold = (avg: number) => {
  return {
    error: avg * 3,
    warning: avg * 2,
  };
};

const defaultColumnOrder: Array<GridColumnOrder<string>> = [
  {key: 'http.request.method', name: t('Method'), width: 90},
  {key: 'transaction', name: t('Path'), width: COL_WIDTH_UNDEFINED},
  {key: 'count()', name: t('Requests'), width: 112},
  {key: 'failure_rate()', name: t('Error Rate'), width: 124},
  {key: 'avg(span.duration)', name: t('AVG'), width: 90},
  {key: 'p95(span.duration)', name: t('P95'), width: 90},
  {key: 'sum(span.duration)', name: t('Time Spent'), width: 120},
  {key: 'count_unique(user)', name: t('Users'), width: 90},
];

const rightAlignColumns = new Set([
  'avg(span.duration)',
  'count_unique(user)',
  'count()',
  'failure_rate()',
  'p95(span.duration)',
  'sum(span.duration)',
]);

export function PathsTable() {
  const {query} = useTransactionNameQuery();
  const mutableQuery = new MutableSearch(query);
  mutableQuery.addFilterValue(SpanFields.TRANSACTION_OP, 'http.server');
  mutableQuery.addFilterValue(SpanFields.IS_TRANSACTION, 'true');

  const {tableSort} = useTableSort();
  const tableDataRequest = useTableDataWithController({
    query: mutableQuery,
    fields: [
      'project.id',
      'transaction',
      'avg(span.duration)',
      'p95(span.duration)',
      'failure_rate()',
      'count()',
      'sum(span.duration)',
      'http.request.method',
      'count_unique(user)',
    ],
    sort: tableSort,
    referrer: Referrer.PATHS_TABLE,
  });

  const renderHeadCell = useCallback(
    (column: GridColumnHeader<string>) => {
      return (
        <HeadSortCell
          sortKey={column.key}
          currentSort={tableSort}
          align={rightAlignColumns.has(column.key) ? 'right' : 'left'}
          forceCellGrow={column.key === 'transaction'}
        >
          {column.name}
        </HeadSortCell>
      );
    },
    [tableSort]
  );

  type TableData = (typeof tableDataRequest.data)[number];

  const renderBodyCell = useCallback(
    (column: GridColumnOrder<string>, dataRow: TableData) => {
      switch (column.key) {
        case 'http.request.method':
          return dataRow['http.request.method'];
        case 'transaction':
          return (
            <TransactionCell
              transaction={dataRow.transaction}
              column={column}
              dataRow={dataRow}
              projectId={dataRow['project.id'].toString()}
              targetView="backend"
              details={
                <TransactionDetails
                  isControllerLoading={dataRow.isControllerLoading}
                  controller={dataRow.controller}
                />
              }
            />
          );
        case 'count()':
          return <NumberCell value={dataRow['count()']} />;
        case 'failure_rate()':
          return (
            <ErrorRateCell
              errorRate={dataRow['failure_rate()']}
              total={dataRow['count()']}
              issuesLink={getErrorCellIssuesLink({
                projectId: dataRow['project.id'],
                query: `transaction:"${dataRow.transaction}"`,
              })}
            />
          );
        case 'avg(span.duration)':
          return <DurationCell milliseconds={dataRow['avg(span.duration)']} />;
        case 'p95(span.duration)':
          return (
            <DurationCell
              milliseconds={dataRow['p95(span.duration)']}
              thresholds={getP95Threshold(dataRow['avg(span.duration)'])}
            />
          );
        case 'sum(span.duration)':
          return <TimeSpentCell total={dataRow['sum(span.duration)']} />;
        case 'count_unique(user)':
          return <UserCell value={dataRow['count_unique(user)']} />;
        default:
          return <div />;
      }
    },
    []
  );

  return (
    <PlatformInsightsTable
      isLoading={tableDataRequest.isPending}
      error={tableDataRequest.error}
      data={tableDataRequest.data}
      initialColumnOrder={defaultColumnOrder as Array<GridColumnOrder<keyof TableData>>}
      stickyHeader
      grid={{
        renderBodyCell,
        renderHeadCell,
      }}
      pageLinks={tableDataRequest.pageLinks}
      isPlaceholderData={tableDataRequest.isPlaceholderData}
    />
  );
}

function TransactionDetails({
  isControllerLoading,
  controller,
}: {
  isControllerLoading: boolean;
  controller?: string;
}) {
  const theme = useTheme();

  if (isControllerLoading) {
    return <Placeholder height={theme.fontSize.sm} width="200px" />;
  }

  if (!controller) {
    return null;
  }

  return (
    <Tooltip
      title={controller}
      position="top"
      maxWidth={400}
      showOnlyOnOverflow
      skipWrapper
    >
      <ControllerText>{controller}</ControllerText>
    </Tooltip>
  );
}

const ControllerText = styled('div')`
  ${p => p.theme.overflowEllipsis};
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
  min-width: 0px;
`;
