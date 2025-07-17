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
import {HeadSortCell} from 'sentry/views/insights/agentMonitoring/components/headSortCell';
import {useCombinedQuery} from 'sentry/views/insights/agentMonitoring/hooks/useCombinedQuery';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {MCPReferrer} from 'sentry/views/insights/mcp/utils/referrer';
import {PlatformInsightsTable} from 'sentry/views/insights/pages/platform/shared/table';
import {DurationCell} from 'sentry/views/insights/pages/platform/shared/table/DurationCell';
import {ErrorRateCell} from 'sentry/views/insights/pages/platform/shared/table/ErrorRateCell';
import {NumberCell} from 'sentry/views/insights/pages/platform/shared/table/NumberCell';
import {useSpanTableData} from 'sentry/views/insights/pages/platform/shared/table/useTableData';
import {SpanFields} from 'sentry/views/insights/types';

const AVG_DURATION = `avg(${SpanFields.SPAN_DURATION})`;
const P95_DURATION = `p95(${SpanFields.SPAN_DURATION})`;

const defaultColumnOrder: Array<GridColumnOrder<string>> = [
  {key: SpanFields.MCP_RESOURCE_URI, name: t('Resource URI'), width: COL_WIDTH_UNDEFINED},
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

export function McpResourcesTable() {
  const organization = useOrganization();
  const query = useCombinedQuery(`span.op:mcp.server has:${SpanFields.MCP_RESOURCE_URI}`);
  const tableDataRequest = useSpanTableData({
    query,
    fields: [
      SpanFields.MCP_RESOURCE_URI,
      SpanFields.PROJECT_ID,
      'count()',
      'failure_rate()',
      AVG_DURATION,
      P95_DURATION,
    ],
    cursorParamName: 'tableCursor',
    referrer: MCPReferrer.MCP_RESOURCE_TABLE,
  });

  const handleSort = useCallback(
    (column: string, direction: 'asc' | 'desc') => {
      trackAnalytics('mcp-monitoring.column-sort', {
        organization,
        table: 'resources',
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
          align={rightAlignColumns.has(column.key) ? 'right' : 'left'}
          forceCellGrow={column.key === SpanFields.MCP_RESOURCE_URI}
          cursorParamName="tableCursor"
          onClick={handleSort}
        >
          {column.name}
        </HeadSortCell>
      );
    },
    [handleSort]
  );

  const renderBodyCell = useCallback(
    (
      column: GridColumnOrder<string>,
      dataRow: (typeof tableDataRequest.data)[number]
    ) => {
      switch (column.key) {
        case SpanFields.MCP_RESOURCE_URI:
          return <McpResourceCell resource={dataRow[SpanFields.MCP_RESOURCE_URI]} />;
        case 'failure_rate()':
          return (
            <ErrorRateCell
              errorRate={dataRow['failure_rate()']}
              total={dataRow['count()']}
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

function McpResourceCell({resource}: {resource: string}) {
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
    query: `span.op:mcp.server ${SpanFields.MCP_RESOURCE_URI}:"${resource}"`,
    sort: `-count(span.duration)`,
  });
  return <Link to={link}>{resource}</Link>;
}
