import {useMemo} from 'react';

import type {PageFilters} from 'sentry/types/core';
import {formatMRI, getUseCaseFromMRI} from 'sentry/utils/metrics/mri';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQueries} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import type {MetricMeta, MRI, UseCase} from '../../types/metrics';

import {getMetaDateTimeParams} from './index';

const DEFAULT_USE_CASES: UseCase[] = ['sessions', 'transactions', 'custom', 'spans'];

export function getMetricsMetaQueryKey(
  orgSlug: string,
  {projects, datetime}: Partial<PageFilters>,
  useCase?: UseCase[]
): ApiQueryKey {
  const queryParams = projects?.length
    ? {useCase, project: projects, ...getMetaDateTimeParams(datetime)}
    : {useCase, ...getMetaDateTimeParams(datetime)};
  return [`/organizations/${orgSlug}/metrics/meta/`, {query: queryParams}];
}

export function useMetricsMeta(
  pageFilters: Partial<PageFilters>,
  useCases: UseCase[] = DEFAULT_USE_CASES,
  filterBlockedMetrics = true,
  enabled: boolean = true
): {data: MetricMeta[]; isLoading: boolean; isRefetching: boolean; refetch: () => void} {
  const {slug} = useOrganization();

  const queryKeys = useMemo(() => {
    return useCases.map(useCase => getMetricsMetaQueryKey(slug, pageFilters, [useCase]));
  }, [slug, pageFilters, useCases]);

  const results = useApiQueries<MetricMeta[]>(queryKeys, {
    enabled,
    staleTime: 2000, // 2 seconds to cover page load
  });

  const {data, isLoading, isRefetching, refetch} = useMemo(() => {
    const mergedResult: {
      data: MetricMeta[];
      isLoading: boolean;
      isRefetching: boolean;
      refetch: () => void;
    } = {
      data: [],
      isLoading: false,
      isRefetching: false,
      refetch: () => {
        results.forEach(result => result.refetch());
      },
    };

    for (const useCaseResult of results) {
      mergedResult.isLoading ||= useCaseResult.isLoading;
      mergedResult.isRefetching ||= useCaseResult.isRefetching;
      const useCaseData = useCaseResult.data ?? [];
      mergedResult.data.push(...useCaseData);
    }

    return mergedResult;
  }, [results]);

  const meta = (data ?? []).sort((a, b) =>
    formatMRI(a.mri).localeCompare(formatMRI(b.mri))
  );

  if (!filterBlockedMetrics) {
    return {data: meta, isLoading, isRefetching, refetch};
  }

  return {
    data: data.filter(entry => {
      return entry.blockingStatus?.every(({isBlocked}) => !isBlocked) ?? true;
    }),
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
