import {useMemo} from 'react';

import type {PageFilters} from 'sentry/types/core';
import {
  formatMRI,
  getUseCaseFromMRI,
  isExtractedCustomMetric,
} from 'sentry/utils/metrics/mri';
import {useVirtualMetricsContext} from 'sentry/utils/metrics/virtualMetricsContext';
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

function sortMeta(meta: MetricMeta[]): MetricMeta[] {
  return meta.toSorted((a: any, b: any) =>
    formatMRI(a.mri).localeCompare(formatMRI(b.mri))
  );
}

export function useMetricsMeta(
  pageFilters: Partial<PageFilters>,
  useCases: UseCase[] = DEFAULT_USE_CASES,
  filterBlockedMetrics = true,
  enabled: boolean = true
): {data: MetricMeta[]; isLoading: boolean; isRefetching: boolean; refetch: () => void} {
  const {slug} = useOrganization();

  const {data, isPending, isRefetching, refetch} = useApiQuery<MetricMeta[]>(
    getMetricsMetaQueryKey(slug, pageFilters, useCases),
    {
      enabled,
      staleTime: 2000, // 2 seconds to cover page load
    }
  );

  const meta = useMemo(() => sortMeta(data ?? []), [data]);

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
    isLoading: isPending,
    isRefetching,
    refetch,
  };
}

/**
 * Like useMetricsMeta, but it maps extracted custom metrics into a separate namespace
 */
export const useVirtualizedMetricsMeta = (
  pageFilters: Partial<PageFilters>,
  useCases: UseCase[] = DEFAULT_USE_CASES,
  filterBlockedMetrics = true,
  enabled: boolean = true
): {
  data: MetricMeta[];
  isLoading: boolean;
  isRefetching: boolean;
  refetch: () => void;
} => {
  const {
    virtualMeta,
    isLoading: isVirtualMetricsContextLoading,
    getVirtualMRI,
  } = useVirtualMetricsContext();

  const {data, isLoading, isRefetching, refetch} = useMetricsMeta(
    pageFilters,
    useCases,
    filterBlockedMetrics,
    enabled
  );

  const newMeta = useMemo(() => {
    // Filter all metrics that have a virtual equivalent or are extracted metrics and mix them in from the virtual context
    const otherMetrics = data.filter(meta => {
      return !isExtractedCustomMetric(meta) && !getVirtualMRI(meta.mri);
    });

    return sortMeta([...otherMetrics, ...virtualMeta]);
  }, [data, getVirtualMRI, virtualMeta]);

  return {
    data: newMeta,
    isLoading: isLoading || isVirtualMetricsContextLoading,
    isRefetching,
    refetch,
  };
};

export function useProjectMetric(mri: MRI, projectId: number) {
  const useCase = getUseCaseFromMRI(mri);
  const res = useMetricsMeta({projects: [projectId]}, [useCase ?? 'custom'], false);

  const metricMeta = res.data?.find(({mri: metaMri}) => metaMri === mri);
  const blockingStatus = metricMeta?.blockingStatus?.[0];

  return {...res, data: {...metricMeta, blockingStatus}};
}
