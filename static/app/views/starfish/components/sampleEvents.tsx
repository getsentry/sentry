import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import EventView from 'sentry/utils/discover/eventView';
import {
  DiscoverQueryProps,
  useGenericDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {TextAlignLeft} from 'sentry/views/starfish/components/textAlign';

type Props = {
  eventView: EventView;
};

type DataRow = {
  id: string;
  profile_id: string;
  timestamp: string;
  'transaction.duration': number;
};

type Keys = 'id' | 'profile_id' | 'transaction.duration' | 'timestamp';
type TableColumnHeader = GridColumnHeader<Keys>;
const COLUMN_ORDER: TableColumnHeader[] = [
  {
    key: 'id',
    name: 'Event ID',
    width: 300,
  },
  {
    key: 'profile_id',
    name: 'Profile ID',
    width: 300,
  },
  {
    key: 'transaction.duration',
    name: 'Duration',
    width: -1,
  },
  {
    key: 'timestamp',
    name: 'Timestamp',
    width: -1,
  },
];

export function SampleEvents({eventView}: Props) {
  const location = useLocation();
  const organization = useOrganization();

  const sampleEventsEventView = eventView
    .clone()
    .withColumns([
      {
        field: 'transaction.duration',
        kind: 'field',
      },
      {
        field: 'profile_id',
        kind: 'field',
      },
      {
        field: 'timestamp',
        kind: 'field',
      },
    ])
    .withSorts([
      {
        field: 'transaction.duration',
        kind: 'desc',
      },
    ]);

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

    if (column.key === 'timestamp') {
      return <DateTime date={row.timestamp} year timeZone seconds />;
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

    return <TextAlignLeft>{row[column.key]}</TextAlignLeft>;
  }

  const {isLoading, data} = useGenericDiscoverQuery<any, DiscoverQueryProps>({
    route: 'events',
    eventView: sampleEventsEventView,
    referrer: 'starfish-transaction-summary-sample-events',
    limit: 5,
    location,
    orgSlug: organization.slug,
    getRequestPayload: () => ({
      ...sampleEventsEventView.getEventsAPIPayload(location),
    }),
  });

  return (
    <GridEditable
      isLoading={isLoading}
      data={data?.data}
      columnOrder={COLUMN_ORDER}
      columnSortBy={[]}
      location={location}
      grid={{
        renderBodyCell,
      }}
    />
  );
}
