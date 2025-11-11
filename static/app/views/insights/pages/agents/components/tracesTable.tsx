import {Fragment, memo, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/core/tooltip';
import Pagination from 'sentry/components/pagination';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import useStateBasedColumnResize from 'sentry/components/tables/gridEditable/useStateBasedColumnResize';
import TimeSince from 'sentry/components/timeSince';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {useTraces} from 'sentry/views/explore/hooks/useTraces';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {
  OverflowEllipsisTextContainer,
  TextAlignRight,
} from 'sentry/views/insights/common/components/textAlign';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useTraceViewDrawer} from 'sentry/views/insights/pages/agents/components/drawer';
import {LLMCosts} from 'sentry/views/insights/pages/agents/components/llmCosts';
import {useCombinedQuery} from 'sentry/views/insights/pages/agents/hooks/useCombinedQuery';
import {useTableCursor} from 'sentry/views/insights/pages/agents/hooks/useTableCursor';
import {
  ErrorCell,
  NumberPlaceholder,
} from 'sentry/views/insights/pages/agents/utils/cells';
import {
  getAgentRunsFilter,
  getAITracesFilter,
} from 'sentry/views/insights/pages/agents/utils/query';
import {Referrer} from 'sentry/views/insights/pages/agents/utils/referrers';
import {DurationCell} from 'sentry/views/insights/pages/platform/shared/table/DurationCell';
import {NumberCell} from 'sentry/views/insights/pages/platform/shared/table/NumberCell';

interface TableData {
  duration: number;
  errors: number;
  llmCalls: number;
  timestamp: number;
  toolCalls: number;
  totalCost: number | null;
  totalTokens: number;
  traceId: string;
  transaction: string;
  isSpanDataLoading?: boolean;
}

const EMPTY_ARRAY: never[] = [];

const defaultColumnOrder: Array<GridColumnOrder<string>> = [
  {key: 'traceId', name: t('Trace ID'), width: 110},
  {key: 'transaction', name: t('Trace Root'), width: COL_WIDTH_UNDEFINED},
  {key: 'duration', name: t('Root Duration'), width: 130},
  {key: 'errors', name: t('Errors'), width: 100},
  {key: 'llmCalls', name: t('LLM Calls'), width: 110},
  {key: 'toolCalls', name: t('Tool Calls'), width: 110},
  {key: 'totalTokens', name: t('Total Tokens'), width: 120},
  {key: 'totalCost', name: t('Total Cost'), width: 120},
  {key: 'timestamp', name: t('Timestamp'), width: 100},
];

const rightAlignColumns = new Set([
  'duration',
  'errors',
  'llmCalls',
  'totalTokens',
  'toolCalls',
  'totalCost',
  'timestamp',
]);

export function TracesTable() {
  const {columns: columnOrder, handleResizeColumn} = useStateBasedColumnResize({
    columns: defaultColumnOrder,
  });

  const combinedQuery = useCombinedQuery(getAITracesFilter());
  const {cursor, setCursor} = useTableCursor();

  const tracesRequest = useTraces({
    query: combinedQuery,
    sort: `-timestamp`,
    keepPreviousData: true,
    cursor,
    limit: 10,
  });

  const pageLinks = tracesRequest.getResponseHeader?.('Link') ?? undefined;

  const spansRequest = useSpans(
    {
      // Exclude agent runs as they include aggregated data which would lead to double counting e.g. token usage
      search: `${getAgentRunsFilter({negated: true})} trace:[${tracesRequest.data?.data.map(span => span.trace).join(',')}]`,
      fields: [
        'trace',
        'count_if(gen_ai.operation.type,equals,ai_client)',
        'count_if(span.op,equals,gen_ai.execute_tool)',
        'sum(gen_ai.usage.total_tokens)',
        'sum(gen_ai.usage.total_cost)',
      ],
      limit: tracesRequest.data?.data.length ?? 0,
      enabled: Boolean(tracesRequest.data && tracesRequest.data.data.length > 0),
      samplingMode: SAMPLING_MODE.HIGH_ACCURACY,
    },
    Referrer.TRACES_TABLE
  );

  const traceErrorRequest = useSpans(
    {
      // Get all spans with error status
      search: `span.status:internal_error trace:[${tracesRequest.data?.data.map(span => span.trace).join(',')}]`,
      fields: ['trace', 'count(span.duration)'],
      limit: tracesRequest.data?.data.length ?? 0,
      enabled: Boolean(tracesRequest.data && tracesRequest.data.data.length > 0),
    },
    Referrer.TRACES_TABLE
  );

  const spanDataMap = useMemo(() => {
    if (!spansRequest.data || !traceErrorRequest.data) {
      return {};
    }
    // sum up the error spans for a trace
    const errors = traceErrorRequest.data?.reduce(
      (acc, span) => {
        acc[span.trace] = Number(span['count(span.duration)'] ?? 0);
        return acc;
      },
      {} as Record<string, number>
    );

    return spansRequest.data.reduce(
      (acc, span) => {
        acc[span.trace] = {
          llmCalls: Number(span['count_if(gen_ai.operation.type,equals,ai_client)'] ?? 0),
          toolCalls: Number(span['count_if(span.op,equals,gen_ai.execute_tool)'] ?? 0),
          totalTokens: Number(span['sum(gen_ai.usage.total_tokens)'] ?? 0),
          totalCost: Number(span['sum(gen_ai.usage.total_cost)'] ?? 0),
          totalErrors: Number(errors[span.trace] ?? 0),
        };
        return acc;
      },
      {} as Record<
        string,
        {
          llmCalls: number;
          toolCalls: number;
          totalCost: number;
          totalErrors: number;
          totalTokens: number;
        }
      >
    );
  }, [spansRequest.data, traceErrorRequest.data]);

  const tableData = useMemo(() => {
    if (!tracesRequest.data) {
      return [];
    }

    return tracesRequest.data.data.map(span => ({
      traceId: span.trace,
      transaction: span.name ?? '',
      duration: span.duration,
      errors: spanDataMap[span.trace]?.totalErrors ?? 0,
      llmCalls: spanDataMap[span.trace]?.llmCalls ?? 0,
      toolCalls: spanDataMap[span.trace]?.toolCalls ?? 0,
      totalTokens: spanDataMap[span.trace]?.totalTokens ?? 0,
      totalCost: spanDataMap[span.trace]?.totalCost ?? null,
      timestamp: span.start,
      isSpanDataLoading: spansRequest.isLoading || traceErrorRequest.isLoading,
    }));
  }, [
    tracesRequest.data,
    spanDataMap,
    spansRequest.isLoading,
    traceErrorRequest.isLoading,
  ]);

  const renderHeadCell = useCallback((column: GridColumnHeader<string>) => {
    return (
      <HeadCell align={rightAlignColumns.has(column.key) ? 'right' : 'left'}>
        {column.name}
        {column.key === 'timestamp' && <IconArrow direction="down" size="xs" />}
        {column.key === 'transaction' && <CellExpander />}
      </HeadCell>
    );
  }, []);

  const renderBodyCell = useCallback(
    (column: GridColumnOrder<string>, dataRow: TableData) => {
      return <BodyCell column={column} dataRow={dataRow} query={combinedQuery} />;
    },
    [combinedQuery]
  );

  return (
    <Fragment>
      <GridEditableContainer>
        <GridEditable
          isLoading={tracesRequest.isPending}
          error={tracesRequest.error}
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
        {tracesRequest.isPlaceholderData && <LoadingOverlay />}
      </GridEditableContainer>
      <Pagination pageLinks={pageLinks} onCursor={setCursor} />
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
  const {openTraceViewDrawer} = useTraceViewDrawer();

  switch (column.key) {
    case 'traceId':
      return (
        <span>
          <TraceIdButton
            priority="link"
            onClick={() =>
              openTraceViewDrawer(dataRow.traceId, undefined, dataRow.timestamp / 1000)
            }
          >
            {dataRow.traceId.slice(0, 8)}
          </TraceIdButton>
        </span>
      );
    case 'transaction':
      return (
        <Tooltip title={dataRow.transaction} showOnlyOnOverflow skipWrapper>
          <OverflowEllipsisTextContainer>
            {dataRow.transaction}
          </OverflowEllipsisTextContainer>
        </Tooltip>
      );
    case 'duration':
      return <DurationCell milliseconds={dataRow.duration} />;
    case 'errors':
      return (
        <ErrorCell
          value={dataRow.errors}
          target={getExploreUrl({
            query: `${query} span.status:internal_error trace:[${dataRow.traceId}]`,
            organization,
            selection,
            referrer: Referrer.TRACES_TABLE,
          })}
          isLoading={dataRow.isSpanDataLoading}
        />
      );
    case 'llmCalls':
    case 'toolCalls':
    case 'totalTokens':
      if (dataRow.isSpanDataLoading) {
        return <NumberPlaceholder />;
      }
      return <NumberCell value={dataRow[column.key]} />;
    case 'totalCost':
      if (dataRow.isSpanDataLoading) {
        return <NumberPlaceholder />;
      }
      return (
        <TextAlignRight>
          <LLMCosts cost={dataRow.totalCost} />
        </TextAlignRight>
      );
    case 'timestamp':
      return (
        <TextAlignRight>
          <TimeSince unitStyle="extraShort" date={new Date(dataRow.timestamp)} />
        </TextAlignRight>
      );
    default:
      return null;
  }
});

const GridEditableContainer = styled('div')`
  position: relative;
  margin-bottom: ${p => p.theme.space.md};
`;

const LoadingOverlay = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: ${p => p.theme.background};
  opacity: 0.5;
  z-index: 1;
`;

/**
 * Used to force the cell to expand take as much width as possible in the table layout
 * otherwise grid editable will let the last column grow
 */
const CellExpander = styled('div')`
  width: 100vw;
`;

const HeadCell = styled('div')<{align: 'left' | 'right'}>`
  display: flex;
  flex: 1;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  justify-content: ${p => (p.align === 'right' ? 'flex-end' : 'flex-start')};
`;

const TraceIdButton = styled(Button)`
  font-weight: normal;
`;
