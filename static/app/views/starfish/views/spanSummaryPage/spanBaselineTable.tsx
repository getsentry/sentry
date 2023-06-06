import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import {Series} from 'sentry/types/echarts';
import {formatPercentage} from 'sentry/utils/formatters';
import {useLocation} from 'sentry/utils/useLocation';
import {SpanDescription} from 'sentry/views/starfish/components/spanDescription';
import DurationCell from 'sentry/views/starfish/components/tableCells/durationCell';
import ThroughputCell from 'sentry/views/starfish/components/tableCells/throughputCell';
import {TimeSpentCell} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import type {Span} from 'sentry/views/starfish/queries/types';
import {
  ApplicationMetrics,
  useApplicationMetrics,
} from 'sentry/views/starfish/queries/useApplicationMetrics';
import {SpanMetrics, useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {useSpanMetricSeries} from 'sentry/views/starfish/queries/useSpanMetricSeries';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

type Props = {
  span: Span;
};

type Row = {
  description: string;
  metricSeries: Record<string, Series>;
  metrics: SpanMetrics;
  timeSpent: string;
};

export type Keys =
  | 'description'
  | 'spans_per_second'
  | 'p95(span.self_time)'
  | 'timeSpent';
export type TableColumnHeader = GridColumnHeader<Keys>;

export function SpanBaselineTable({span}: Props) {
  const location = useLocation();

  const {data: applicationMetrics} = useApplicationMetrics();
  const {data: spanMetrics} = useSpanMetrics(span);
  const {data: spanMetricSeries} = useSpanMetricSeries(span);

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
          metricSeries: spanMetricSeries,
          timeSpent: formatPercentage(
            spanMetrics.total_time / applicationMetrics['sum(span.duration)']
          ),
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
  span: Span;
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
    return <DurationCell seconds={row.metrics.p95} />;
  }

  if (column.key === 'spans_per_second') {
    return <ThroughputCell throughputPerSecond={row.metrics.spans_per_second} />;
  }

  if (column.key === 'timeSpent') {
    return (
      <TimeSpentCell
        formattedTimeSpent={row[column.key]}
        totalSpanTime={row.metrics.total_time}
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
    key: 'spans_per_second',
    name: DataTitles.throughput,
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'p95(span.self_time)',
    name: DataTitles.p95,
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'timeSpent',
    name: DataTitles.timeSpent,
    width: COL_WIDTH_UNDEFINED,
  },
];
