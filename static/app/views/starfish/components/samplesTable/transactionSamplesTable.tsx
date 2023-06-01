import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import {DurationComparisonCell} from 'sentry/views/starfish/components/samplesTable/common';
import useSlowMedianFastSamplesQuery from 'sentry/views/starfish/components/samplesTable/useSlowMedianFastSamplesQuery';
import {
  OverflowEllipsisTextContainer,
  TextAlignLeft,
  TextAlignRight,
} from 'sentry/views/starfish/components/textAlign';

type Keys = 'id' | 'profile_id' | 'timestamp' | 'transaction.duration' | 'p95_comparison';
type TableColumnHeader = GridColumnHeader<Keys>;

const COLUMN_ORDER: TableColumnHeader[] = [
  {
    key: 'id',
    name: 'Event ID',
    width: 200,
  },
  {
    key: 'profile_id',
    name: 'Profile ID',
    width: 200,
  },
  {
    key: 'timestamp',
    name: 'Timestamp',
    width: 300,
  },
  {
    key: 'transaction.duration',
    name: 'Duration',
    width: 200,
  },
  {
    key: 'p95_comparison',
    name: 'Compared to P95',
    width: 200,
  },
];

type Props = {
  eventView: EventView;
};

type DataRow = {
  id: string;
  profile_id: string;
  timestamp: string;
  'transaction.duration': number;
};

export function TransactionSamplesTable({eventView}: Props) {
  const location = useLocation();
  const {isLoading, data, aggregatesData} = useSlowMedianFastSamplesQuery(eventView);

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

  function renderBodyCell(column: TableColumnHeader, row: DataRow): React.ReactNode {
    if (column.key === 'id') {
      return (
        <Link to={`/performance/${row['project.name']}:${row.id}`}>
          {row.id.slice(0, 8)}
        </Link>
      );
    }

    if (column.key === 'profile_id') {
      return row.profile_id ? (
        <Link
          to={`/profiling/profile/${row['project.name']}/${row.profile_id}/flamechart/`}
        >
          {row.profile_id.slice(0, 8)}
        </Link>
      ) : (
        '(no value)'
      );
    }

    if (column.key === 'transaction.duration') {
      return (
        <Duration
          seconds={row['transaction.duration'] / 1000}
          fixedDigits={2}
          abbreviation
        />
      );
    }

    if (column.key === 'timestamp') {
      return <DateTime date={row[column.key]} year timeZone seconds />;
    }

    if (column.key === 'p95_comparison') {
      return (
        <DurationComparisonCell
          duration={row['transaction.duration']}
          p95={(aggregatesData?.['p95(transaction.duration)'] as number) ?? 0}
        />
      );
    }

    return <TextAlignLeft>{row[column.key]}</TextAlignLeft>;
  }

  return (
    <GridEditable
      isLoading={isLoading}
      data={data as DataRow[]}
      columnOrder={COLUMN_ORDER}
      columnSortBy={[]}
      location={location}
      grid={{
        renderHeadCell,
        renderBodyCell,
      }}
    />
  );
}
