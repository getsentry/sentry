import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import * as qs from 'query-string';

import GridEditable, {GridColumnHeader as Column} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import Truncate from 'sentry/components/truncate';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {Series} from 'sentry/types/echarts';
import {useLocation} from 'sentry/utils/useLocation';
import Sparkline, {
  generateHorizontalLine,
} from 'sentry/views/starfish/components/sparkline';
import type {Span} from 'sentry/views/starfish/views/spans/spanSummaryPanel/types';
import {useSpanTransactionMetrics} from 'sentry/views/starfish/views/spans/spanSummaryPanel/useSpanTransactionMetrics';
import {useSpanTransactionMetricSeries} from 'sentry/views/starfish/views/spans/spanSummaryPanel/useSpanTransactionMetricSeries';
import {useSpanTransactions} from 'sentry/views/starfish/views/spans/spanSummaryPanel/useSpanTransactions';

type Props = {
  span: Span;
};

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

export function SpanTransactionsTable({span}: Props) {
  const location = useLocation();

  const {data: spanTransactions, isLoading} = useSpanTransactions(span);
  const {data: spanTransactionMetrics} = useSpanTransactionMetrics(
    spanTransactions.map(row => row.transaction)
  );
  const {data: spanTransactionMetricsSeries} = useSpanTransactionMetricSeries(
    spanTransactions.map(row => row.transaction)
  );

  const spanTransactionsWithMetrics = spanTransactions.map(row => {
    return {
      ...row,
      metrics: spanTransactionMetrics[row.transaction],
      metricSeries: spanTransactionMetricsSeries[row.transaction],
    };
  });

  const renderHeadCell = column => {
    return <span>{column.name}</span>;
  };

  const renderBodyCell = (column, row: Row) => {
    return <BodyCell span={span} column={column} row={row} />;
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

type CellProps = {column: Column; row: Row; span: Span};

function BodyCell({span, column, row}: CellProps) {
  if (column.key === 'transaction') {
    return <TransactionCell span={span} row={row} column={column} />;
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
        <Truncate value={row[column.key]} maxLength={50} />
      </Link>

      <span>{row.count} spans</span>
    </Fragment>
  );
}

function P50Cell({row}: CellProps) {
  const theme = useTheme();
  const p50 = row.metrics?.['p50(transaction.duration)'];
  const p50Series = row.metricSeries?.['p50(transaction.duration)'];

  return (
    <Fragment>
      {p50Series ? (
        <Sparkline
          color={CHART_PALETTE[3][0]}
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
  const epm = row.metrics?.['epm()'];
  const epmSeries = row.metricSeries?.['epm()'];

  return (
    <Fragment>
      {epmSeries ? (
        <Sparkline
          color={CHART_PALETTE[3][1]}
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
    name: 'Transaction',
    width: -1,
  },
  {
    key: 'epm()',
    name: 'Txn Throughput (TPM)',
    width: -1,
  },
  {
    key: 'p50(transaction.duration)',
    name: 'Txn Duration (p50)',
    width: -1,
  },
];
