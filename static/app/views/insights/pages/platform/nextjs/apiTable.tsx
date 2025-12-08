import {useCallback} from 'react';

import {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
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
import {useSpanTableData} from 'sentry/views/insights/pages/platform/shared/table/useTableData';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';
import type {SpanProperty} from 'sentry/views/insights/types';

const getP95Threshold = (avg: number) => {
  return {
    error: avg * 3,
    warning: avg * 2,
  };
};

const defaultColumnOrder: Array<GridColumnOrder<SpanProperty>> = [
  {key: 'transaction', name: t('Path'), width: COL_WIDTH_UNDEFINED},
  {key: 'count()', name: t('Requests'), width: 112},
  {key: 'failure_rate()', name: t('Error Rate'), width: 124},
  {key: 'avg(span.duration)', name: t('AVG'), width: 90},
  {key: 'p95(span.duration)', name: t('P95'), width: 90},
  {key: 'sum(span.duration)', name: t('Time Spent'), width: 120},
];

const rightAlignColumns = new Set([
  'avg(span.duration)',
  'count()',
  'failure_rate()',
  'p95(span.duration)',
  'sum(span.duration)',
]);

export function ApiTable() {
  const {query} = useTransactionNameQuery();
  const {tableSort} = useTableSort();
  const tableDataRequest = useSpanTableData({
    query: `transaction.op:http.server is_transaction:True ${query ?? ''}`.trim(),
    fields: [
      'project.id',
      'transaction',
      'avg(span.duration)',
      'p95(span.duration)',
      'failure_rate()',
      'count()',
      'sum(span.duration)',
    ],
    sort: tableSort,
    referrer: Referrer.API_TABLE,
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
        case 'transaction':
          return (
            <TransactionCell
              transaction={dataRow.transaction}
              column={column}
              dataRow={dataRow}
              projectId={dataRow['project.id'].toString()}
              targetView="backend"
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
