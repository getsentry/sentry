import {useCallback} from 'react';

import {Link} from 'sentry/components/core/link';
import {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {
  HeadSortCell,
  useTableSort,
} from 'sentry/views/insights/pages/agents/components/headSortCell';
import {useCombinedQuery} from 'sentry/views/insights/pages/agents/hooks/useCombinedQuery';
import {MCPReferrer} from 'sentry/views/insights/pages/mcp/utils/referrer';
import {PlatformInsightsTable} from 'sentry/views/insights/pages/platform/shared/table';
import {DurationCell} from 'sentry/views/insights/pages/platform/shared/table/DurationCell';
import {ErrorRateCell} from 'sentry/views/insights/pages/platform/shared/table/ErrorRateCell';
import {NumberCell} from 'sentry/views/insights/pages/platform/shared/table/NumberCell';
import {useSpanTableData} from 'sentry/views/insights/pages/platform/shared/table/useTableData';
import {SpanFields} from 'sentry/views/insights/types';

const AVG_DURATION = `avg(${SpanFields.SPAN_DURATION})`;
const P95_DURATION = `p95(${SpanFields.SPAN_DURATION})`;

const defaultColumnOrder: Array<GridColumnOrder<string>> = [
  {key: SpanFields.MCP_TOOL_NAME, name: t('Tool Name'), width: COL_WIDTH_UNDEFINED},
  {key: 'count()', name: t('Requests'), width: 136},
  {key: 'failure_rate()', name: t('Error Rate'), width: 124},
  {key: AVG_DURATION, name: t('AVG'), width: 90},
  {key: P95_DURATION, name: t('P95'), width: 90},
];

const rightAlignColumns = new Set([
  'count()',
  'failure_rate()',
  AVG_DURATION,
  P95_DURATION,
]);

export function McpToolsTable() {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const query = useCombinedQuery(`span.op:mcp.server has:${SpanFields.MCP_TOOL_NAME}`);
  const {tableSort} = useTableSort();
  const tableDataRequest = useSpanTableData({
    query,
    fields: [
      SpanFields.MCP_TOOL_NAME,
      SpanFields.PROJECT_ID,
      'count()',
      'failure_rate()',
      AVG_DURATION,
      P95_DURATION,
    ],
    sort: tableSort,
    referrer: MCPReferrer.MCP_TOOL_TABLE,
  });

  const handleSort = useCallback(
    (column: string, direction: 'asc' | 'desc') => {
      trackAnalytics('mcp-monitoring.column-sort', {
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
          align={rightAlignColumns.has(column.key) ? 'right' : 'left'}
          forceCellGrow={column.key === SpanFields.MCP_TOOL_NAME}
          onClick={handleSort}
        >
          {column.name}
        </HeadSortCell>
      );
    },
    [handleSort, tableSort]
  );

  type TableData = (typeof tableDataRequest.data)[number];

  const renderBodyCell = useCallback(
    (column: GridColumnOrder<string>, dataRow: TableData) => {
      switch (column.key) {
        case SpanFields.MCP_TOOL_NAME:
          return <McpToolCell tool={dataRow[SpanFields.MCP_TOOL_NAME]} />;
        case 'failure_rate()':
          return (
            <ErrorRateCell
              errorRate={dataRow['failure_rate()']}
              total={dataRow['count()']}
              issuesLink={getExploreUrl({
                query: `${query} span.status:internal_error ${SpanFields.MCP_TOOL_NAME}:${dataRow[SpanFields.MCP_TOOL_NAME]}`,
                selection,
                organization,
                referrer: MCPReferrer.MCP_TOOL_TABLE,
              })}
            />
          );
        case 'count()':
          return <NumberCell value={dataRow['count()']} />;
        case AVG_DURATION:
        case P95_DURATION:
          return <DurationCell milliseconds={dataRow[column.key]} />;
        default:
          return <div />;
      }
    },
    [organization, query, selection]
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

function McpToolCell({tool}: {tool: string}) {
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
    query: `span.op:mcp.server ${SpanFields.MCP_TOOL_NAME}:"${tool}"`,
    sort: `-count(span.duration)`,
    field: ['span.description', 'mcp.tool.result.content', 'span.duration', 'timestamp'],
  });
  return <Link to={link}>{tool}</Link>;
}
