import {useMemo} from 'react';

import type {PageFilters} from 'sentry/types/core';
import {isExtractedCustomMetric} from 'sentry/utils/metrics';
import {formatMRI, getUseCaseFromMRI} from 'sentry/utils/metrics/mri';
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
  return meta.toSorted((a, b) => formatMRI(a.mri).localeCompare(formatMRI(b.mri)));
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
    isLoading,
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
    getVirtualMRI,
    getVirtualMeta,
    isLoading: isVirtualMetricsContextLoading,
  } = useVirtualMetricsContext();

  const {data, isLoading, isRefetching, refetch} = useMetricsMeta(
    pageFilters,
    useCases,
    filterBlockedMetrics,
    enabled
  );

  const newMeta = useMemo(() => {
    const virtualMetrics = new Set<MRI>();
    // Filter all extracted custom metrics and map them to virtual metrics
    const otherMetrics = data.filter(meta => {
      if (!isExtractedCustomMetric(meta)) {
        return true;
      }

      const virtualMRI = getVirtualMRI(meta.mri);
      // If there is no virtual MRI, we don't want to show this metric
      if (!virtualMRI) {
        return false;
      }

      virtualMetrics.add(virtualMRI);
      return false;
    });

    // Add virtual metrics to the list and sort the array again
    const virtualMeta = Array.from(virtualMetrics).map(mri => getVirtualMeta(mri));

    return sortMeta([...otherMetrics, ...virtualMeta]);
  }, [data, getVirtualMRI, getVirtualMeta]);

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
