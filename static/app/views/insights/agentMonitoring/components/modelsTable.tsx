import {Fragment, memo, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/gridEditable';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import getDuration from 'sentry/utils/duration/getDuration';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
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
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';

interface TableData {
  avg: number;
  errorRate: number;
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
  {key: 'failure_rate()', name: t('Error Rate'), width: 120},
];

export function ModelsTable() {
  const navigate = useNavigate();
  const location = useLocation();
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
        'failure_rate()',
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
      errorRate: span['failure_rate()'],
      inputTokens: Number(span[AI_INPUT_TOKENS_ATTRIBUTE_SUM]),
      outputTokens: Number(span[AI_OUTPUT_TOKENS_ATTRIBUTE_SUM]),
    }));
  }, [modelsRequest.data]);

  const renderHeadCell = useCallback((column: GridColumnHeader<string>) => {
    return (
      <HeadSortCell
        sortKey={column.key}
        cursorParamName="modelsCursor"
        forceCellGrow={column.key === 'model'}
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

  const exploreUrl = getExploreUrl({
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
          <ModelName modelId={dataRow.model} provider={'openai'} />
        </ModelCell>
      );
    case 'count()':
      return dataRow.requests;
    case 'avg(span.duration)':
      return getDuration(dataRow.avg / 1000, 2, true);
    case 'p95(span.duration)':
      return getDuration(dataRow.p95 / 1000, 2, true);
    case 'failure_rate()':
      return formatPercentage(dataRow.errorRate ?? 0);
    case AI_INPUT_TOKENS_ATTRIBUTE_SUM:
      return formatAbbreviatedNumber(dataRow.inputTokens);
    case AI_OUTPUT_TOKENS_ATTRIBUTE_SUM:
      return formatAbbreviatedNumber(dataRow.outputTokens);
    default:
      return null;
  }
});

const ModelCell = styled(CellLink)`
  line-height: 1.1;
`;
