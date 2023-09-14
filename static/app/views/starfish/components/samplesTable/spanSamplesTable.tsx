import {CSSProperties} from 'react';
import {Link} from 'react-router';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import {useLocation} from 'sentry/utils/useLocation';
import {DurationComparisonCell} from 'sentry/views/starfish/components/samplesTable/common';
import {DurationCell} from 'sentry/views/starfish/components/tableCells/durationCell';
import {
  OverflowEllipsisTextContainer,
  TextAlignRight,
} from 'sentry/views/starfish/components/textAlign';
import {SpanSample} from 'sentry/views/starfish/queries/useSpanSamples';

type Keys =
  | 'transaction_id'
  | 'timestamp'
  | 'duration'
  | 'p95_comparison'
  | 'avg_comparison';
type TableColumnHeader = GridColumnHeader<Keys>;

const COLUMN_ORDER: TableColumnHeader[] = [
  {
    key: 'transaction_id',
    name: 'Event ID',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'duration',
    name: 'Span Duration',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'avg_comparison',
    name: 'Compared to Average',
    width: COL_WIDTH_UNDEFINED,
  },
];

type SpanTableRow = {
  op: string;
  transaction: {
    id: string;
    'project.name': string;
    timestamp: string;
    'transaction.duration': number;
  };
} & SpanSample;

type Props = {
  avg: number;
  data: SpanTableRow[];
  isLoading: boolean;
  highlightedSpanId?: string;
  onMouseLeaveSample?: () => void;
  onMouseOverSample?: (sample: SpanSample) => void;
};

export function SpanSamplesTable({
  isLoading,
  data,
  avg,
  highlightedSpanId,
  onMouseLeaveSample,
  onMouseOverSample,
}: Props) {
  const location = useLocation();

  function handleMouseOverBodyCell(row: SpanTableRow) {
    if (onMouseOverSample) {
      onMouseOverSample(row);
    }
  }

  function handleMouseLeave() {
    if (onMouseLeaveSample) {
      onMouseLeaveSample();
    }
  }

  function renderHeadCell(column: GridColumnHeader): React.ReactNode {
    if (
      column.key === 'p95_comparison' ||
      column.key === 'avg_comparison' ||
      column.key === 'duration'
    ) {
      return (
        <TextAlignRight>
          <OverflowEllipsisTextContainer>{column.name}</OverflowEllipsisTextContainer>
        </TextAlignRight>
      );
    }

    return <OverflowEllipsisTextContainer>{column.name}</OverflowEllipsisTextContainer>;
  }

  function renderBodyCell(column: GridColumnHeader, row: SpanTableRow): React.ReactNode {
    const shouldHighlight = row.span_id === highlightedSpanId;

    const commonProps = {
      style: (shouldHighlight ? {fontWeight: 'bold'} : {}) satisfies CSSProperties,
      onMouseEnter: () => handleMouseOverBodyCell(row),
    };

    if (column.key === 'transaction_id') {
      return (
        <Link
          to={`/performance/${row.project}:${row['transaction.id']}#span-${row.span_id}`}
          {...commonProps}
        >
          {row['transaction.id'].slice(0, 8)}
        </Link>
      );
    }

    if (column.key === 'duration') {
      return (
        <DurationCell containerProps={commonProps} milliseconds={row['span.self_time']} />
      );
    }

    if (column.key === 'avg_comparison') {
      return (
        <DurationComparisonCell
          containerProps={commonProps}
          duration={row['span.self_time']}
          compareToDuration={avg}
        />
      );
    }

    return <span {...commonProps}>{row[column.key]}</span>;
  }

  return (
    <div onMouseLeave={handleMouseLeave}>
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
    </div>
  );
}
