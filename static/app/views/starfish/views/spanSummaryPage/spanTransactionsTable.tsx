import {Fragment} from 'react';
import * as qs from 'query-string';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import Truncate from 'sentry/components/truncate';
import {Series} from 'sentry/types/echarts';
import {formatPercentage} from 'sentry/utils/formatters';
import {useLocation} from 'sentry/utils/useLocation';
import DurationCell from 'sentry/views/starfish/components/tableCells/durationCell';
import ThroughputCell from 'sentry/views/starfish/components/tableCells/throughputCell';
import {TimeSpentCell} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import type {Span} from 'sentry/views/starfish/queries/types';
import {useApplicationMetrics} from 'sentry/views/starfish/queries/useApplicationMetrics';
import {
  SpanTransactionMetrics,
  useSpanTransactionMetrics,
} from 'sentry/views/starfish/queries/useSpanTransactionMetrics';
import {useSpanTransactionMetricSeries} from 'sentry/views/starfish/queries/useSpanTransactionMetricSeries';
import {useSpanTransactions} from 'sentry/views/starfish/queries/useSpanTransactions';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

type Row = {
  count: number;
  metricSeries: Record<string, Series>;
  metrics: SpanTransactionMetrics;
  transaction: string;
};

type Props = {
  span: Span;
  onClickTransaction?: (row: Row) => void;
  openSidebar?: boolean;
};

export type Keys =
  | 'transaction'
  | 'p95(transaction.duration)'
  | 'timeSpent'
  | 'spans_per_second';
export type TableColumnHeader = GridColumnHeader<Keys>;

export function SpanTransactionsTable({span, openSidebar, onClickTransaction}: Props) {
  const location = useLocation();
  const {data: applicationMetrics} = useApplicationMetrics();

  const {data: spanTransactions, isLoading} = useSpanTransactions(span);
  const {data: spanTransactionMetrics} = useSpanTransactionMetrics(
    span,
    spanTransactions.map(row => row.transaction)
  );
  const {data: spanTransactionMetricsSeries} = useSpanTransactionMetricSeries(
    span,
    spanTransactions.map(row => row.transaction)
  );

  const spanTransactionsWithMetrics = spanTransactions.map(row => {
    return {
      ...row,
      timeSpent: formatPercentage(
        spanTransactionMetrics[row.transaction]?.['sum(span.self_time)'] /
          applicationMetrics['sum(span.duration)']
      ),
      metrics: spanTransactionMetrics[row.transaction],
      metricSeries: spanTransactionMetricsSeries[row.transaction],
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
      />
    );
  };

  return (
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
  );
}

type CellProps = {
  column: TableColumnHeader;
  row: Row;
  span: Span;
  onClickTransactionName?: (row: Row) => void;
  openSidebar?: boolean;
};

function BodyCell({span, column, row, openSidebar, onClickTransactionName}: CellProps) {
  if (column.key === 'transaction') {
    return (
      <TransactionCell
        span={span}
        row={row}
        column={column}
        openSidebar={openSidebar}
        onClickTransactionName={onClickTransactionName}
      />
    );
  }

  if (column.key === 'p95(transaction.duration)') {
    return <DurationCell seconds={row.metrics?.p95} />;
  }

  if (column.key === 'spans_per_second') {
    return <ThroughputCell throughputPerSecond={row.metrics?.spans_per_second} />;
  }

  if (column.key === 'timeSpent') {
    return (
      <TimeSpentCell
        formattedTimeSpent={row[column.key]}
        totalSpanTime={row.metrics?.total_time}
      />
    );
  }

  return <span>{row[column.key]}</span>;
}

function TransactionCell({span, column, row}: CellProps) {
  return (
    <Fragment>
      <Link
        to={`/starfish/span/${encodeURIComponent(span.group_id)}?${qs.stringify({
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
    name: 'In Endpoint',
    width: 500,
  },
  {
    key: 'spans_per_second',
    name: DataTitles.throughput,
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'p95(transaction.duration)',
    name: DataTitles.p95,
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'timeSpent',
    name: DataTitles.timeSpent,
    width: COL_WIDTH_UNDEFINED,
  },
];
