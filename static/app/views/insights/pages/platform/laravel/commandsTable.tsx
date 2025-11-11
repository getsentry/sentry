import {useCallback} from 'react';

import {Link} from 'sentry/components/core/link';
import {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
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
import {useSpanTableData} from 'sentry/views/insights/pages/platform/shared/table/useTableData';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';

const defaultColumnOrder: Array<GridColumnOrder<string>> = [
  {key: 'command', name: t('Command Name'), width: COL_WIDTH_UNDEFINED},
  {key: 'count()', name: t('Invocations'), width: 136},
  {key: 'failure_rate()', name: t('Error Rate'), width: 124},
  {key: 'avg(span.duration)', name: t('AVG'), width: 90},
  {key: 'p95(span.duration)', name: t('P95'), width: 90},
  {key: 'sum(span.duration)', name: t('Time Spent'), width: 120},
];

const rightAlignColumns = new Set([
  'count()',
  'failure_rate()',
  'sum(span.duration)',
  'avg(span.duration)',
  'p95(span.duration)',
]);

export function CommandsTable() {
  const {query} = useTransactionNameQuery();
  const {tableSort} = useTableSort();
  const tableDataRequest = useSpanTableData({
    query: `span.op:console.command* ${query ?? ''}`.trim(),
    fields: [
      'command',
      'project.id',
      'count()',
      'failure_rate()',
      'avg(span.duration)',
      'p95(span.duration)',
      'sum(span.duration)',
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
          forceCellGrow={column.key === 'command'}
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
        case 'command':
          return <CommandCell command={dataRow.command} />;
        case 'failure_rate()':
          return (
            <ErrorRateCell
              errorRate={dataRow['failure_rate()']}
              total={dataRow['count()']}
              issuesLink={getErrorCellIssuesLink({
                projectId: dataRow['project.id'],
                query: `command:"${dataRow.command}"`,
              })}
            />
          );
        case 'avg(span.duration)':
        case 'p95(span.duration)':
          return <DurationCell milliseconds={dataRow[column.key]} />;
        case 'count()':
          return <NumberCell value={dataRow['count()']} />;
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

function CommandCell({command}: {command: string}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const link = getExploreUrl({
    organization,
    selection,
    mode: Mode.SAMPLES,
    visualize: [
      {
        chartType: ChartType.BAR,
        yAxes: ['count(span.duration)'],
      },
    ],
    query: `span.op:console.command* command:${command}`,
    sort: `-count(span.duration)`,
  });
  return <Link to={link}>{command}</Link>;
}
