import {Link} from 'react-router';

import DateTime from 'sentry/components/dateTime';
import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import {useLocation} from 'sentry/utils/useLocation';
import {SpanDurationBar} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/spanDetailsTable';
import {DurationComparisonCell} from 'sentry/views/starfish/components/samplesTable/common';
import {
  OverflowEllipsisTextContainer,
  TextAlignRight,
} from 'sentry/views/starfish/components/textAlign';

type Keys = 'transaction_id' | 'timestamp' | 'duration' | 'p95_comparison';
type TableColumnHeader = GridColumnHeader<Keys>;

const COLUMN_ORDER: TableColumnHeader[] = [
  {
    key: 'transaction_id',
    name: 'Event ID',
    width: 200,
  },
  {
    key: 'duration',
    name: 'Span Duration',
    width: 200,
  },
  {
    key: 'p95_comparison',
    name: 'Compared to P95',
    width: 200,
  },
];

type SpanTableRow = {
  exclusive_time: number;
  p95Comparison: number;
  'project.name': string;
  spanDuration: number;
  spanOp: string;
  span_id: string;
  timestamp: string;
  transaction: string;
  transactionDuration: number;
  transaction_id: string;
  user: string;
};

type Props = {
  data: SpanTableRow[];
  isLoading: boolean;
  p95: number;
};

export function SpanSamplesTable({isLoading, data, p95}: Props) {
  const location = useLocation();

  function renderHeadCell(column: GridColumnHeader): React.ReactNode {
    if (column.key === 'p95_comparison') {
      return (
        <TextAlignRight>
          <OverflowEllipsisTextContainer>{column.name}</OverflowEllipsisTextContainer>
        </TextAlignRight>
      );
    }

    return <OverflowEllipsisTextContainer>{column.name}</OverflowEllipsisTextContainer>;
  }

  function renderBodyCell(column: GridColumnHeader, row: SpanTableRow): React.ReactNode {
    if (column.key === 'transaction_id') {
      return (
        <Link
          to={`/performance/${row['project.name']}:${
            row.transaction_id
          }#span-${row.span_id.slice(19).replace('-', '')}`}
        >
          {row.transaction_id.slice(0, 8)}
        </Link>
      );
    }

    if (column.key === 'duration') {
      return (
        <SpanDurationBar
          spanOp={row.spanOp}
          spanDuration={row.spanDuration}
          transactionDuration={row.transactionDuration}
        />
      );
    }

    if (column.key === 'p95_comparison') {
      return <DurationComparisonCell duration={row.spanDuration} p95={p95} />;
    }

    if (column.key === 'timestamp') {
      return <DateTime date={row.timestamp} year timeZone seconds />;
    }

    return <span>{row[column.key]}</span>;
  }

  return (
    <GridEditable
      isLoading={isLoading}
      data={data}
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
