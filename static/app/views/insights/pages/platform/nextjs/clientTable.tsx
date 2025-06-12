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
  {key: 'count()', name: t('Pageloads'), width: 122},
  {key: 'failure_rate()', name: t('Error Rate'), width: 122},
  {
    key: 'avg_if(span.duration,span.op,navigation)',
    name: t('AVG Navigation Duration'),
    width: 210,
  },
  {
    key: 'performance_score(measurements.score.total)',
    name: t('Perf Score'),
    width: COL_WIDTH_UNDEFINED,
  },
];

const rightAlignColumns = new Set([
  'count()',
  'failure_rate()',
  'avg_if(span.duration,span.op,navigation)',
]);

export function ClientTable() {
  const tableDataRequest = useTableData({
    query: `span.op:[pageload, navigation]`,
    fields: [
      'transaction',
      'project.id',
      'count()',
      'failure_rate()',
      'avg_if(span.duration,span.op,navigation)',
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
            />
          );
        }
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
        case 'avg_if(span.duration,span.op,navigation)': {
          if (!dataRow['count_if(span.op,navigation)']) {
            return <NoData>{' — '}</NoData>;
          }
          return (
            <DurationCell
              milliseconds={dataRow['avg_if(span.duration,span.op,navigation)']}
            />
          );
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

const NoData = styled('div')`
  text-align: right;
  color: ${p => p.theme.subText};
`;
