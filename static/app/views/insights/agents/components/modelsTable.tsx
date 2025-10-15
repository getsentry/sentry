import {Fragment, memo, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import Count from 'sentry/components/count';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import useStateBasedColumnResize from 'sentry/components/tables/gridEditable/useStateBasedColumnResize';
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
import {ModelName} from 'sentry/views/insights/agents/components/modelName';
import {useCombinedQuery} from 'sentry/views/insights/agents/hooks/useCombinedQuery';
import {ErrorCell} from 'sentry/views/insights/agents/utils/cells';
import {formatLLMCosts} from 'sentry/views/insights/agents/utils/formatLLMCosts';
import {getAIGenerationsFilter} from 'sentry/views/insights/agents/utils/query';
import {Referrer} from 'sentry/views/insights/agents/utils/referrers';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {TextAlignRight} from 'sentry/views/insights/common/components/textAlign';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {DurationCell} from 'sentry/views/insights/pages/platform/shared/table/DurationCell';
import {NumberCell} from 'sentry/views/insights/pages/platform/shared/table/NumberCell';

interface TableData {
  avg: number;
  cost: number;
  errors: number;
  inputCachedTokens: number;
  inputTokens: number;
  model: string;
  outputReasoningTokens: number;
  outputTokens: number;
  p95: number;
  requests: number;
}

const EMPTY_ARRAY: never[] = [];

const defaultColumnOrder: Array<GridColumnOrder<string>> = [
  {key: 'model', name: t('Model'), width: COL_WIDTH_UNDEFINED},
  {key: 'count()', name: t('Requests'), width: 120},
  {key: 'count_if(span.status,equals,internal_error)', name: t('Errors'), width: 120},
  {key: 'avg(span.duration)', name: t('Avg'), width: 100},
  {key: 'p95(span.duration)', name: t('P95'), width: 100},
  {key: 'sum(gen_ai.usage.total_cost)', name: t('Cost'), width: 100},
  {
    key: 'sum(gen_ai.usage.input_tokens)',
    name: t('Input tokens (Cached)'),
    width: 180,
  },
  {
    key: 'sum(gen_ai.usage.output_tokens)',
    name: t('Output tokens (Reasoning)'),
    width: 180,
  },
];

const rightAlignColumns = new Set([
  'count()',
  'sum(gen_ai.usage.input_tokens)',
  'sum(gen_ai.usage.output_tokens)',
  'sum(gen_ai.usage.output_tokens.reasoning)',
  'sum(gen_ai.usage.input_tokens.cached)',
  'sum(gen_ai.usage.total_cost)',
  'count_if(span.status,equals,internal_error)',
  'avg(span.duration)',
  'p95(span.duration)',
]);

export function ModelsTable() {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  const {columns: columnOrder, handleResizeColumn} = useStateBasedColumnResize({
    columns: defaultColumnOrder,
  });

  const fullQuery = useCombinedQuery(getAIGenerationsFilter());

  const handleCursor: CursorHandler = (cursor, pathname, previousQuery) => {
    navigate(
      {
        pathname,
        query: {
          ...previousQuery,
          modelsCursor: cursor,
        },
      },
      {replace: true, preventScrollReset: true}
    );
  };

  const {sortField, sortOrder} = useTableSortParams();

  const cursor = decodeScalar(location.query?.modelsCursor);

  const modelsRequest = useSpans(
    {
      fields: [
        'gen_ai.request.model',
        'sum(gen_ai.usage.input_tokens)',
        'sum(gen_ai.usage.output_tokens)',
        'sum(gen_ai.usage.output_tokens.reasoning)',
        'sum(gen_ai.usage.input_tokens.cached)',
        'sum(gen_ai.usage.total_cost)',
        'count()',
        'avg(span.duration)',
        'p95(span.duration)',
        'count_if(span.status,equals,internal_error)',
      ],
      sorts: [{field: sortField, kind: sortOrder}],
      search: fullQuery,
      limit: 10,
      cursor,
      keepPreviousData: true,
    },
    Referrer.MODELS_TABLE
  );

  const tableData = useMemo(() => {
    if (!modelsRequest.data) {
      return [];
    }

    return modelsRequest.data.map(span => ({
      model: `${span['gen_ai.request.model']}`,
      requests: span['count()'] ?? 0,
      avg: span['avg(span.duration)'] ?? 0,
      p95: span['p95(span.duration)'] ?? 0,
      cost: span['sum(gen_ai.usage.total_cost)'],
      errors: span['count_if(span.status,equals,internal_error)'] ?? 0,
      inputTokens: Number(span['sum(gen_ai.usage.input_tokens)']),
      inputCachedTokens: Number(span['sum(gen_ai.usage.input_tokens.cached)']),
      outputTokens: Number(span['sum(gen_ai.usage.output_tokens)']),
      outputReasoningTokens: Number(span['sum(gen_ai.usage.output_tokens.reasoning)']),
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
      return <BodyCell column={column} dataRow={dataRow} query={fullQuery} />;
    },
    [fullQuery]
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
            onResizeColumn: handleResizeColumn,
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
    query: `gen_ai.request.model:${dataRow.model}`,
    field: [
      'gen_ai.request.model',
      'gen_ai.operation.name',
      'gen_ai.usage.input_tokens',
      'gen_ai.usage.output_tokens',
      'span.duration',
      'timestamp',
    ],
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
    case 'sum(gen_ai.usage.input_tokens)':
      return (
        <TokenTypeCell
          value={dataRow.inputTokens}
          secondaryValue={dataRow.inputCachedTokens}
        />
      );
    case 'sum(gen_ai.usage.output_tokens)':
      return (
        <TokenTypeCell
          value={dataRow.outputTokens}
          secondaryValue={dataRow.outputReasoningTokens}
        />
      );
    case 'avg(span.duration)':
      return <DurationCell milliseconds={dataRow.avg} />;
    case 'p95(span.duration)':
      return <DurationCell milliseconds={dataRow.p95} />;
    case 'sum(gen_ai.usage.total_cost)':
      return <TextAlignRight>{formatLLMCosts(dataRow.cost)}</TextAlignRight>;
    case 'count_if(span.status,equals,internal_error)':
      return (
        <ErrorCell
          value={dataRow.errors}
          target={getExploreUrl({
            query: `${query} span.status:internal_error gen_ai.request.model:"${dataRow.model}"`,
            organization,
            selection,
            referrer: Referrer.MODELS_TABLE,
          })}
        />
      );
    default:
      return null;
  }
});

function TokenTypeCell({value, secondaryValue}: {secondaryValue: number; value: number}) {
  return (
    <TokenTypeCountWrapper>
      <Count value={value} />
      <span>
        (<Count value={secondaryValue} />)
      </span>
    </TokenTypeCountWrapper>
  );
}

const TokenTypeCountWrapper = styled('span')`
  display: flex;
  gap: ${p => p.theme.space.xs};
  justify-content: flex-end;
`;

const ModelCell = styled(CellLink)`
  line-height: 1.1;
`;
