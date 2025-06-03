import {Fragment, memo, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {Tooltip} from 'sentry/components/core/tooltip';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import getDuration from 'sentry/utils/duration/getDuration';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {type QueryValue} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import CellAction, {Actions} from 'sentry/views/discover/table/cellAction';
import {PerformanceBadge} from 'sentry/views/insights/browser/webVitals/components/performanceBadge';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {Referrer} from 'sentry/views/insights/pages/platform/laravel/referrers';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/platform/laravel/utils';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

type SortableField =
  | 'transaction'
  | 'count()'
  | 'failure_rate()'
  | 'sum(span.duration)'
  | 'avg(span.duration)'
  | 'p95(span.duration)'
  | 'performance_score(measurements.score.total)';

interface TableData {
  avgDuration: number;
  errorRate: number;
  p95: number;
  page: string;
  pageViews: number;
  projectID: number;
  spanOp: string;
  totalTime: number;
  'performance_score(measurements.score.total)'?: number;
}

const errorRateColorThreshold = {
  error: 0.1,
  warning: 0.05,
} as const;

const getP95Threshold = (_avg: number) => {
  return {
    error: 4000,
    warning: 2500,
  };
};

const getCellColor = (value: number, thresholds: Record<string, number>) => {
  return Object.entries(thresholds).find(([_, threshold]) => value >= threshold)?.[0] as
    | 'errorText'
    | 'warningText'
    | undefined;
};

const getOrderBy = (field: string, order: 'asc' | 'desc') => {
  return order === 'asc' ? field : `-${field}`;
};

const pageloadColumnOrder: Array<GridColumnOrder<SortableField>> = [
  {key: 'transaction', name: t('Page'), width: COL_WIDTH_UNDEFINED},
  {key: 'count()', name: t('Pageloads'), width: 122},
  {key: 'failure_rate()', name: t('Error Rate'), width: 122},
  {
    key: 'performance_score(measurements.score.total)',
    name: t('Perf Score'),
    width: COL_WIDTH_UNDEFINED,
  },
];

const navigationColumnOrder: Array<GridColumnOrder<SortableField>> = [
  {key: 'transaction', name: t('Page'), width: COL_WIDTH_UNDEFINED},
  {key: 'count()', name: t('Navigations'), width: 132},
  {key: 'avg(span.duration)', name: t('Avg'), width: 90},
  {key: 'p95(span.duration)', name: t('P95'), width: 90},
  {key: 'sum(span.duration)', name: t('Time Spent'), width: 110},
];

const pageloadKeys: SortableField[] = pageloadColumnOrder.map(col => col.key);
const navigationKeys: SortableField[] = navigationColumnOrder.map(col => col.key);
const allSortableKeys = new Set<SortableField>([...pageloadKeys, ...navigationKeys]);

function isSortField(value: string): value is SortableField {
  return allSortableKeys.has(value as SortableField);
}

function decodeSortField(value: QueryValue): SortableField {
  if (typeof value === 'string' && isSortField(value)) {
    return value;
  }
  return 'count()';
}

function isSortOrder(value: string): value is 'asc' | 'desc' {
  return value === 'asc' || value === 'desc';
}

function decodeSortOrder(value: QueryValue): 'asc' | 'desc' {
  if (typeof value === 'string' && isSortOrder(value)) {
    return value;
  }
  return 'desc';
}

function useTableSortParams() {
  const {field: sortField, order: sortOrder} = useLocationQuery({
    fields: {
      field: decodeSortField,
      order: decodeSortOrder,
    },
  });
  return {sortField, sortOrder};
}

interface PagesTableProps {
  spanOperationFilter: 'pageload' | 'navigation';
}

const CURSOR_PARAM_NAMES: Record<PagesTableProps['spanOperationFilter'], string> = {
  pageload: 'pageloadCursor',
  navigation: 'navigationCursor',
};

export function PagesTable({spanOperationFilter}: PagesTableProps) {
  const location = useLocation();
  const {query, setTransactionFilter} = useTransactionNameQuery();
  const pageFilterChartParams = usePageFilterChartParams();
  const {sortField, sortOrder} = useTableSortParams();
  const currentCursorParamName = CURSOR_PARAM_NAMES[spanOperationFilter];
  const navigate = useNavigate();

  const [columnOrder, setColumnOrder] = useState(() => {
    if (spanOperationFilter === 'pageload') {
      return pageloadColumnOrder;
    }
    return navigationColumnOrder;
  });

  const handleCursor: CursorHandler = (cursor, pathname, transactionQuery) => {
    navigate(
      {
        pathname,
        search: qs.stringify({...transactionQuery, [currentCursorParamName]: cursor}),
      },
      {replace: true, preventScrollReset: true}
    );
  };

  const spansRequest = useEAPSpans(
    {
      ...pageFilterChartParams,
      sorts: [
        {
          field: sortField,
          kind: sortOrder,
        },
      ],
      fields: [
        'transaction',
        'span.op',
        'failure_rate()',
        'count()',
        'sum(span.duration)',
        'avg(span.duration)',
        'p95(span.duration)',
        'performance_score(measurements.score.total)',
        'project.id',
      ],
      limit: 10,
      search: `span.op:[${spanOperationFilter}] ${query ? `${query}` : ''}`.trim(),
      orderby: getOrderBy(sortField, sortOrder),
      cursor:
        typeof location.query[currentCursorParamName] === 'string'
          ? location.query[currentCursorParamName]
          : undefined,
      keepPreviousData: true,
    },
    Referrer.PAGES_TABLE
  );

  const tableData = useMemo<TableData[]>(() => {
    if (!spansRequest.data) {
      return [];
    }

    return spansRequest.data.map(span => ({
      page: span.transaction,
      pageViews: span['count()'],
      errorRate: span['failure_rate()'],
      totalTime: span['sum(span.duration)'],
      avgDuration: span['avg(span.duration)'],
      p95: span['p95(span.duration)'],
      spanOp: span['span.op'],
      projectID: span['project.id'],
      'performance_score(measurements.score.total)':
        span['performance_score(measurements.score.total)'],
    }));
  }, [spansRequest.data]);

  const handleResizeColumn = useCallback(
    (columnIndex: number, nextColumn: GridColumnHeader<string>) => {
      setColumnOrder(prev => {
        const newColumnOrder = [...prev];
        newColumnOrder[columnIndex] = {
          ...newColumnOrder[columnIndex]!,
          width: nextColumn.width,
        };
        return newColumnOrder;
      });
    },
    []
  );

  const renderHeadCell = useCallback(
    (column: GridColumnHeader<SortableField>) => {
      return <HeadCell column={column} currentCursorParamName={currentCursorParamName} />;
    },
    [currentCursorParamName]
  );

  const renderBodyCell = useCallback(
    (column: GridColumnHeader<SortableField>, dataRow: TableData) => {
      if (column.key === 'performance_score(measurements.score.total)') {
        const score = dataRow['performance_score(measurements.score.total)'];
        if (typeof score !== 'number') {
          return <AlignRight>{' — '}</AlignRight>;
        }
        return (
          <AlignCenter>
            <PerformanceBadge score={Math.round(score * 100)} />
          </AlignCenter>
        );
      }

      return (
        <BodyCell
          column={column}
          dataRow={dataRow}
          handleAddTransactionFilter={setTransactionFilter}
        />
      );
    },
    [setTransactionFilter]
  );

  const pagesTablePageLinks = spansRequest.pageLinks;

  return (
    <Fragment>
      <GridEditableContainer>
        <GridEditable<TableData, SortableField>
          isLoading={spansRequest.isPending}
          error={spansRequest.error}
          data={tableData}
          columnOrder={columnOrder}
          columnSortBy={[{key: sortField, order: sortOrder}]}
          stickyHeader
          grid={{
            renderHeadCell,
            renderBodyCell,
            onResizeColumn: handleResizeColumn,
          }}
        />
        {spansRequest.isPlaceholderData && <LoadingOverlay />}
      </GridEditableContainer>
      <Pagination pageLinks={pagesTablePageLinks} onCursor={handleCursor} />
    </Fragment>
  );
}

const HeadCell = memo(function PagesTableHeadCell({
  column,
  currentCursorParamName,
}: {
  column: GridColumnHeader<SortableField>;
  currentCursorParamName: string;
}) {
  const location = useLocation();
  const {sortField, sortOrder} = useTableSortParams();

  return (
    <div style={{display: 'flex', alignItems: 'center'}}>
      <SortLink
        align="left"
        title={
          <Fragment>
            {column.key === 'transaction' && <CellExpander />}
            {column.name}
          </Fragment>
        }
        direction={sortField === column.key ? sortOrder : undefined}
        canSort
        preventScrollReset
        generateSortLink={() => {
          const newQuery = {
            ...location.query,
            [currentCursorParamName]: undefined,
            field: column.key,
            order:
              sortField === column.key ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'desc',
          };
          return {
            pathname: location.pathname,
            query: newQuery,
          };
        }}
      />
    </div>
  );
});

const BodyCell = memo(function PagesBodyCell({
  column,
  dataRow,
  handleAddTransactionFilter,
}: {
  column: GridColumnHeader<SortableField>;
  dataRow: TableData;
  handleAddTransactionFilter: (value: string) => void;
}) {
  const organization = useOrganization();

  switch (column.key) {
    case 'transaction': {
      const target = transactionSummaryRouteWithQuery({
        organization,
        transaction: dataRow.page,
        view: 'frontend',
        projectID: dataRow.projectID.toString(),
        query: {},
      });

      return (
        <CellAction
          column={{
            ...column,
            isSortable: false,
            type: 'string',
            column: {kind: 'field', field: 'transaction'},
          }}
          dataRow={dataRow as any}
          allowActions={[Actions.ADD]}
          handleCellAction={() => {
            handleAddTransactionFilter(dataRow.page);
          }}
        >
          <CellLink to={target}>
            <Tooltip title={dataRow.page} showUnderline skipWrapper>
              {dataRow.page}
            </Tooltip>
          </CellLink>
        </CellAction>
      );
    }
    case 'count()':
      return <Count>{formatAbbreviatedNumber(dataRow.pageViews)}</Count>;
    case 'failure_rate()': {
      const thresholds = errorRateColorThreshold;
      const color = getCellColor(dataRow.errorRate, thresholds);
      return (
        <ColoredValue color={color}>
          {formatPercentage(dataRow.errorRate ?? 0)}
        </ColoredValue>
      );
    }
    case 'sum(span.duration)':
      return <Duration>{getDuration(dataRow.totalTime / 1000, 2, true)}</Duration>;
    case 'avg(span.duration)': {
      return <Duration>{getDuration(dataRow.avgDuration / 1000, 2, true)}</Duration>;
    }
    case 'p95(span.duration)': {
      const thresholds = getP95Threshold(dataRow.avgDuration);
      const color = getCellColor(dataRow.p95, thresholds);
      return (
        <ColoredValue color={color}>
          {getDuration(dataRow.p95 / 1000, 2, true)}
        </ColoredValue>
      );
    }
    default:
      return <div />;
  }
});

const GridEditableContainer = styled('div')`
  position: relative;
  margin-bottom: ${space(1)};
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

const CellLink = styled(Link)`
  ${p => p.theme.overflowEllipsis}
`;

const Count = styled('div')`
  text-align: right;
`;

const Duration = styled('div')`
  text-align: right;
`;

const ColoredValue = styled('span')<{
  color?: 'errorText' | 'warningText';
}>`
  color: ${p => (p.color ? p.theme[p.color] : 'inherit')};
  text-align: right;
  display: block;
`;
const CellExpander = styled('div')`
  width: 100vw;
`;

const AlignRight = styled('div')`
  text-align: right;
`;

const AlignCenter = styled('div')`
  text-align: center;
`;
