import {useMemo} from 'react';

import type {PageFilters} from 'sentry/types/core';
import {formatMRI, getUseCaseFromMRI} from 'sentry/utils/metrics/mri';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import type {MetricMeta, MRI, UseCase} from '../../types/metrics';

const DEFAULT_USE_CASES: UseCase[] = ['sessions', 'transactions', 'custom', 'spans'];

export function getMetricsMetaQueryKey(
  orgSlug: string,
  {projects}: Partial<PageFilters>,
  useCase?: UseCase[]
): ApiQueryKey {
  const queryParams = projects?.length ? {useCase, project: projects} : {useCase};
  return [`/organizations/${orgSlug}/metrics/meta/`, {query: queryParams}];
}

export function useMetricsMeta(
  pageFilters: Partial<PageFilters>,
  useCases: UseCase[] = DEFAULT_USE_CASES,
  filterBlockedMetrics = true,
  enabled: boolean = true
): {data: MetricMeta[]; isLoading: boolean; isRefetching: boolean; refetch: () => void} {
  const {slug} = useOrganization();

  const {data, isLoading, isRefetching, refetch} = useApiQuery<MetricMeta[]>(
    getMetricsMetaQueryKey(slug, pageFilters, useCases),
    {
      enabled,
      staleTime: 2000, // 2 seconds to cover page load
    }
  );

  const meta = useMemo(
    () => (data ?? []).sort((a, b) => formatMRI(a.mri).localeCompare(formatMRI(b.mri))),
    [data]
  );

  const filteredMeta = useMemo(
    () =>
      filterBlockedMetrics
        ? meta.filter(entry => {
            return entry.blockingStatus?.every(({isBlocked}) => !isBlocked) ?? true;
          })
        : meta,
    [filterBlockedMetrics, meta]
  );

  return {
    data: filteredMeta,
    isLoading,
    isRefetching,
    refetch,
  };
}

export function useProjectMetric(mri: MRI, projectId: number) {
  const useCase = getUseCaseFromMRI(mri);
  const res = useMetricsMeta({projects: [projectId]}, [useCase ?? 'custom'], false);

  const metricMeta = res.data?.find(({mri: metaMri}) => metaMri === mri);
  const blockingStatus = metricMeta?.blockingStatus?.[0];

  return {...res, data: {...metricMeta, blockingStatus}};
}
