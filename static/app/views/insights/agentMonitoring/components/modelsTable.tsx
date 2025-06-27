import {Fragment, memo, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
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
} from 'sentry/views/insights/agentMonitoring/components/common';
import {
  HeadSortCell,
  useTableSortParams,
} from 'sentry/views/insights/agentMonitoring/components/headSortCell';
import {ModelName} from 'sentry/views/insights/agentMonitoring/components/modelName';
import {useColumnOrder} from 'sentry/views/insights/agentMonitoring/hooks/useColumnOrder';
import {
  AI_INPUT_TOKENS_ATTRIBUTE_SUM,
  AI_MODEL_ID_ATTRIBUTE,
  AI_OUTPUT_TOKENS_ATTRIBUTE_SUM,
  getAIGenerationsFilter,
} from 'sentry/views/insights/agentMonitoring/utils/query';
import {Referrer} from 'sentry/views/insights/agentMonitoring/utils/referrers';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {DurationCell} from 'sentry/views/insights/pages/platform/shared/table/DurationCell';
// import {ErrorRateCell} from 'sentry/views/insights/pages/platform/shared/table/ErrorRateCell';
import {NumberCell} from 'sentry/views/insights/pages/platform/shared/table/NumberCell';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';

interface TableData {
  avg: number;
  // errorRate: number;
  inputTokens: number;
  model: string;
  outputTokens: number;
  p95: number;
  requests: number;
}

const EMPTY_ARRAY: never[] = [];

const defaultColumnOrder: Array<GridColumnOrder<string>> = [
  {key: 'model', name: t('Model'), width: COL_WIDTH_UNDEFINED},
  {key: 'count()', name: t('Requests'), width: 120},
  {key: 'avg(span.duration)', name: t('Avg'), width: 100},
  {key: 'p95(span.duration)', name: t('P95'), width: 100},
  {key: AI_INPUT_TOKENS_ATTRIBUTE_SUM, name: t('Input tokens'), width: 140},
  {key: AI_OUTPUT_TOKENS_ATTRIBUTE_SUM, name: t('Output tokens'), width: 140},
  // {key: 'failure_rate()', name: t('Error Rate'), width: 120},
];

const rightAlignColumns = new Set([
  'count()',
  AI_INPUT_TOKENS_ATTRIBUTE_SUM,
  AI_OUTPUT_TOKENS_ATTRIBUTE_SUM,
  // 'failure_rate()',
  'avg(span.duration)',
  'p95(span.duration)',
]);

export function ModelsTable() {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  const {columnOrder, onResizeColumn} = useColumnOrder(defaultColumnOrder);
  const {query} = useTransactionNameQuery();

  const fullQuery = `${getAIGenerationsFilter()} ${query}`.trim();

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

  const modelsRequest = useEAPSpans(
    {
      fields: [
        AI_MODEL_ID_ATTRIBUTE,
        AI_INPUT_TOKENS_ATTRIBUTE_SUM,
        AI_OUTPUT_TOKENS_ATTRIBUTE_SUM,
        'count()',
        'avg(span.duration)',
        'p95(span.duration)',
        // 'failure_rate()',
      ],
      sorts: [{field: sortField, kind: sortOrder}],
      search: fullQuery,
      limit: 10,
      cursor:
        typeof location.query.modelsCursor === 'string'
          ? location.query.modelsCursor
          : undefined,
      keepPreviousData: true,
    },
    Referrer.MODELS_TABLE
  );

  const tableData = useMemo(() => {
    if (!modelsRequest.data) {
      return [];
    }

    return modelsRequest.data.map(span => ({
      model: `${span[AI_MODEL_ID_ATTRIBUTE]}`,
      requests: span['count()'],
      avg: span['avg(span.duration)'],
      p95: span['p95(span.duration)'],
      // errorRate: span['failure_rate()'],
      inputTokens: Number(span[AI_INPUT_TOKENS_ATTRIBUTE_SUM]),
      outputTokens: Number(span[AI_OUTPUT_TOKENS_ATTRIBUTE_SUM]),
    }));
  }, [modelsRequest.data]);

  const handleSort = useCallback(
    (column: string, direction: 'asc' | 'desc') => {
      trackAnalytics('agent-monitoring.column-sort', {
        organization,
        table: 'models',
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
          cursorParamName="modelsCursor"
          forceCellGrow={column.key === 'model'}
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
      return <BodyCell column={column} dataRow={dataRow} />;
    },
    []
  );

  return (
    <Fragment>
      <GridEditableContainer>
        <GridEditable
          isLoading={modelsRequest.isPending}
          error={modelsRequest.error}
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
        {modelsRequest.isPlaceholderData && <LoadingOverlay />}
      </GridEditableContainer>
      <Pagination pageLinks={modelsRequest.pageLinks} onCursor={handleCursor} />
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
    ],
    query: `${AI_MODEL_ID_ATTRIBUTE}:${dataRow.model}`,
  });

  switch (column.key) {
    case 'model':
      return (
        <ModelCell to={exploreUrl}>
          <ModelName modelId={dataRow.model} size={18} />
        </ModelCell>
      );
    case 'count()':
      return <NumberCell value={dataRow.requests} />;
    case AI_INPUT_TOKENS_ATTRIBUTE_SUM:
      return <NumberCell value={dataRow.inputTokens} />;
    case AI_OUTPUT_TOKENS_ATTRIBUTE_SUM:
      return <NumberCell value={dataRow.outputTokens} />;
    case 'avg(span.duration)':
      return <DurationCell milliseconds={dataRow.avg} />;
    case 'p95(span.duration)':
      return <DurationCell milliseconds={dataRow.p95} />;
    // case 'failure_rate()':
    //   return <ErrorRateCell errorRate={dataRow.errorRate} total={dataRow.requests} />;
    default:
      return null;
  }
});

const ModelCell = styled(CellLink)`
  line-height: 1.1;
`;
