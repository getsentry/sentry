import {Fragment} from 'react';
import * as qs from 'query-string';

import GridEditable, {GridColumnHeader as Column} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import Truncate from 'sentry/components/truncate';
import {useLocation} from 'sentry/utils/useLocation';
import type {Span} from 'sentry/views/starfish/views/spans/spanSummaryPanel/types';
import {useSpanTransactions} from 'sentry/views/starfish/views/spans/spanSummaryPanel/useSpanTransactions';

type Props = {
  span: Span;
};

type Row = {
  count: number;
  transaction: string;
};

export function SpanTransactionsTable({span}: Props) {
  const location = useLocation();
  const {data: spanTransactions, isLoading} = useSpanTransactions(span);

  const renderHeadCell = column => {
    return <span>{column.name}</span>;
  };

  const renderBodyCell = (column, row: Row) => {
    return <BodyCell span={span} column={column} row={row} />;
  };

  return (
    <GridEditable
      isLoading={isLoading}
      data={spanTransactions}
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

const COLUMN_ORDER = [
  {
    key: 'transaction',
    name: 'Transaction',
    width: 400,
  },
];
