import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useApiQuery, type ApiQueryKey} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';

type QueryResultItem<K extends string> = Record<K, number | null>;

interface QueryResult<K extends string> {
  data: Array<QueryResultItem<K>>;
}

interface RawCount {
  count: number | null;
  isLoading: boolean;
}

export interface RawCounts {
  highAccuracy: RawCount;
  normal: RawCount;
}

interface UseRawCountsOptions {
  dataset: DiscoverDatasets;
  /**
   * Optional custom aggregate function. If not provided, a default aggregate
   * will be determined based on the dataset.
   * Used for metrics which require dynamic aggregates like `count(value,<name>,<type>,-)`.
   */
  aggregate?: string;
  enabled?: boolean;
}

export function useRawCounts({
  dataset,
  aggregate,
  enabled,
}: UseRawCountsOptions): RawCounts {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const count = aggregate ?? getAggregateForDataset(dataset);

  const baseQueryParams = {
    dataset,
    project: selection.projects,
    environment: selection.environments,
    ...normalizeDateTimeParams(selection.datetime),
    field: [count],
    disableAggregateExtrapolation: '1',
  };

  const baseReferrer = getBaseReferrer(dataset);

  const normalScanQueryKey: ApiQueryKey = [
    getApiUrl('/organizations/$organizationIdOrSlug/events/', {
      path: {organizationIdOrSlug: organization.slug},
    }),
    {
      query: {
        ...baseQueryParams,
        referrer: `${baseReferrer}.normal`,
        sampling: SAMPLING_MODE.NORMAL,
      },
    },
  ];

  const normalScanResult = useApiQuery<QueryResult<typeof count>>(normalScanQueryKey, {
    enabled: enabled ?? true,
    staleTime: 0,
  });

  const highestAccuracyScanQueryKey: ApiQueryKey = [
    getApiUrl('/organizations/$organizationIdOrSlug/events/', {
      path: {organizationIdOrSlug: organization.slug},
    }),
    {
      query: {
        ...baseQueryParams,
        referrer: `${baseReferrer}.high-accuracy`,
        sampling: SAMPLING_MODE.HIGH_ACCURACY,
      },
    },
  ];

  const highestAccuracyScanResult = useApiQuery<QueryResult<typeof count>>(
    highestAccuracyScanQueryKey,
    {
      enabled: enabled ?? true,
      staleTime: 0,
    }
  );

  const normalScanCount = normalScanResult.data?.data?.[0]?.[count] ?? null;
  const highestAccuracyScanCount =
    highestAccuracyScanResult.data?.data?.[0]?.[count] ?? null;

  return {
    normal: {
      isLoading: normalScanResult.isFetching,
      count: normalScanCount,
    },
    highAccuracy: {
      isLoading: highestAccuracyScanResult.isFetching,
      count: highestAccuracyScanCount,
    },
  };
}

function getBaseReferrer(dataset: DiscoverDatasets) {
  switch (dataset) {
    case DiscoverDatasets.SPANS:
      return 'api.explore.spans.raw-count' as const;
    case DiscoverDatasets.OURLOGS:
      return 'api.explore.logs.raw-count' as const;
    case DiscoverDatasets.TRACEMETRICS:
      return 'api.explore.metrics.raw-count' as const;
    default:
      throw new Error(`Unsupported dataset: ${dataset}`);
  }
}

function getAggregateForDataset(dataset: DiscoverDatasets) {
  switch (dataset) {
    case DiscoverDatasets.SPANS:
      return 'count(span.duration)' as const;
    case DiscoverDatasets.OURLOGS:
      return 'count(message)' as const;
    default:
      throw new Error(`Unsupported dataset: ${dataset}`);
  }
}
