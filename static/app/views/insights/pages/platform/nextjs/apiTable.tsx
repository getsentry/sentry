import {useCallback} from 'react';

import {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import {HeadSortCell} from 'sentry/views/insights/agentMonitoring/components/headSortCell';
import {TimeSpentCell} from 'sentry/views/insights/common/components/tableCells/timeSpentCell';
import {Referrer} from 'sentry/views/insights/pages/platform/laravel/referrers';
import {PlatformInsightsTable} from 'sentry/views/insights/pages/platform/shared/table';
import {DurationCell} from 'sentry/views/insights/pages/platform/shared/table/DurationCell';
import {
  ErrorRateCell,
  getErrorCellIssuesLink,
} from 'sentry/views/insights/pages/platform/shared/table/ErrorRateCell';
import {NumberCell} from 'sentry/views/insights/pages/platform/shared/table/NumberCell';
import {TransactionCell} from 'sentry/views/insights/pages/platform/shared/table/TransactionCell';
import {useTableData} from 'sentry/views/insights/pages/platform/shared/table/useTableData';

const getP95Threshold = (avg: number) => {
  return {
    error: avg * 3,
    warning: avg * 2,
  };
};

const defaultColumnOrder: Array<GridColumnOrder<string>> = [
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
  const tableDataRequest = useTableData({
    query: 'transaction.op:http.server is_transaction:True',
    fields: [
      'project.id',
      'transaction',
      'avg(span.duration)',
      'p95(span.duration)',
      'failure_rate()',
      'count()',
      'sum(span.duration)',
    ],
    cursorParamName: 'tableCursor',
    referrer: Referrer.API_TABLE,
  });

  const renderHeadCell = useCallback((column: GridColumnHeader<string>) => {
    return (
      <HeadSortCell
        sortKey={column.key}
        align={rightAlignColumns.has(column.key) ? 'right' : 'left'}
        forceCellGrow={column.key === 'transaction'}
        cursorParamName="tableCursor"
      >
        {column.name}
      </HeadSortCell>
    );
  }, []);

  const renderBodyCell = useCallback(
    (
      column: GridColumnOrder<string>,
      dataRow: (typeof tableDataRequest.data)[number]
    ) => {
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
    [tableDataRequest]
  );

  return (
    <PlatformInsightsTable
      isLoading={tableDataRequest.isPending}
      error={tableDataRequest.error}
      data={tableDataRequest.data}
      initialColumnOrder={defaultColumnOrder}
      stickyHeader
      grid={{
        renderBodyCell,
        renderHeadCell,
      }}
      cursorParamName="tableCursor"
      pageLinks={tableDataRequest.pageLinks}
      isPlaceholderData={tableDataRequest.isPlaceholderData}
    />
  );
}
