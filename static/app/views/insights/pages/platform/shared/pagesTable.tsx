import {Fragment, memo, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

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
import {browserHistory} from 'sentry/utils/browserHistory';
import getDuration from 'sentry/utils/duration/getDuration';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {QueryValue} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import CellAction, {Actions} from 'sentry/views/discover/table/cellAction';
import {Referrer} from 'sentry/views/insights/pages/platform/laravel/referrers';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/platform/laravel/utils';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

interface SpansQueryResponse {
  data: Array<{
    'avg(span.duration)': number;
    'count(span.duration)': number;
    'failure_rate()': number;
    'span.op': string;
    'sum(span.duration)': number;
    transaction: string;
  }>;
  link?: string;
}

type SortableField =
  | 'transaction'
  | 'count(span.duration)'
  | 'failure_rate()'
  | 'sum(span.duration)'
  | 'avg(span.duration)';

interface TableData {
  avgDuration: number;
  errorRate: number;
  page: string;
  pageViews: number;
  spanOp: string;
  totalTime: number;
}

const errorRateColorThreshold = {
  error: 0.1,
  warning: 0.05,
} as const;

const getCellColor = (value: number, thresholds: Record<string, number>) => {
  return Object.entries(thresholds).find(([_, threshold]) => value >= threshold)?.[0] as
    | 'errorText'
    | 'warningText'
    | undefined;
};

const getOrderBy = (field: string, order: 'asc' | 'desc') => {
  return order === 'asc' ? field : `-${field}`;
};

const PER_PAGE = 10;

const defaultColumnOrder: Array<GridColumnOrder<SortableField>> = [
  {key: 'transaction', name: t('Page'), width: COL_WIDTH_UNDEFINED},
  {key: 'count(span.duration)', name: t('Page Views'), width: 122},
  {key: 'failure_rate()', name: t('Error Rate'), width: 122},
  {key: 'sum(span.duration)', name: t('Total'), width: 110},
];

function isSortField(value: string): value is SortableField {
  return defaultColumnOrder.some(column => column.key === value);
}

function decodeSortField(value: QueryValue): SortableField {
  if (typeof value === 'string' && isSortField(value)) {
    return value;
  }
  return 'count(span.duration)';
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
  handleAddTransactionFilter: (value: string) => void;
  spanOperationFilter: 'pageload' | 'navigation';
  query?: string;
}

const CURSOR_PARAM_NAMES: Record<PagesTableProps['spanOperationFilter'], string> = {
  pageload: 'pageloadCursor',
  navigation: 'navigationCursor',
};

export function PagesTable({
  spanOperationFilter,
  query,
  handleAddTransactionFilter,
}: PagesTableProps) {
  const organization = useOrganization();
  const location = useLocation();
  const pageFilterChartParams = usePageFilterChartParams();
  const {sortField, sortOrder} = useTableSortParams();
  const currentCursorParamName = CURSOR_PARAM_NAMES[spanOperationFilter];

  const handleCursor: CursorHandler = (cursor, pathname, transactionQuery) => {
    browserHistory.push({
      pathname,
      query: {...transactionQuery, [currentCursorParamName]: cursor},
    });
  };

  const spansRequest = useApiQuery<SpansQueryResponse>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'spans',
          field: [
            'transaction',
            'span.op',
            'failure_rate()',
            'count(span.duration)',
            'sum(span.duration)',
            'avg(span.duration)',
          ],
          query: `span.op:[${spanOperationFilter}] ${query ? `${query}` : ''}`.trim(),
          referrer: Referrer.PAGES_TABLE,
          orderby: getOrderBy(sortField, sortOrder),
          useRpc: 1,
          per_page: PER_PAGE,
          cursor: location.query[currentCursorParamName],
          sampling: 'BEST_EFFORT',
        },
      },
    ],
    {staleTime: 0}
  );

  const tableData = useMemo<TableData[]>(() => {
    if (!spansRequest.data?.data) {
      return [];
    }

    return spansRequest.data.data.map(span => ({
      page: span.transaction,
      pageViews: span['count(span.duration)'],
      errorRate: span['failure_rate()'],
      totalTime: span['sum(span.duration)'],
      avgDuration: span['avg(span.duration)'],
      spanOp: span['span.op'],
    }));
  }, [spansRequest.data]);

  const renderHeadCell = useCallback((column: GridColumnHeader<SortableField>) => {
    return <HeadCell column={column} />;
  }, []);

  const renderBodyCell = useCallback(
    (column: GridColumnHeader<SortableField>, dataRow: TableData) => {
      return (
        <BodyCell
          column={column}
          dataRow={dataRow}
          handleAddTransactionFilter={handleAddTransactionFilter}
        />
      );
    },
    [handleAddTransactionFilter]
  );

  const pagesTablePageLinks = spansRequest.getResponseHeader?.('Link');

  return (
    <Fragment>
      <GridEditableContainer>
        <GridEditable<TableData, SortableField>
          isLoading={spansRequest.isLoading}
          error={spansRequest.error}
          data={tableData}
          columnOrder={defaultColumnOrder}
          columnSortBy={[]}
          stickyHeader
          grid={{
            renderHeadCell: renderHeadCell as any,
            renderBodyCell: renderBodyCell as any,
          }}
        />
      </GridEditableContainer>
      <Pagination pageLinks={pagesTablePageLinks} onCursor={handleCursor} />
    </Fragment>
  );
}

const HeadCell = memo(function PagesTableHeadCell({
  column,
}: {
  column: GridColumnHeader<SortableField>;
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
        generateSortLink={() => {
          const newQuery = {
            ...location.query,
            pagesCursor: undefined,
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
  const location = useLocation();

  switch (column.key) {
    case 'transaction': {
      const target = transactionSummaryRouteWithQuery({
        organization,
        transaction: dataRow.page,
        query: {
          ...location.query,
        },
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
          handleCellAction={(_action, value) => {
            handleAddTransactionFilter(value as string);
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
    case 'count(span.duration)':
      return <Count>{formatAbbreviatedNumber(dataRow.pageViews)}</Count>;
    case 'failure_rate()': {
      const thresholds = errorRateColorThreshold;
      const color = getCellColor(dataRow.errorRate, thresholds);
      return (
        <ColoredValue color={color}>{formatPercentage(dataRow.errorRate)}</ColoredValue>
      );
    }
    case 'sum(span.duration)':
      return <Duration>{getDuration(dataRow.totalTime / 1000, 2, true)}</Duration>;
    default:
      return <div />;
  }
});

const GridEditableContainer = styled('div')`
  margin-bottom: ${space(1)};
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
