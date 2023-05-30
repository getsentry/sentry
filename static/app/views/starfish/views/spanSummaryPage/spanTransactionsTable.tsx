import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import * as qs from 'query-string';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader as Column,
} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import Truncate from 'sentry/components/truncate';
import {Series} from 'sentry/types/echarts';
import {formatPercentage} from 'sentry/utils/formatters';
import {useLocation} from 'sentry/utils/useLocation';
import {DURATION_COLOR, THROUGHPUT_COLOR} from 'sentry/views/starfish/colours';
import Sparkline, {
  generateHorizontalLine,
} from 'sentry/views/starfish/components/sparkline';
import type {Span} from 'sentry/views/starfish/queries/types';
import {useApplicationMetrics} from 'sentry/views/starfish/queries/useApplicationMetrics';
import {useSpanTransactionMetrics} from 'sentry/views/starfish/queries/useSpanTransactionMetrics';
import {useSpanTransactionMetricSeries} from 'sentry/views/starfish/queries/useSpanTransactionMetricSeries';
import {useSpanTransactions} from 'sentry/views/starfish/queries/useSpanTransactions';

type Metric = {
  p50: number;
  spm: number;
};

type Row = {
  count: number;
  metricSeries: Record<string, Series>;
  metrics: Metric;
  transaction: string;
};

type Props = {
  span: Span;
  onClickTransaction?: (row: Row) => void;
  openSidebar?: boolean;
};

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
      app_impact: formatPercentage(
        spanTransactionMetrics[row.transaction]?.['sum(span.self_time)'] /
          applicationMetrics.total_time
      ),
      metrics: spanTransactionMetrics[row.transaction],
      metricSeries: spanTransactionMetricsSeries[row.transaction],
    };
  });

  const renderHeadCell = column => {
    return <span>{column.name}</span>;
  };

  const renderBodyCell = (column, row: Row) => {
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
  column: Column;
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

  if (column.key === 'p50(transaction.duration)') {
    return <P50Cell span={span} row={row} column={column} />;
  }

  if (column.key === 'epm()') {
    return <EPMCell span={span} row={row} column={column} />;
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

function P50Cell({row}: CellProps) {
  const theme = useTheme();
  const p50 = row.metrics?.p50;
  const p50Series = row.metricSeries?.p50;

  return (
    <Fragment>
      {p50Series ? (
        <Sparkline
          color={DURATION_COLOR}
          series={p50Series}
          markLine={
            p50 ? generateHorizontalLine(`${p50.toFixed(2)}`, p50, theme) : undefined
          }
        />
      ) : null}
    </Fragment>
  );
}

function EPMCell({row}: CellProps) {
  const theme = useTheme();
  const epm = row.metrics?.spm;
  const epmSeries = row.metricSeries?.spm;

  return (
    <Fragment>
      {epmSeries ? (
        <Sparkline
          color={THROUGHPUT_COLOR}
          series={epmSeries}
          markLine={
            epm ? generateHorizontalLine(`${epm.toFixed(2)}`, epm, theme) : undefined
          }
        />
      ) : null}
    </Fragment>
  );
}

const COLUMN_ORDER = [
  {
    key: 'transaction',
    name: 'In Endpoint',
    width: 500,
  },
  {
    key: 'epm()',
    name: 'Throughput (TPM)',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'p50(transaction.duration)',
    name: 'Duration (P50)',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'app_impact',
    name: 'App Impact',
    width: COL_WIDTH_UNDEFINED,
  },
];
