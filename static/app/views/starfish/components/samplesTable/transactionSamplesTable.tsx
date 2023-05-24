import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import {DurationComparisonCell} from 'sentry/views/starfish/components/samplesTable/common';
import useSlowMedianFastSamplesQuery from 'sentry/views/starfish/components/samplesTable/useSlowMedianFastSamplesQuery';
import {TextAlignLeft} from 'sentry/views/starfish/modules/APIModule/endpointTable';

type Keys = 'id' | 'timestamp' | 'transaction.duration' | 'p50_comparison';
type TableColumnHeader = GridColumnHeader<Keys>;

const COLUMN_ORDER: TableColumnHeader[] = [
  {
    key: 'id',
    name: 'Event ID',
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
    key: 'p50_comparison',
    name: 'Compared to P50',
    width: 200,
  },
];

type Props = {
  eventView: EventView;
};

type DataRow = {
  id: string;
  'transaction.duration': number;
};

export function TransactionSamplesTable({eventView}: Props) {
  const location = useLocation();
  const {isLoading, data, aggregatesData} = useSlowMedianFastSamplesQuery(eventView);

  function renderBodyCell(column: TableColumnHeader, row: DataRow): React.ReactNode {
    if (column.key === 'id') {
      return (
        <Link to={`/performance/${row['project.name']}:${row.id}`}>
          {row.id.slice(0, 8)}
        </Link>
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

    if (column.key === 'p50_comparison') {
      return (
        <DurationComparisonCell
          duration={row['transaction.duration']}
          p50={aggregatesData['p50(transaction.duration)']}
        />
      );
    }

    return <TextAlignLeft>{row[column.key]}</TextAlignLeft>;
  }

  return (
    <GridEditable
      isLoading={isLoading}
      data={data}
      columnOrder={COLUMN_ORDER}
      columnSortBy={[]}
      location={location}
      grid={{
        renderBodyCell,
      }}
    />
  );
}
