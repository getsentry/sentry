import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

const LIMIT_PER_POPULATION = 5;

/**
 * This hook will fetch transaction events from 3 different types of populations and combine them in one set, then return them:
 *
 * - Slowest Events
 * - Median / Baseline Events
 * - Fastest Events
 *
 * It assumes that you are passing an eventView object with a query scoped to a specific transaction
 *
 * @param eventView An eventView containing query information, such as the transaction and other filters
 */
export default function useSlowMedianFastSamplesQuery(eventView: EventView) {
  const location = useLocation();
  const organization = useOrganization();

  const commonColumns: QueryFieldValue[] = [
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
  ];

  const eventViewAggregates = eventView.clone().withColumns([
    {kind: 'function', function: ['p50', 'transaction.duration', undefined, undefined]},
    {kind: 'function', function: ['p95', 'transaction.duration', undefined, undefined]},
  ]);

  const {isLoading: isLoadingAgg, data: aggregatesData} = useDiscoverQuery({
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

  const {isLoading: isLoadingSlowest, data: slowestSamplesData} = useDiscoverQuery({
    eventView: slowestSamplesEventView,
    referrer: 'starfish-transaction-summary-sample-events',
    location,
    orgSlug: organization.slug,

    limit: LIMIT_PER_POPULATION,
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

  const {isLoading: isLoadingMedian, data: medianSamplesData} = useDiscoverQuery({
    eventView: medianSamplesEventView,
    referrer: 'starfish-transaction-summary-sample-events',
    location,
    orgSlug: organization.slug,
    limit: LIMIT_PER_POPULATION,
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

  const {isLoading: isLoadingFastest, data: fastestSamplesData} = useDiscoverQuery({
    eventView: fastestSamplesEventView,
    referrer: 'starfish-transaction-summary-sample-events',
    location,
    orgSlug: organization.slug,
    limit: LIMIT_PER_POPULATION,
  });

  if (isLoadingAgg || isLoadingSlowest || isLoadingMedian || isLoadingFastest) {
    return {isLoading: true, data: []};
  }

  const combinedData = [
    ...(slowestSamplesData?.data ?? []),
    ...(medianSamplesData?.data ?? []),
    ...(fastestSamplesData?.data ?? []),
  ];

  return {
    isLoading: false,
    data: combinedData,
    aggregatesData: aggregatesData?.data[0] ?? [],
  };
}
