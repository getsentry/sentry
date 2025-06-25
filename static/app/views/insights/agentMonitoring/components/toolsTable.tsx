import {Fragment, memo, useCallback, useMemo} from 'react';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/gridEditable';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import getDuration from 'sentry/utils/duration/getDuration';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {
  CellLink,
  GridEditableContainer,
  LoadingOverlay,
} from 'sentry/views/insights/agentMonitoring/components/common';
import {
  HeadSortCell,
  useTableSortParams,
} from 'sentry/views/insights/agentMonitoring/components/headSortCell';
import {useColumnOrder} from 'sentry/views/insights/agentMonitoring/hooks/useColumnOrder';
import {
  AI_TOOL_NAME_ATTRIBUTE,
  getAIToolCallsFilter,
} from 'sentry/views/insights/agentMonitoring/utils/query';
import {Referrer} from 'sentry/views/insights/agentMonitoring/utils/referrers';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';

interface TableData {
  avg: number;
  errorRate: number;
  p95: number;
  requests: number;
  tool: string;
}

const EMPTY_ARRAY: never[] = [];

const defaultColumnOrder: Array<GridColumnOrder<string>> = [
  {key: 'tool', name: t('Tool Name'), width: COL_WIDTH_UNDEFINED},
  {key: 'count()', name: t('Requests'), width: 120},
  {key: 'avg(span.duration)', name: t('Avg'), width: 100},
  {key: 'p95(span.duration)', name: t('P95'), width: 100},
  {key: 'failure_rate()', name: t('Error Rate'), width: 120},
];

export function ToolsTable() {
  const navigate = useNavigate();
  const location = useLocation();

  const {columnOrder, onResizeColumn} = useColumnOrder(defaultColumnOrder);
  const {query} = useTransactionNameQuery();

  const fullQuery = `${getAIToolCallsFilter()} ${query}`.trim();

  const handleCursor: CursorHandler = (cursor, pathname, previousQuery) => {
    navigate(
      {
        pathname,
        query: {
          ...previousQuery,
          tableCursor: cursor,
        },
      },
      {replace: true, preventScrollReset: true}
    );
  };

  const {sortField, sortOrder} = useTableSortParams();

  const toolsRequest = useEAPSpans(
    {
      fields: [
        AI_TOOL_NAME_ATTRIBUTE,
        'count()',
        'avg(span.duration)',
        'p95(span.duration)',
        'failure_rate()',
      ],
      sorts: [{field: sortField, kind: sortOrder}],
      search: fullQuery,
      limit: 10,
      cursor:
        typeof location.query.toolsCursor === 'string'
          ? location.query.toolsCursor
          : undefined,
      keepPreviousData: true,
    },
    Referrer.TOOLS_TABLE
  );

  const tableData = useMemo(() => {
    if (!toolsRequest.data) {
      return [];
    }

    return toolsRequest.data.map(span => ({
      tool: `${span[AI_TOOL_NAME_ATTRIBUTE]}`,
      requests: span['count()'],
      avg: span['avg(span.duration)'],
      p95: span['p95(span.duration)'],
      errorRate: span['failure_rate()'],
    }));
  }, [toolsRequest.data]);

  const renderHeadCell = useCallback((column: GridColumnHeader<string>) => {
    return (
      <HeadSortCell
        sortKey={column.key}
        cursorParamName="toolsCursor"
        forceCellGrow={column.key === 'tool'}
      >
        {column.name}
      </HeadSortCell>
    );
  }, []);

  const renderBodyCell = useCallback(
    (column: GridColumnOrder<string>, dataRow: TableData) => {
      return <BodyCell column={column} dataRow={dataRow} />;
    },
    []
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
}: {
  column: GridColumnHeader<string>;
  dataRow: TableData;
}) {
  const organization = useOrganization();

  const exploreUrl = getExploreUrl({
    organization,
    mode: Mode.SAMPLES,
    visualize: [
      {
        chartType: ChartType.BAR,
        yAxes: ['count(span.duration)'],
      },
    ],
    query: `${AI_TOOL_NAME_ATTRIBUTE}:${dataRow.tool}`,
  });

  switch (column.key) {
    case 'tool':
      return <CellLink to={exploreUrl}>{dataRow.tool}</CellLink>;
    case 'count()':
      return dataRow.requests;
    case 'avg(span.duration)':
      return getDuration(dataRow.avg / 1000, 2, true);
    case 'p95(span.duration)':
      return getDuration(dataRow.p95 / 1000, 2, true);
    case 'failure_rate()':
      return formatPercentage(dataRow.errorRate ?? 0);
    default:
      return null;
  }
});
