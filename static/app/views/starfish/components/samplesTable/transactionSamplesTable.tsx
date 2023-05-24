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
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
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
  p50: number;
};

type DataRow = {
  id: string;
  'transaction.duration': number;
};

export function TransactionSamplesTable({eventView, p50}: Props) {
  const location = useLocation();
  const organization = useOrganization();

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

  const eventViewAggregates = eventView.clone().withColumns([
    {kind: 'function', function: ['p50', 'transaction.duration']},
    {kind: 'function', function: ['p95', 'transaction.duration']},
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
      return <DateTime date={row[column.key]} year timeZone seconds />;
    }

    return <TextAlignLeft>{row[column.key]}</TextAlignLeft>;
  }

  const {isLoading: isLoadingAgg, data: aggregatesData} = useGenericDiscoverQuery<
    any,
    DiscoverQueryProps
  >({
    route: 'events',
    eventView: eventViewAggregates,
    referrer: 'starfish-transaction-summary-sample-events',
    location,
    orgSlug: organization.slug,
  });

  const slowestSamplesEventView = eventView
    .clone()
    .withColumns(commonColumns)
    .withSorts([
      {
        field: 'transaction.duration',
        kind: 'desc',
      },
    ]);

  slowestSamplesEventView.additionalConditions = new MutableSearch(
    `transaction.duration:>${
      aggregatesData?.data?.[0]?.['p95(transaction.duration)'] ?? 0
    }`
  );

  const {isLoading: isLoadingSlowest, data: slowestSamplesData} = useGenericDiscoverQuery<
    any,
    DiscoverQueryProps
  >({
    route: 'events',
    eventView: slowestSamplesEventView,
    referrer: 'starfish-transaction-summary-sample-events',
    location,
    orgSlug: organization.slug,
    getRequestPayload: () => ({
      ...slowestSamplesEventView.getEventsAPIPayload(location),
    }),
    limit: 5,
  });

  const medianSamplesEventView = eventView
    .clone()
    .withColumns(commonColumns)
    .withSorts([
      {
        field: 'transaction.duration',
        kind: 'desc',
      },
    ]);

  medianSamplesEventView.additionalConditions = new MutableSearch(
    `transaction.duration:<=${
      aggregatesData?.data?.[0]?.['p50(transaction.duration)'] ?? 0
    }`
  );

  const {isLoading: isLoadingMedian, data: medianSamplesData} = useGenericDiscoverQuery<
    any,
    DiscoverQueryProps
  >({
    route: 'events',
    eventView: medianSamplesEventView,
    referrer: 'starfish-transaction-summary-sample-events',
    location,
    orgSlug: organization.slug,
    getRequestPayload: () => ({
      ...medianSamplesEventView.getEventsAPIPayload(location),
    }),
    limit: 5,
  });

  const fastestSamplesEventView = eventView
    .clone()
    .withColumns(commonColumns)
    .withSorts([
      {
        field: 'transaction.duration',
        kind: 'asc',
      },
    ]);

  fastestSamplesEventView.additionalConditions = new MutableSearch(
    `transaction.duration:<=${
      aggregatesData?.data?.[0]?.['p50(transaction.duration)'] ?? 0
    }`
  );

  const {isLoading: isLoadingFastest, data: fastestSamplesData} = useGenericDiscoverQuery<
    any,
    DiscoverQueryProps
  >({
    route: 'events',
    eventView: fastestSamplesEventView,
    referrer: 'starfish-transaction-summary-sample-events',
    location,
    orgSlug: organization.slug,
    getRequestPayload: () => ({
      ...fastestSamplesEventView.getEventsAPIPayload(location),
    }),
    limit: 5,
  });

  console.dir(fastestSamplesData);

  return (
    <GridEditable
      isLoading={isLoadingSlowest}
      data={slowestSamplesData?.data}
      columnOrder={COLUMN_ORDER}
      columnSortBy={[]}
      location={location}
      grid={{
        renderBodyCell,
      }}
    />
  );
}
