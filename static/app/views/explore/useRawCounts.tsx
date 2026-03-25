import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilters} from 'sentry/types/core';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useApiQuery, type ApiQueryKey} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';

type QueryResultItem<K extends string> = Record<K, number | null>;

interface QueryResult<K extends string> {
  data: Array<QueryResultItem<K>>;
  meta?: EventsMetaType;
}

interface RawCount {
  count: number | null;
  isLoading: boolean;
}

export interface RawCounts {
  normal: RawCount;
  total: RawCount;
}

interface UseRawCountsOptions {
  dataset: DiscoverDatasets;
  enabled?: boolean;
  normalModeExtrapolated?: boolean;
  query?: string;
  selection?: PageFilters;
}

export function useRawCounts({
  dataset,
  enabled,
  selection,
  query,
  normalModeExtrapolated,
}: UseRawCountsOptions): RawCounts {
  const organization = useOrganization();
  const {selection: pageFilterSelection} = usePageFilters();
  const effectiveSelection = selection ?? pageFilterSelection;

  const count = getAggregateForDataset(dataset);

  const baseQueryParams = {
    dataset,
    project: effectiveSelection.projects,
    environment: effectiveSelection.environments,
    ...normalizeDateTimeParams(effectiveSelection.datetime),
    field: [count],
    disableAggregateExtrapolation: '1',
    query,
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

  const normalModeExtrapolatedOptions = {
    referrer: `${baseReferrer}.normal-extrapolated-total`,
    sampling: SAMPLING_MODE.NORMAL,
    disableAggregateExtrapolation: undefined,
    extrapolationMode: 'serverOnly',
  };

  const totalCountQueryKey: ApiQueryKey = [
    getApiUrl('/organizations/$organizationIdOrSlug/events/', {
      path: {organizationIdOrSlug: organization.slug},
    }),
    {
      query: {
        ...baseQueryParams,
        referrer: `${baseReferrer}.high-accuracy`,
        sampling: SAMPLING_MODE.HIGH_ACCURACY,
        ...(normalModeExtrapolated && dataset === DiscoverDatasets.TRACEMETRICS
          ? normalModeExtrapolatedOptions
          : {}),
      },
    },
  ];

  const totalCountResult = useApiQuery<QueryResult<typeof count>>(totalCountQueryKey, {
    enabled: enabled ?? true,
    staleTime: 0,
  });

  const normalScanCount = normalScanResult.data?.data?.[0]?.[count] ?? null;
  const totalCount = totalCountResult.data?.data?.[0]?.[count] ?? null;

  return {
    normal: {
      isLoading: normalScanResult.isFetching,
      count: normalScanCount,
    },
    total: {
      isLoading: totalCountResult.isFetching,
      count: totalCount,
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
      return 'api.explore.tracemetrics.raw-count' as const;
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
    case DiscoverDatasets.TRACEMETRICS:
      return 'count(value)' as const;
    default:
      throw new Error(`Unsupported dataset: ${dataset}`);
  }
}
