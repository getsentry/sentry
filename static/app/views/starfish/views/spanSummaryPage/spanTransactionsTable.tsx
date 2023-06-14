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
import {useLocation} from 'sentry/utils/useLocation';
import DurationCell from 'sentry/views/starfish/components/tableCells/durationCell';
import ThroughputCell from 'sentry/views/starfish/components/tableCells/throughputCell';
import {TimeSpentCell} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import type {IndexedSpan} from 'sentry/views/starfish/queries/types';
import {
  SpanTransactionMetrics,
  useSpanTransactionMetrics,
} from 'sentry/views/starfish/queries/useSpanTransactionMetrics';
import {getModuleFromLocation} from 'sentry/views/starfish/utils/getModuleFromLocation';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

type Row = {
  metrics: SpanTransactionMetrics;
  transaction: string;
};

type Props = {
  span: Pick<IndexedSpan, 'group'>;
  endpoint?: string;
  method?: string;
  onClickTransaction?: (row: Row) => void;
  openSidebar?: boolean;
};

export type Keys =
  | 'transaction'
  | 'p95(transaction.duration)'
  | 'time_spent_percentage(local)'
  | 'sps()';
export type TableColumnHeader = GridColumnHeader<Keys>;

export function SpanTransactionsTable({
  span,
  openSidebar,
  onClickTransaction,
  endpoint,
  method,
}: Props) {
  const location = useLocation();

  const {
    data: spanTransactionMetrics,
    isLoading,
    pageLinks,
  } = useSpanTransactionMetrics(span, endpoint ? [endpoint] : undefined);

  const spanTransactionsWithMetrics = spanTransactionMetrics.map(row => {
    return {
      transaction: row.transaction,
      metrics: row,
    };
  });

  const renderHeadCell = (column: TableColumnHeader) => {
    return <span>{column.name}</span>;
  };

  const renderBodyCell = (column: TableColumnHeader, row: Row) => {
    return (
      <BodyCell
        span={span}
        column={column}
        row={row}
        openSidebar={openSidebar}
        onClickTransactionName={onClickTransaction}
        endpoint={endpoint}
        method={method}
        location={location}
      />
    );
  };

  return (
    <Fragment>
      <GridEditable
        isLoading={isLoading}
        data={spanTransactionsWithMetrics}
        columnOrder={COLUMN_ORDER}
        columnSortBy={[]}
        grid={{
          renderHeadCell,
          renderBodyCell,
        }}
        location={location}
      />
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
  method?: string;
  onClickTransactionName?: (row: Row) => void;
  openSidebar?: boolean;
};

function BodyCell({
  span,
  column,
  row,
  openSidebar,
  onClickTransactionName,
  endpoint,
  method,
  location,
}: CellProps) {
  if (column.key === 'transaction') {
    return (
      <TransactionCell
        endpoint={endpoint}
        method={method}
        span={span}
        row={row}
        column={column}
        openSidebar={openSidebar}
        onClickTransactionName={onClickTransactionName}
        location={location}
      />
    );
  }

  if (column.key === 'p95(transaction.duration)') {
    return (
      <DurationCell
        milliseconds={row.metrics?.['p95(span.duration)']}
        delta={row.metrics?.['percentile_percent_change(span.duration, 0.95)']}
      />
    );
  }

  if (column.key === 'sps()') {
    return (
      <ThroughputCell
        throughputPerSecond={row.metrics?.['sps()']}
        delta={row.metrics?.['sps_percent_change()']}
      />
    );
  }

  if (column.key === 'time_spent_percentage(local)') {
    return (
      <TimeSpentCell
        timeSpentPercentage={row.metrics?.['time_spent_percentage(local)']}
        totalSpanTime={row.metrics?.['sum(span.duration)']}
      />
    );
  }

  return <span>{row[column.key]}</span>;
}

function TransactionCell({span, column, row, endpoint, method, location}: CellProps) {
  return (
    <Fragment>
      <Link
        to={`/starfish/${getModuleFromLocation(location)}/span/${encodeURIComponent(
          span.group
        )}?${qs.stringify({
          endpoint,
          method,
          transaction: row.transaction,
        })}`}
      >
        <Truncate value={row[column.key]} maxLength={75} />
      </Link>
    </Fragment>
  );
}

const COLUMN_ORDER: TableColumnHeader[] = [
  {
    key: 'transaction',
    name: 'Found In Endpoints',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'sps()',
    name: DataTitles.throughput,
    width: 175,
  },
  {
    key: 'p95(transaction.duration)',
    name: DataTitles.p95,
    width: 175,
  },
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
