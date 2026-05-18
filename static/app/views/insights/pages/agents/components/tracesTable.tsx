import {memo, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import {keepPreviousData, useQuery} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Pagination} from '@sentry/scraps/pagination';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Placeholder} from 'sentry/components/placeholder';
import {
  COL_WIDTH_UNDEFINED,
  GridEditable,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import {useStateBasedColumnResize} from 'sentry/components/tables/gridEditable/useStateBasedColumnResize';
import {TimeSince} from 'sentry/components/timeSince';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {ellipsize} from 'sentry/utils/string/ellipsize';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {WidgetType, type DashboardFilters} from 'sentry/views/dashboards/types';
import {applyDashboardFilters} from 'sentry/views/dashboards/utils';
import {FRAMELESS_STYLES} from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetVisualization';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {useTracesApiOptions} from 'sentry/views/explore/hooks/useTraces';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {CurrencyCell} from 'sentry/views/insights/common/components/tableCells/currencyCell';
import {TextAlignRight} from 'sentry/views/insights/common/components/textAlign';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import type {useTraceViewDrawer} from 'sentry/views/insights/pages/agents/components/drawer';
import {useCombinedQuery} from 'sentry/views/insights/pages/agents/hooks/useCombinedQuery';
import {useTableCursor} from 'sentry/views/insights/pages/agents/hooks/useTableCursor';
import {extractAssistantOutput} from 'sentry/views/insights/pages/agents/utils/aiMessageNormalizer';
import {
  ErrorCell,
  NumberPlaceholder,
} from 'sentry/views/insights/pages/agents/utils/cells';
import {decodeUnicodeEscapes} from 'sentry/views/insights/pages/agents/utils/decodeUnicodeEscapes';
import {
  getAgentRunsFilter,
  getHasAiSpansFilter,
} from 'sentry/views/insights/pages/agents/utils/query';
import {Referrer} from 'sentry/views/insights/pages/agents/utils/referrers';
import {NumberCell} from 'sentry/views/insights/pages/platform/shared/table/NumberCell';
import {AIContentRenderer} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiContentRenderer';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {TraceLayoutTabKeys} from 'sentry/views/performance/newTraceDetails/useTraceLayoutTabs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

interface TableData {
  errors: number;
  llmCalls: number;
  output: string | null;
  timestamp: number;
  toolCalls: number;
  totalCost: number | null;
  totalTokens: number;
  traceId: string;
  isOutputLoading?: boolean;
  isSpanDataLoading?: boolean;
}

const EMPTY_ARRAY: never[] = [];

const defaultColumnOrder: Array<GridColumnOrder<string>> = [
  {key: 'traceId', name: t('Trace ID'), width: 110},
  {key: 'output', name: t('Last Output'), width: COL_WIDTH_UNDEFINED},
  {key: 'errors', name: t('Errors'), width: 100},
  {key: 'llmCalls', name: t('LLM Calls'), width: 110},
  {key: 'toolCalls', name: t('Tool Calls'), width: 110},
  {key: 'totalTokens', name: t('Total Tokens'), width: 120},
  {key: 'totalCost', name: t('Total Cost'), width: 120},
  {key: 'timestamp', name: t('Timestamp'), width: 100},
];

const rightAlignColumns = new Set([
  'errors',
  'llmCalls',
  'totalTokens',
  'toolCalls',
  'totalCost',
  'timestamp',
]);

const DEFAULT_LIMIT = 10;

interface TracesTableProps {
  dashboardFilters?: DashboardFilters;
  frameless?: boolean;
  limit?: number;
  linkToTraceView?: boolean;
  openTraceViewDrawer?: ReturnType<typeof useTraceViewDrawer>['openTraceViewDrawer'];
  tableWidths?: number[];
}

export function TracesTable({
  openTraceViewDrawer,
  frameless,
  dashboardFilters,
  limit = DEFAULT_LIMIT,
  tableWidths,
  linkToTraceView,
}: TracesTableProps) {
  const {columns: columnOrder, handleResizeColumn} = useStateBasedColumnResize({
    columns:
      // If table widths are provided, use them to override the default column widths
      tableWidths?.length === defaultColumnOrder.length
        ? defaultColumnOrder.map((column, index) => ({
            ...column,
            width: tableWidths[index],
          }))
        : defaultColumnOrder,
  });

  const combinedQuery =
    applyDashboardFilters(
      useCombinedQuery(getHasAiSpansFilter()),
      dashboardFilters,
      WidgetType.SPANS // This widget technically has its own widget type, but it uses the spans dataset
    ) ?? '';

  const {cursor, setCursor} = useTableCursor();

  const tracesRequest = useQuery({
    ...useTracesApiOptions({
      query: combinedQuery,
      sort: '-timestamp',
      cursor,
      limit,
    }),
    select: selectJsonWithHeaders,
    placeholderData: keepPreviousData,
  });

  const pageLinks = tracesRequest?.data?.headers.Link;
  const tracesData = tracesRequest.data?.json?.data;

  const spansRequest = useSpans(
    {
      // Exclude agent runs as they include aggregated data which would lead to double counting e.g. token usage
      search: `${getAgentRunsFilter({negated: true})} trace:[${tracesData?.map(span => span.trace).join(',')}]`,
      fields: [
        'trace',
        'count_if(gen_ai.operation.type,equals,ai_client)',
        'count_if(gen_ai.operation.type,equals,tool)',
        'sum(gen_ai.usage.total_tokens)',
        'sum(gen_ai.cost.total_tokens)',
      ],
      limit: tracesData?.length ?? 0,
      enabled: Boolean(tracesData && tracesData.length > 0),
      samplingMode: SAMPLING_MODE.HIGH_ACCURACY,
      extrapolationMode: 'none',
    },
    Referrer.TRACES_TABLE
  );

  const outputRequest = useSpans(
    {
      search: `gen_ai.operation.type:ai_client (has:gen_ai.output.messages OR has:gen_ai.response.text) trace:[${tracesData?.map(span => `"${span.trace}"`).join(',')}]`,
      fields: ['trace', 'gen_ai.output.messages', 'gen_ai.response.text', 'timestamp'],
      sorts: [{field: 'timestamp', kind: 'desc'}],
      limit: (tracesData?.length ?? 0) * 10,
      samplingMode: SAMPLING_MODE.HIGH_ACCURACY,
      enabled: Boolean(tracesData && tracesData.length > 0),
    },
    Referrer.TRACES_TABLE
  );

  const traceOutputs = useMemo<Map<string, string>>(() => {
    if (!outputRequest.data) {
      return new Map();
    }
    const map = new Map<string, string>();
    for (const span of outputRequest.data as Array<Record<string, unknown>>) {
      const traceId = String(span.trace);
      if (map.has(traceId)) {
        continue;
      }
      const output = extractOutputFromSpan(span);
      if (output) {
        map.set(traceId, output);
      }
    }
    return map;
  }, [outputRequest.data]);

  const traceErrorRequest = useSpans(
    {
      search: `span.status:internal_error trace:[${tracesData?.map(span => `"${span.trace}"`).join(',')}] has:gen_ai.operation.name`,
      fields: ['trace', 'count(span.duration)'],
      limit: tracesData?.length ?? 0,
      enabled: Boolean(tracesData && tracesData.length > 0),
      samplingMode: SAMPLING_MODE.HIGH_ACCURACY,
      extrapolationMode: 'none',
    },
    Referrer.TRACES_TABLE
  );

  const spanDataMap = useMemo(() => {
    if (!spansRequest.data || !traceErrorRequest.data) {
      return {};
    }
    const errors = traceErrorRequest.data?.reduce<Record<string, number>>((acc, span) => {
      acc[span.trace] = Number(span['count(span.duration)'] ?? 0);
      return acc;
    }, {});

    return spansRequest.data.reduce<
      Record<
        string,
        {
          llmCalls: number;
          toolCalls: number;
          totalCost: number;
          totalErrors: number;
          totalTokens: number;
        }
      >
    >((acc, span) => {
      acc[span.trace] = {
        llmCalls: Number(span['count_if(gen_ai.operation.type,equals,ai_client)'] ?? 0),
        toolCalls: Number(span['count_if(gen_ai.operation.type,equals,tool)'] ?? 0),
        totalTokens: Number(span['sum(gen_ai.usage.total_tokens)'] ?? 0),
        totalCost: Number(span['sum(gen_ai.cost.total_tokens)'] ?? 0),
        totalErrors: Number(errors[span.trace] ?? 0),
      };
      return acc;
    }, {});
  }, [spansRequest.data, traceErrorRequest.data]);

  const tableData = useMemo(() => {
    if (!tracesData) {
      return [];
    }

    return tracesData.map(span => ({
      traceId: span.trace,
      errors: spanDataMap[span.trace]?.totalErrors ?? 0,
      llmCalls: spanDataMap[span.trace]?.llmCalls ?? 0,
      toolCalls: spanDataMap[span.trace]?.toolCalls ?? 0,
      totalTokens: spanDataMap[span.trace]?.totalTokens ?? 0,
      totalCost: spanDataMap[span.trace]?.totalCost ?? null,
      timestamp: span.start,
      output: traceOutputs.get(span.trace) ?? null,
      isOutputLoading: outputRequest.isLoading,
      isSpanDataLoading: spansRequest.isLoading || traceErrorRequest.isLoading,
    }));
  }, [
    tracesData,
    spanDataMap,
    spansRequest.isLoading,
    traceErrorRequest.isLoading,
    traceOutputs,
    outputRequest.isLoading,
  ]);

  const renderHeadCell = useCallback((column: GridColumnHeader<string>) => {
    return (
      <HeadCell align={rightAlignColumns.has(column.key) ? 'right' : 'left'}>
        {column.name}
        {column.key === 'timestamp' && <IconArrow direction="down" size="xs" />}
        {column.key === 'output' && <CellExpander />}
      </HeadCell>
    );
  }, []);

  const renderBodyCell = useCallback(
    (column: GridColumnOrder<string>, dataRow: TableData) => {
      return (
        <BodyCell
          column={column}
          dataRow={dataRow}
          query={combinedQuery}
          openTraceViewDrawer={openTraceViewDrawer}
          linkToTraceView={linkToTraceView}
        />
      );
    },
    [combinedQuery, openTraceViewDrawer, linkToTraceView]
  );

  const additionalGridProps = frameless
    ? {
        bodyStyle: FRAMELESS_STYLES,
        resizable: true,
        scrollable: true,
        height: '100%',
      }
    : {};

  const tableComponent = (
    <GridEditable
      isLoading={tracesRequest.isPending}
      error={tracesRequest.error}
      data={tableData}
      stickyHeader
      columnOrder={columnOrder}
      columnSortBy={EMPTY_ARRAY}
      grid={{
        renderBodyCell,
        renderHeadCell,
        onResizeColumn: handleResizeColumn,
      }}
      {...additionalGridProps}
    />
  );

  if (frameless) {
    return <FramelessContainer>{tableComponent}</FramelessContainer>;
  }
  return (
    <Container>
      <GridEditableContainer>
        {tableComponent}
        {tracesRequest.isPlaceholderData && <LoadingOverlay />}
      </GridEditableContainer>
      <StyledPagination pageLinks={pageLinks} onCursor={setCursor} />
    </Container>
  );
}

const BodyCell = memo(function BodyCell({
  column,
  dataRow,
  query,
  openTraceViewDrawer,
  linkToTraceView,
}: {
  column: GridColumnHeader<string>;
  dataRow: TableData;
  query: string;
  linkToTraceView?: boolean;
  openTraceViewDrawer?: (traceSlug: string, spanId?: string, timestamp?: number) => void;
}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const location = useLocation();

  switch (column.key) {
    case 'traceId':
      if (linkToTraceView || !openTraceViewDrawer) {
        const traceUrl = getTraceDetailsUrl({
          organization,
          traceSlug: dataRow.traceId,
          dateSelection: normalizeDateTimeParams(selection.datetime),
          timestamp: dataRow.timestamp / 1000,
          location: {
            ...location,
            query: {},
          },
          source: TraceViewSources.AGENT_MONITORING,
          tab: TraceLayoutTabKeys.AI_SPANS,
        });
        return <Link to={traceUrl}>{dataRow.traceId.slice(0, 8)}</Link>;
      }
      return (
        <span>
          <TraceIdButton
            variant="link"
            onClick={() =>
              openTraceViewDrawer?.(dataRow.traceId, undefined, dataRow.timestamp / 1000)
            }
          >
            {dataRow.traceId.slice(0, 8)}
          </TraceIdButton>
        </span>
      );
    case 'output':
      if (dataRow.isOutputLoading) {
        return <Placeholder width="100%" height="16px" />;
      }
      if (!dataRow.output) {
        return <Text variant="muted">&mdash;</Text>;
      }
      return (
        <Tooltip
          title={<OutputTooltipContent text={dataRow.output} />}
          showOnlyOnOverflow
          maxWidth={800}
          isHoverable
          delay={500}
          skipWrapper
          position="right"
        >
          <OutputCellContent text={dataRow.output} />
        </Tooltip>
      );
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
      return <CurrencyCell value={dataRow.totalCost} />;
    case 'timestamp':
      return (
        <TextAlignRight>
          <TimeSince unitStyle="short" date={new Date(dataRow.timestamp)} />
        </TextAlignRight>
      );
    default:
      return null;
  }
});

const TOOLTIP_MAX_CHARS = 2048;
const CELL_MAX_CHARS = 256;

function OutputTooltipContent({text}: {text: string}) {
  return (
    <TooltipTextContainer>
      <AIContentRenderer text={ellipsize(text, TOOLTIP_MAX_CHARS)} inline />
    </TooltipTextContainer>
  );
}

function cleanMarkdownForCell(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '') // fenced code blocks
    .replace(/^#{1,6}\s+(.+)$/gm, '**$1**') // headings -> bold text
    .replace(/\s+/g, ' ')
    .trim();
}

function OutputCellContent({
  text,
  ...props
}: {text: string} & React.ComponentPropsWithRef<'div'>) {
  const cleanedText = cleanMarkdownForCell(text);
  return (
    <SingleLineMarkdown {...props}>
      <MarkedText text={ellipsize(cleanedText, CELL_MAX_CHARS)} />
    </SingleLineMarkdown>
  );
}

function extractOutputFromSpan(span: Record<string, unknown>): string | null {
  const outputMessages = span['gen_ai.output.messages'];
  if (typeof outputMessages === 'string') {
    const {responseText} = extractAssistantOutput(outputMessages, {
      defaultRole: 'assistant',
    });
    if (responseText) {
      return decodeUnicodeEscapes(responseText);
    }
  }

  const responseText = span['gen_ai.response.text'];
  return typeof responseText === 'string' ? decodeUnicodeEscapes(responseText) : null;
}

const FramelessContainer = styled('div')`
  height: 100%;

  tbody {
    align-content: start;
  }
`;

const GridEditableContainer = styled('div')`
  position: relative;
`;

const LoadingOverlay = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: ${p => p.theme.tokens.background.primary};
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
  padding: 0;
`;

const TooltipTextContainer = styled('div')`
  text-align: left;
  max-width: min(800px, 60vw);
  max-height: 50vh;
  overflow: hidden;

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-size: inherit;
    font-weight: bold;
    margin: 0;
  }
`;

const SingleLineMarkdown = styled('div')`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  * {
    display: inline;
  }
`;

const StyledPagination = styled(Pagination)`
  margin-top: 0;
`;
