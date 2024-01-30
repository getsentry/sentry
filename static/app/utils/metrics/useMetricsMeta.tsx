import type {PageFilters} from 'sentry/types';
import {formatMRI, getUseCaseFromMRI} from 'sentry/utils/metrics/mri';
import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import type {MetricMeta, MRI, UseCase} from '../../types/metrics';

const DEFAULT_USE_CASES = ['sessions', 'transactions', 'custom', 'spans'];

export function getMetricsMetaQueryKey(
  orgSlug: string,
  projects: PageFilters['projects'],
  useCase: UseCase
): ApiQueryKey {
  return [
    `/organizations/${orgSlug}/metrics/meta/`,
    {query: {useCase, project: projects}},
  ];
}

function useMetaUseCase(
  useCase: UseCase,
  projects: PageFilters['projects'],
  options: Omit<UseApiQueryOptions<MetricMeta[]>, 'staleTime'>
) {
  const {slug} = useOrganization();

  const apiQueryResult = useApiQuery<MetricMeta[]>(
    getMetricsMetaQueryKey(slug, projects, useCase),
    {
      ...options,
      staleTime: 2000, // 2 seconds to cover page load
    }
  );

  return apiQueryResult;
}

export function useMetricsMeta(
  projects: PageFilters['projects'],
  useCases?: UseCase[],
  filterBlockedMetrics = true
): {data: MetricMeta[]; isLoading: boolean} {
  const enabledUseCases = useCases ?? DEFAULT_USE_CASES;

  const {data: sessionMeta = [], ...sessionsReq} = useMetaUseCase('sessions', projects, {
    enabled: enabledUseCases.includes('sessions'),
  });
  const {data: txnsMeta = [], ...txnsReq} = useMetaUseCase('transactions', projects, {
    enabled: enabledUseCases.includes('transactions'),
  });
  const {data: customMeta = [], ...customReq} = useMetaUseCase('custom', projects, {
    enabled: enabledUseCases.includes('custom'),
  });
  const {data: spansMeta = [], ...spansReq} = useMetaUseCase('spans', projects, {
    enabled: enabledUseCases.includes('spans'),
  });

  const isLoading =
    (sessionsReq.isLoading && sessionsReq.fetchStatus !== 'idle') ||
    (txnsReq.isLoading && txnsReq.fetchStatus !== 'idle') ||
    (customReq.isLoading && customReq.fetchStatus !== 'idle') ||
    (spansReq.isLoading && spansReq.fetchStatus !== 'idle');

  const data = [
    ...(enabledUseCases.includes('sessions') ? sessionMeta : []),
    ...(enabledUseCases.includes('transactions') ? txnsMeta : []),
    ...(enabledUseCases.includes('custom') ? customMeta : []),
    ...(enabledUseCases.includes('spans') ? spansMeta : []),
  ].sort((a, b) => formatMRI(a.mri).localeCompare(formatMRI(b.mri)));

  if (!filterBlockedMetrics) {
    return {data, isLoading};
  }

  return {
    data: data.filter(meta => {
      return meta.blockingStatus?.every(({isBlocked}) => !isBlocked) ?? true;
    }),
    isLoading,
  };
}

export function useProjectMetric(mri: MRI, projectId: number) {
  const useCase = getUseCaseFromMRI(mri);
  const res = useMetricsMeta([projectId], [useCase ?? 'custom'], false);

  const metricMeta = res.data?.find(({mri: metaMri}) => metaMri === mri);
  const blockingStatus = metricMeta?.blockingStatus?.[0];

  return {...res, data: {...metricMeta, blockingStatus}};
}
