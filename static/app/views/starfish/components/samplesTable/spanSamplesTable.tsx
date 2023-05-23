import {Link} from 'react-router';
import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {SpanDurationBar} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/spanDetailsTable';
import {TextAlignRight} from 'sentry/views/starfish/modules/APIModule/endpointTable';
import {OverflowEllipsisTextContainer} from 'sentry/views/starfish/views/spanSummary';

type Keys = 'transaction_id' | 'timestamp' | 'duration' | 'p50_comparison';
type TableColumnHeader = GridColumnHeader<Keys>;

const COLUMN_ORDER: TableColumnHeader[] = [
  {
    key: 'transaction_id',
    name: 'Event ID',
    width: 200,
  },
  {
    key: 'timestamp',
    name: 'Timestamp',
    width: 300,
  },
  {
    key: 'duration',
    name: 'Span Duration',
    width: 200,
  },
  {
    key: 'p50_comparison',
    name: 'Compared to P50',
    width: 200,
  },
];

type SpanTableRow = {
  exclusive_time: number;
  p50Comparison: number;
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
  p50: number;
};

export function SpanSamplesTable({isLoading, data, p50}: Props) {
  const location = useLocation();

  function renderHeadCell(column: GridColumnHeader): React.ReactNode {
    if (column.key === 'p50_comparison') {
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

    if (column.key === 'p50_comparison') {
      const diff = row.spanDuration - p50;

      if (Math.floor(row.spanDuration) === Math.floor(p50)) {
        return <PlaintextLabel>{t('At baseline')}</PlaintextLabel>;
      }

      const labelString =
        diff > 0 ? `+${diff.toFixed(2)}ms above` : `${diff.toFixed(2)}ms below`;

      return <ComparisonLabel value={diff}>{labelString}</ComparisonLabel>;
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

const PlaintextLabel = styled('div')`
  text-align: right;
`;

const ComparisonLabel = styled('div')<{value: number}>`
  text-align: right;
  color: ${p => (p.value < 0 ? p.theme.green400 : p.theme.red400)};
`;
