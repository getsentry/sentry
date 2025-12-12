import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
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
}

export function useRawCounts({dataset}: UseRawCountsOptions): RawCounts {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const count = getAggregateForDataset(dataset);

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
    `/organizations/${organization.slug}/events/`,
    {
      query: {
        ...baseQueryParams,
        referrer: `${baseReferrer}.normal`,
        sampling: SAMPLING_MODE.NORMAL,
      },
    },
  ];

  const normalScanResult = useApiQuery<QueryResult<typeof count>>(normalScanQueryKey, {
    enabled: true,
    staleTime: 0,
  });

  const highestAccuracyScanQueryKey: ApiQueryKey = [
    `/organizations/${organization.slug}/events/`,
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
      enabled: true,
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
