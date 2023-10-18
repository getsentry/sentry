import max from 'lodash/max';

import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {DataRow} from 'sentry/views/starfish/components/samplesTable/transactionSamplesTable';

const LIMIT_PER_POPULATION = 2;

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
export default function useSlowMedianFastSamplesQuery(
  eventView: EventView,
  graphMax?: number
) {
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
    {
      field: 'spans.browser',
      kind: 'field',
    },
    {
      field: 'spans.db',
      kind: 'field',
    },
    {
      field: 'spans.http',
      kind: 'field',
    },
    {
      field: 'spans.resource',
      kind: 'field',
    },
    {
      field: 'spans.ui',
      kind: 'field',
    },
  ];

  const eventViewAggregates = eventView
    .clone()
    .withColumns([
      {kind: 'function', function: ['avg', 'transaction.duration', undefined, undefined]},
    ]);

  const {isLoading: isLoadingAgg, data: aggregatesData} = useDiscoverQuery({
    eventView: eventViewAggregates,
    referrer: 'starfish-transaction-summary-sample-events',
    location,
    orgSlug: organization.slug,
    options: {
      refetchOnWindowFocus: false,
      enabled: graphMax !== undefined,
    },
  });
  const avg = aggregatesData
    ? aggregatesData.data[0]['avg(transaction.duration)']
    : undefined;
  const upperThird = graphMax ? max([graphMax * (2 / 3), avg]) : undefined;
  const lowerThird = graphMax ? graphMax * (1 / 3) : undefined;

  const slowestSamplesEventView = eventView
    .clone()
    .withColumns(commonColumns)
    .withSorts([
      {
        field: 'id',
        kind: 'desc',
      },
    ]);

  slowestSamplesEventView.additionalConditions = new MutableSearch(
    `transaction.duration:<${graphMax} transaction.duration:>${upperThird}`
  );

  const {isLoading: isLoadingSlowest, data: slowestSamplesData} = useDiscoverQuery({
    eventView: slowestSamplesEventView,
    referrer: 'starfish-transaction-summary-sample-events',
    location,
    orgSlug: organization.slug,

    limit: LIMIT_PER_POPULATION,
    options: {
      refetchOnWindowFocus: false,
      enabled: graphMax !== undefined && avg !== undefined,
    },
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
    `transaction.duration:<=${upperThird} transaction.duration:>${lowerThird}`
  );

  const {isLoading: isLoadingMedian, data: medianSamplesData} = useDiscoverQuery({
    eventView: medianSamplesEventView,
    referrer: 'starfish-transaction-summary-sample-events',
    location,
    orgSlug: organization.slug,
    limit: LIMIT_PER_POPULATION,
    options: {
      refetchOnWindowFocus: false,
      enabled: graphMax !== undefined && avg !== undefined,
    },
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
    `transaction.duration:<=${lowerThird}`
  );

  const {isLoading: isLoadingFastest, data: fastestSamplesData} = useDiscoverQuery({
    eventView: fastestSamplesEventView,
    referrer: 'starfish-transaction-summary-sample-events',
    location,
    orgSlug: organization.slug,
    limit: LIMIT_PER_POPULATION,
    options: {
      refetchOnWindowFocus: false,
      enabled: graphMax !== undefined,
    },
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
    data: combinedData as DataRow[],
    aggregatesData: aggregatesData?.data[0] ?? [],
  };
}
