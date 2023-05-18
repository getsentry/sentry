import {Fragment} from 'react';
import * as qs from 'query-string';

import GridEditable, {GridColumnHeader as Column} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import Truncate from 'sentry/components/truncate';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {Series} from 'sentry/types/echarts';
import {useLocation} from 'sentry/utils/useLocation';
import Sparkline from 'sentry/views/starfish/components/sparkline';
import type {Span} from 'sentry/views/starfish/views/spans/spanSummaryPanel/types';
import {useSpanTransactionMetricSeries} from 'sentry/views/starfish/views/spans/spanSummaryPanel/useSpanTransactionMetricSeries';
import {useSpanTransactions} from 'sentry/views/starfish/views/spans/spanSummaryPanel/useSpanTransactions';

type Props = {
  span: Span;
};

type Row = {
  count: number;
  metrics: Record<string, Series>;
  transaction: string;
};

export function SpanTransactionsTable({span}: Props) {
  const location = useLocation();
  const {data: spanTransactions, isLoading} = useSpanTransactions(span);
  const {data: spanTransactionMetricsSeries} = useSpanTransactionMetricSeries(
    span,
    spanTransactions.map(row => row.transaction)
  );

  const spanTransactionsWithMetrics = spanTransactions.map(row => {
    return {
      ...row,
      metrics: spanTransactionMetricsSeries[row.transaction],
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

  if (column.key === 'p50') {
    return <P50Cell span={span} row={row} column={column} />;
  }

  if (column.key === 'spm') {
    return <SPMCell span={span} row={row} column={column} />;
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
  return (
    <Fragment>
      {row.metrics?.p50 ? (
        <Sparkline color={CHART_PALETTE[3][0]} series={row.metrics.p50} />
      ) : null}
    </Fragment>
  );
}

function SPMCell({row}: CellProps) {
  return (
    <Fragment>
      {row.metrics?.spm ? (
        <Sparkline color={CHART_PALETTE[3][1]} series={row.metrics.spm} />
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
    key: 'spm',
    name: 'SPM',
    width: -1,
  },
  {
    key: 'p50',
    name: 'p50',
    width: -1,
  },
];
