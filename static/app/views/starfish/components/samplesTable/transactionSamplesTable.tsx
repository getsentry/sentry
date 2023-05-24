import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import EventView from 'sentry/utils/discover/eventView';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import {
  DiscoverQueryProps,
  useGenericDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {useQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {TextAlignLeft} from 'sentry/views/starfish/modules/APIModule/endpointTable';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {getTransactionSamplesQuery} from 'sentry/views/starfish/views/webServiceView/endpointOverview/queries';

/* Two types of sample tables
  1: Transaction Focused
    - Gets sample transaction events
    - Duration is for the whole txn
    - p50 comparison is for the whole txn p50 compared to sample event
    - Will not have a span count column, as it is not span focused

  2: Span Focused
    - Gets transaction events containing a specific span
    - Duration is scoped to the single span
    - p50 comparison is specific to the span
    - Needs span count in a specific txn event
**/

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
  p50: number;
};

type DataRow = {
  id: string;
  'transaction.duration': number;
};

export function TransactionSamplesTable({eventView, p50}: Props) {
  const location = useLocation();
  const organization = useOrganization();

  console.log(p50);

  const commonColumns: QueryFieldValue[] = [
    {
      field: 'transaction.duration',
      kind: 'field',
    },
    {
      field: 'timestamp',
      kind: 'field',
    },
  ];

  const sampleEventsEventViewSlowest = eventView
    .clone()
    .withColumns(commonColumns)
    .withSorts([
      {
        field: 'transaction.duration',
        kind: 'desc',
      },
    ]);

  const sampleEventsEventViewFastest = eventView
    .clone()
    .withColumns(commonColumns)
    .withSorts([
      {
        field: 'transaction.duration',
        kind: 'asc',
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
      return <DateTime date={row['timestamp']} year timeZone seconds />;
    }

    return <TextAlignLeft>{row[column.key]}</TextAlignLeft>;
  }

  const {isLoading, data} = useGenericDiscoverQuery<any, DiscoverQueryProps>({
    route: 'events',
    eventView: sampleEventsEventViewSlowest,
    referrer: 'starfish-transaction-summary-sample-events',
    limit: 3,
    location,
    orgSlug: organization.slug,
    getRequestPayload: () => ({
      ...sampleEventsEventViewSlowest.getEventsAPIPayload(location),
    }),
  });

  const {isLoading: isLoading2, data: data2} = useGenericDiscoverQuery<
    any,
    DiscoverQueryProps
  >({
    route: 'events',
    eventView: sampleEventsEventViewFastest,
    referrer: 'starfish-transaction-summary-sample-events',
    limit: 3,
    location,
    orgSlug: organization.slug,
    getRequestPayload: () => ({
      ...sampleEventsEventViewFastest.getEventsAPIPayload(location),
    }),
  });

  console.dir(data2);

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
