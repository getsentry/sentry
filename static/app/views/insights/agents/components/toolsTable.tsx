import {Fragment, memo, useCallback, useMemo} from 'react';

import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {
  CellLink,
  GridEditableContainer,
  LoadingOverlay,
} from 'sentry/views/insights/agents/components/common';
import {
  HeadSortCell,
  useTableSortParams,
} from 'sentry/views/insights/agents/components/headSortCell';
import {useColumnOrder} from 'sentry/views/insights/agents/hooks/useColumnOrder';
import {useCombinedQuery} from 'sentry/views/insights/agents/hooks/useCombinedQuery';
import {ErrorCell} from 'sentry/views/insights/agents/utils/cells';
import {Referrer} from 'sentry/views/insights/agents/utils/referrers';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
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
  {key: 'count_if(span.status,equals,unknown)', name: t('Errors'), width: 120},
  {key: 'avg(span.duration)', name: t('Avg'), width: 100},
  {key: 'p95(span.duration)', name: t('P95'), width: 100},
];

const rightAlignColumns = new Set([
  'count()',
  'count_if(span.status,equals,unknown)',
  'avg(span.duration)',
  'p95(span.duration)',
]);

export function ToolsTable() {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();

  const {columnOrder, onResizeColumn} = useColumnOrder(defaultColumnOrder);

  const fullQuery = useCombinedQuery(`span.op:gen_ai.execute_tool`);

  const handleCursor: CursorHandler = (cursor, pathname, previousQuery) => {
    navigate(
      {
        pathname,
        query: {
          ...previousQuery,
          toolsCursor: cursor,
        },
      },
      {replace: true, preventScrollReset: true}
    );
  };

  const {sortField, sortOrder} = useTableSortParams();

  const cursor = decodeScalar(location.query?.toolsCursor);

  const toolsRequest = useSpans(
    {
      fields: [
        'gen_ai.tool.name',
        'count()',
        'avg(span.duration)',
        'p95(span.duration)',
        'failure_rate()',
        'count_if(span.status,equals,unknown)', // spans with status unknown are errors
      ],
      sorts: [{field: sortField, kind: sortOrder}],
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
      errors: Number(span['count_if(span.status,equals,unknown)']),
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
          cursorParamName="toolsCursor"
          forceCellGrow={column.key === 'tool'}
          align={rightAlignColumns.has(column.key) ? 'right' : undefined}
          onClick={handleSort}
        >
          {column.name}
        </HeadSortCell>
      );
    },
    [handleSort]
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
            onResizeColumn,
          }}
        />
        {toolsRequest.isPlaceholderData && <LoadingOverlay />}
      </GridEditableContainer>
      <Pagination pageLinks={toolsRequest.pageLinks} onCursor={handleCursor} />
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
    query: `gen_ai.tool.name:${dataRow.tool}`,
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
    case 'count_if(span.status,equals,unknown)':
      return (
        <ErrorCell
          value={dataRow.errors}
          target={getExploreUrl({
            query: `${query} span.status:unknown gen_ai.tool.name:${dataRow.tool}`,
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
