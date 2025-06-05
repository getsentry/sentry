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
import {ErrorRateCell} from 'sentry/views/insights/pages/platform/shared/table/ErrorRateCell';
import {NumberCell} from 'sentry/views/insights/pages/platform/shared/table/NumberCell';
import {TransactionCell} from 'sentry/views/insights/pages/platform/shared/table/TransactionCell';
import {useTableData} from 'sentry/views/insights/pages/platform/shared/table/useTableData';

const p95Threshold = {
  error: 4000,
  warning: 2500,
};

const pageloadColumnOrder: Array<GridColumnOrder<string>> = [
  {key: 'transaction', name: t('Page'), width: COL_WIDTH_UNDEFINED},
  {key: 'count()', name: t('Pageloads'), width: 122},
  {key: 'failure_rate()', name: t('Error Rate'), width: 122},
  {
    key: 'performance_score(measurements.score.total)',
    name: t('Perf Score'),
    width: COL_WIDTH_UNDEFINED,
  },
];

const navigationColumnOrder: Array<GridColumnOrder<string>> = [
  {key: 'transaction', name: t('Page'), width: COL_WIDTH_UNDEFINED},
  {key: 'count()', name: t('Navigations'), width: 132},
  {key: 'avg(span.duration)', name: t('Avg'), width: 90},
  {key: 'p95(span.duration)', name: t('P95'), width: 90},
  {key: 'sum(span.duration)', name: t('Time Spent'), width: 110},
];

interface PagesTableProps {
  spanOperationFilter: 'pageload' | 'navigation';
}

const CURSOR_PARAM_NAMES: Record<PagesTableProps['spanOperationFilter'], string> = {
  pageload: 'pageloadCursor',
  navigation: 'navigationCursor',
};

const rightAlignColumns = new Set([
  'count()',
  'failure_rate()',
  'sum(span.duration)',
  'avg(span.duration)',
  'p95(span.duration)',
  'performance_score(measurements.score.total)',
]);

export function PagesTable({spanOperationFilter}: PagesTableProps) {
  const currentCursorParamName = CURSOR_PARAM_NAMES[spanOperationFilter];

  const getInitialColumnOrder = () => {
    if (spanOperationFilter === 'pageload') {
      return pageloadColumnOrder;
    }
    return navigationColumnOrder;
  };

  const tableDataRequest = useTableData({
    query: `span.op:[${spanOperationFilter}]`,
    fields: [
      'transaction',
      'span.op',
      'failure_rate()',
      'count()',
      'sum(span.duration)',
      'avg(span.duration)',
      'p95(span.duration)',
      'performance_score(measurements.score.total)',
      'project.id',
    ],
    cursorParamName: currentCursorParamName,
    referrer: Referrer.PAGES_TABLE,
  });

  const renderHeadCell = useCallback(
    (column: GridColumnHeader<string>) => {
      return (
        <HeadSortCell
          sortKey={column.key}
          align={rightAlignColumns.has(column.key) ? 'right' : 'left'}
          cursorParamName={currentCursorParamName}
          forceCellGrow={column.key === 'transaction'}
        >
          {column.name}
        </HeadSortCell>
      );
    },
    [currentCursorParamName]
  );

  type TableData = (typeof tableDataRequest.data)[number];

  const renderBodyCell = useCallback(
    (column: GridColumnHeader<string>, dataRow: TableData) => {
      if (column.key === 'performance_score(measurements.score.total)') {
        const score = dataRow['performance_score(measurements.score.total)'];
        if (typeof score !== 'number') {
          return <AlignRight>{' — '}</AlignRight>;
        }
        return (
          <AlignCenter>
            <PerformanceBadge score={Math.round(score * 100)} />
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
          return <ErrorRateCell errorRate={dataRow['failure_rate()']} />;
        }
        case 'sum(span.duration)':
          return <DurationCell milliseconds={dataRow['sum(span.duration)']} />;
        case 'avg(span.duration)': {
          return <DurationCell milliseconds={dataRow['avg(span.duration)']} />;
        }
        case 'p95(span.duration)': {
          return (
            <DurationCell
              milliseconds={dataRow['p95(span.duration)']}
              thresholds={p95Threshold}
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
      initialColumnOrder={getInitialColumnOrder}
      stickyHeader
      cursorParamName={currentCursorParamName}
      pageLinks={pagesTablePageLinks}
      isPlaceholderData={tableDataRequest.isPlaceholderData}
      grid={{
        renderHeadCell,
        renderBodyCell,
      }}
    />
  );
}

const AlignRight = styled('div')`
  text-align: right;
`;

const AlignCenter = styled('div')`
  text-align: center;
`;
