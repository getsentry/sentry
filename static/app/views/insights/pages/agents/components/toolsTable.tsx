import {Fragment, memo, useCallback, useMemo} from 'react';

import Pagination from 'sentry/components/pagination';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import useStateBasedColumnResize from 'sentry/components/tables/gridEditable/useStateBasedColumnResize';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {
  CellLink,
  GridEditableContainer,
  LoadingOverlay,
} from 'sentry/views/insights/pages/agents/components/common';
import {
  HeadSortCell,
  useTableSort,
} from 'sentry/views/insights/pages/agents/components/headSortCell';
import {useCombinedQuery} from 'sentry/views/insights/pages/agents/hooks/useCombinedQuery';
import {useTableCursor} from 'sentry/views/insights/pages/agents/hooks/useTableCursor';
import {ErrorCell} from 'sentry/views/insights/pages/agents/utils/cells';
import {Referrer} from 'sentry/views/insights/pages/agents/utils/referrers';
import {DurationCell} from 'sentry/views/insights/pages/platform/shared/table/DurationCell';
import {NumberCell} from 'sentry/views/insights/pages/platform/shared/table/NumberCell';

interface TableData {
  avg: number;
  errors: number;
  p95: number;
  requests: number;
  tool: string;
}

const EMPTY_ARRAY: never[] = [];

const defaultColumnOrder: Array<GridColumnOrder<string>> = [
  {key: 'tool', name: t('Tool Name'), width: COL_WIDTH_UNDEFINED},
  {key: 'count()', name: t('Requests'), width: 120},
  {key: 'count_if(span.status,equals,internal_error)', name: t('Errors'), width: 120},
  {key: 'avg(span.duration)', name: t('Avg'), width: 100},
  {key: 'p95(span.duration)', name: t('P95'), width: 100},
];

const rightAlignColumns = new Set([
  'count()',
  'count_if(span.status,equals,internal_error)',
  'avg(span.duration)',
  'p95(span.duration)',
]);

export function ToolsTable() {
  const organization = useOrganization();

  const {columns: columnOrder, handleResizeColumn} = useStateBasedColumnResize({
    columns: defaultColumnOrder,
  });

  const fullQuery = useCombinedQuery(`span.op:gen_ai.execute_tool`);

  const {cursor, setCursor} = useTableCursor();

  const {tableSort} = useTableSort();

  const toolsRequest = useSpans(
    {
      fields: [
        'gen_ai.tool.name',
        'count()',
        'avg(span.duration)',
        'p95(span.duration)',
        'failure_rate()',
        'count_if(span.status,equals,internal_error)',
      ],
      sorts: [tableSort],
      search: fullQuery,
      limit: 10,
      cursor,
      keepPreviousData: true,
    },
    Referrer.TOOLS_TABLE
  );

  const tableData = useMemo(() => {
    if (!toolsRequest.data) {
      return [];
    }

    return toolsRequest.data.map(span => ({
      tool: `${span['gen_ai.tool.name']}`,
      requests: Number(span['count()']),
      avg: Number(span['avg(span.duration)']),
      p95: Number(span['p95(span.duration)']),
      errors: Number(span['count_if(span.status,equals,internal_error)']),
    }));
  }, [toolsRequest.data]);

  const handleSort = useCallback(
    (column: string, direction: 'asc' | 'desc') => {
      trackAnalytics('agent-monitoring.column-sort', {
        organization,
        table: 'tools',
        column,
        direction,
      });
    },
    [organization]
  );

  const renderHeadCell = useCallback(
    (column: GridColumnHeader<string>) => {
      return (
        <HeadSortCell
          sortKey={column.key}
          currentSort={tableSort}
          forceCellGrow={column.key === 'tool'}
          align={rightAlignColumns.has(column.key) ? 'right' : undefined}
          onClick={handleSort}
        >
          {column.name}
        </HeadSortCell>
      );
    },
    [handleSort, tableSort]
  );

  const renderBodyCell = useCallback(
    (column: GridColumnOrder<string>, dataRow: TableData) => {
      return <BodyCell column={column} dataRow={dataRow} query={fullQuery} />;
    },
    [fullQuery]
  );

  return (
    <Fragment>
      <GridEditableContainer>
        <GridEditable
          isLoading={toolsRequest.isPending}
          error={toolsRequest.error}
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
        {toolsRequest.isPlaceholderData && <LoadingOverlay />}
      </GridEditableContainer>
      <Pagination pageLinks={toolsRequest.pageLinks} onCursor={setCursor} />
    </Fragment>
  );
}

const BodyCell = memo(function BodyCell({
  column,
  dataRow,
  query,
}: {
  column: GridColumnHeader<string>;
  dataRow: TableData;
  query: string;
}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const exploreUrl = getExploreUrl({
    selection,
    organization,
    mode: Mode.SAMPLES,
    visualize: [
      {
        chartType: ChartType.BAR,
        yAxes: ['count(span.duration)'],
      },
      {
        chartType: ChartType.LINE,
        yAxes: ['avg(span.duration)'],
      },
    ],
    query: `gen_ai.tool.name:"${dataRow.tool}"`,
    field: ['span.description', 'gen_ai.tool.output', 'span.duration', 'timestamp'],
  });

  switch (column.key) {
    case 'tool':
      return <CellLink to={exploreUrl}>{dataRow.tool}</CellLink>;
    case 'count()':
      return <NumberCell value={dataRow.requests} />;
    case 'avg(span.duration)':
      return <DurationCell milliseconds={dataRow.avg} />;
    case 'p95(span.duration)':
      return <DurationCell milliseconds={dataRow.p95} />;
    case 'count_if(span.status,equals,internal_error)':
      return (
        <ErrorCell
          value={dataRow.errors}
          target={getExploreUrl({
            query: `${query} span.status:internal_error gen_ai.tool.name:"${dataRow.tool}"`,
            organization,
            selection,
            referrer: Referrer.TOOLS_TABLE,
          })}
        />
      );
    default:
      return null;
  }
});
