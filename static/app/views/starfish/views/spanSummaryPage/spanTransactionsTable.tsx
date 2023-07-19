import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import omit from 'lodash/omit';
import * as qs from 'query-string';

import {Button} from 'sentry/components/button';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import Truncate from 'sentry/components/truncate';
import {t} from 'sentry/locale';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {Sort} from 'sentry/utils/discover/fields';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  renderHeadCell,
  SORTABLE_FIELDS,
} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import type {IndexedSpan} from 'sentry/views/starfish/queries/types';
import {
  SpanTransactionMetrics,
  useSpanTransactionMetrics,
} from 'sentry/views/starfish/queries/useSpanTransactionMetrics';
import {SpanMetricsFields} from 'sentry/views/starfish/types';
import {extractRoute} from 'sentry/views/starfish/utils/extractRoute';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

type Row = {
  metrics: SpanTransactionMetrics;
  transaction: string;
  transactionMethod: string;
};

type Props = {
  sort: ValidSort;
  span: Pick<IndexedSpan, 'group' | 'span.op'>;
  endpoint?: string;
  endpointMethod?: string;
  onClickTransaction?: (row: Row) => void;
  openSidebar?: boolean;
};

type ValidSort = Sort & {
  field: keyof Row;
};

export type TableColumnHeader = GridColumnHeader<keyof Row['metrics']>;

export function SpanTransactionsTable({
  span,
  openSidebar,
  onClickTransaction,
  endpoint,
  endpointMethod,
  sort,
}: Props) {
  const location = useLocation();
  const organization = useOrganization();

  const {
    data: spanTransactionMetrics = [],
    meta,
    isLoading,
    pageLinks,
  } = useSpanTransactionMetrics(span, {
    transactions: endpoint ? [endpoint] : undefined,
    sorts: [sort],
  });

  const spanTransactionsWithMetrics = spanTransactionMetrics.map(row => {
    return {
      transaction: row.transaction,
      transactionMethod: row['transaction.method'],
      metrics: row,
    };
  });

  const renderBodyCell = (column: TableColumnHeader, row: Row) => {
    if (column.key === 'transaction') {
      return (
        <TransactionCell
          endpoint={endpoint}
          endpointMethod={endpointMethod}
          span={span}
          row={row}
          column={column}
          openSidebar={openSidebar}
          onClickTransactionName={onClickTransaction}
          location={location}
        />
      );
    }

    if (!meta || !meta?.fields) {
      return row[column.key];
    }

    const renderer = getFieldRenderer(column.key, meta.fields, false);
    const rendered = renderer(row.metrics, {
      location,
      organization,
      unit: meta.units?.[column.key],
    });

    return rendered;
  };

  return (
    <Fragment>
      <VisuallyCompleteWithData
        id="SpanSummary.SpanTransactionsTable"
        hasData={spanTransactionMetrics.length > 0}
      >
        <GridEditable
          isLoading={isLoading}
          data={spanTransactionsWithMetrics}
          columnOrder={getColumnOrder(span)}
          columnSortBy={[]}
          grid={{
            renderHeadCell: col => renderHeadCell({column: col, sort, location}),
            renderBodyCell,
          }}
          location={location}
        />
      </VisuallyCompleteWithData>
      <Footer>
        {endpoint && (
          <Button
            to={{
              pathname: location.pathname,
              query: omit(location.query, 'endpoint'),
            }}
          >
            {t('View More Endpoints')}
          </Button>
        )}
        <StyledPagination pageLinks={pageLinks} />
      </Footer>
    </Fragment>
  );
}

type CellProps = {
  column: TableColumnHeader;
  location: Location;
  row: Row;
  span: Pick<IndexedSpan, 'group'>;
  endpoint?: string;
  endpointMethod?: string;
  onClickTransactionName?: (row: Row) => void;
  openSidebar?: boolean;
};

function TransactionCell({span, row, endpoint, endpointMethod, location}: CellProps) {
  const label = row.transactionMethod
    ? `${row.transactionMethod} ${row.transaction}`
    : row.transaction;
  return (
    <Fragment>
      <Link
        to={`/starfish/${extractRoute(location) ?? 'spans'}/span/${encodeURIComponent(
          span.group
        )}?${qs.stringify({
          ...location.query,
          endpoint,
          endpointMethod,
          transaction: row.transaction,
          transactionMethod: row.transactionMethod,
        })}`}
      >
        <Truncate value={label} maxLength={75} />
      </Link>
    </Fragment>
  );
}

const getColumnOrder = (
  span: Pick<IndexedSpan, 'group' | 'span.op'>
): TableColumnHeader[] => [
  {
    key: 'transaction',
    name: 'Found In Endpoints',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'sps()',
    name: DataTitles.throughput,
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: `p95(${SpanMetricsFields.SPAN_SELF_TIME})`,
    name: DataTitles.p95,
    width: COL_WIDTH_UNDEFINED,
  },
  ...(span?.['span.op']?.startsWith('http')
    ? ([
        {
          key: `http_error_count()`,
          name: DataTitles.errorCount,
          width: COL_WIDTH_UNDEFINED,
        },
      ] as TableColumnHeader[])
    : []),
  {
    key: 'time_spent_percentage(local)',
    name: DataTitles.timeSpent,
    width: COL_WIDTH_UNDEFINED,
  },
];

const Footer = styled('div')`
  display: flex;
  justify-content: space-between;
`;

const StyledPagination = styled(Pagination)`
  margin-top: 0;
  margin-left: auto;
`;

export function isAValidSort(sort: Sort): sort is ValidSort {
  return SORTABLE_FIELDS.has(sort.field);
}
