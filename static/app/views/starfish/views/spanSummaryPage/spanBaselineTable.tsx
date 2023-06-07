import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import {formatPercentage} from 'sentry/utils/formatters';
import {useLocation} from 'sentry/utils/useLocation';
import {SpanDescription} from 'sentry/views/starfish/components/spanDescription';
import DurationCell from 'sentry/views/starfish/components/tableCells/durationCell';
import ThroughputCell from 'sentry/views/starfish/components/tableCells/throughputCell';
import {TimeSpentCell} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import type {IndexedSpan} from 'sentry/views/starfish/queries/types';
import {
  ApplicationMetrics,
  useApplicationMetrics,
} from 'sentry/views/starfish/queries/useApplicationMetrics';
import {SpanMetrics, useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

type Props = {
  span: IndexedSpan;
};

type Row = {
  description: string;
  metrics: SpanMetrics;
};

export type Keys =
  | 'description'
  | 'spm()'
  | 'p95(span.self_time)'
  | 'time_spent_percentage()';
export type TableColumnHeader = GridColumnHeader<Keys>;

export function SpanBaselineTable({span}: Props) {
  const location = useLocation();

  const {data: applicationMetrics} = useApplicationMetrics();
  const {data: spanMetrics} = useSpanMetrics(span);

  const renderHeadCell = column => {
    return <span>{column.name}</span>;
  };

  const renderBodyCell = (column: TableColumnHeader, row: Row) => {
    return (
      <BodyCell
        span={span}
        column={column}
        row={row}
        applicationMetrics={applicationMetrics}
      />
    );
  };

  return (
    <GridEditable
      isLoading={false}
      data={[
        {
          description: span.description ?? '',
          metrics: spanMetrics,
        },
      ]}
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
  span: IndexedSpan;
};

function BodyCell({
  span,
  column,
  row,
}: CellProps & {applicationMetrics: ApplicationMetrics}) {
  if (column.key === 'description') {
    return <DescriptionCell span={span} row={row} column={column} />;
  }

  if (column.key === 'p95(span.self_time)') {
    return <DurationCell seconds={row.metrics?.['p95(span.duration)']} />;
  }

  if (column.key === 'spm()') {
    return <ThroughputCell throughputPerSecond={row.metrics?.['spm()']} />;
  }

  if (column.key === 'time_spent_percentage()') {
    return (
      <TimeSpentCell
        formattedTimeSpent={formatPercentage(row.metrics?.['time_spent_percentage()'])}
        totalSpanTime={row.metrics?.['sum(span.duration)']}
      />
    );
  }

  return <span>{row[column.key]}</span>;
}

function DescriptionCell({span}: CellProps) {
  return <SpanDescription span={span} />;
}

const COLUMN_ORDER: TableColumnHeader[] = [
  {
    key: 'description',
    name: 'Description',
    width: 500,
  },
  {
    key: 'spm()',
    name: DataTitles.throughput,
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'p95(span.self_time)',
    name: DataTitles.p95,
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'time_spent_percentage()',
    name: DataTitles.timeSpent,
    width: COL_WIDTH_UNDEFINED,
  },
];
