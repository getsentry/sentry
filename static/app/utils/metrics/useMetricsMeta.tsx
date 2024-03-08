import type {PageFilters} from 'sentry/types';
import {formatMRI, getUseCaseFromMRI} from 'sentry/utils/metrics/mri';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import type {MetricMeta, MRI, UseCase} from '../../types/metrics';

import {getMetaDateTimeParams} from './index';

const EMPTY_ARRAY: MetricMeta[] = [];
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
): {data: MetricMeta[]; isLoading: boolean} {
  const {slug} = useOrganization();

  const {data, isLoading} = useApiQuery<MetricMeta[]>(
    getMetricsMetaQueryKey(slug, pageFilters, useCases),
    {
      enabled,
      refetchInterval: 60000,
      staleTime: 2000, // 2 seconds to cover page load
    }
  );

  if (!data) {
    return {data: EMPTY_ARRAY, isLoading};
  }

  const meta = data.sort((a, b) => formatMRI(a.mri).localeCompare(formatMRI(b.mri)));

  if (!filterBlockedMetrics) {
    return {data: meta, isLoading};
  }

  return {
    data: data.filter(entry => {
      return entry.blockingStatus?.every(({isBlocked}) => !isBlocked) ?? true;
    }),
    isLoading,
  };
}

export function useProjectMetric(mri: MRI, projectId: number) {
  const useCase = getUseCaseFromMRI(mri);
  const res = useMetricsMeta({projects: [projectId]}, [useCase ?? 'custom'], false);

  const metricMeta = res.data?.find(({mri: metaMri}) => metaMri === mri);
  const blockingStatus = metricMeta?.blockingStatus?.[0];

  return {...res, data: {...metricMeta, blockingStatus}};
}
