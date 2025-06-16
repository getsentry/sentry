import {useCallback} from 'react';
import styled from '@emotion/styled';

import {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/gridEditable';
import {t} from 'sentry/locale';
import {HeadSortCell} from 'sentry/views/insights/agentMonitoring/components/headSortCell';
import {PerformanceBadge} from 'sentry/views/insights/browser/webVitals/components/performanceBadge';
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

const pageloadColumnOrder: Array<GridColumnOrder<string>> = [
  {key: 'transaction', name: t('Page'), width: COL_WIDTH_UNDEFINED},
  {key: 'span.op', name: t('Operation'), width: 122},
  {key: 'count()', name: t('Views'), width: 122},
  {key: 'failure_rate()', name: t('Error Rate'), width: 122},
  {
    key: 'avg(span.duration)',
    name: t('AVG Duration'),
    width: 140,
  },
  {
    key: 'performance_score(measurements.score.total)',
    name: t('Perf Score'),
    width: COL_WIDTH_UNDEFINED,
  },
];

const rightAlignColumns = new Set(['count()', 'failure_rate()', 'avg(span.duration)']);

export function ClientTable() {
  const tableDataRequest = useTableData({
    query: `span.op:[pageload, navigation]`,
    fields: [
      'transaction',
      'project.id',
      'span.op',
      'count()',
      'failure_rate()',
      'avg(span.duration)',
      'performance_score(measurements.score.total)',
      'count_if(span.op,navigation)',
      'count_if(span.op,pageload)',
    ],
    cursorParamName: 'tableCursor',
    referrer: Referrer.CLIENT_TABLE,
  });

  const renderHeadCell = useCallback((column: GridColumnHeader<string>) => {
    return (
      <HeadSortCell
        sortKey={column.key}
        align={rightAlignColumns.has(column.key) ? 'right' : 'left'}
        cursorParamName={'tableCursor'}
        forceCellGrow={column.key === 'transaction'}
      >
        {column.name}
      </HeadSortCell>
    );
  }, []);

  type TableData = (typeof tableDataRequest.data)[number];

  const renderBodyCell = useCallback(
    (column: GridColumnHeader<string>, dataRow: TableData) => {
      if (column.key === 'performance_score(measurements.score.total)') {
        if (!dataRow['count_if(span.op,pageload)']) {
          return <AlignCenter>{' — '}</AlignCenter>;
        }
        return (
          <AlignCenter>
            <PerformanceBadge
              score={Math.round(
                dataRow['performance_score(measurements.score.total)'] * 100
              )}
            />
          </AlignCenter>
        );
      }

      switch (column.key) {
        case 'transaction': {
          return (
            <TransactionCell
              transaction={dataRow.transaction}
              column={column}
              dataRow={dataRow}
              targetView="frontend"
              projectId={dataRow['project.id'].toString()}
              query={`transaction.op:${dataRow['span.op']}`}
            />
          );
        }
        case 'span.op':
          return <div>{dataRow['span.op']}</div>;
        case 'count()':
          return <NumberCell value={dataRow['count()']} />;
        case 'failure_rate()': {
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
        }
        case 'avg(span.duration)': {
          return <DurationCell milliseconds={dataRow['avg(span.duration)']} />;
        }
        default:
          return <div />;
      }
    },
    []
  );

  const pagesTablePageLinks = tableDataRequest.pageLinks;

  return (
    <PlatformInsightsTable
      isLoading={tableDataRequest.isPending}
      error={tableDataRequest.error}
      data={tableDataRequest.data}
      initialColumnOrder={pageloadColumnOrder}
      stickyHeader
      cursorParamName={'tableCursor'}
      pageLinks={pagesTablePageLinks}
      isPlaceholderData={tableDataRequest.isPlaceholderData}
      grid={{
        renderHeadCell,
        renderBodyCell,
      }}
    />
  );
}

const AlignCenter = styled('div')`
  text-align: center;
`;
