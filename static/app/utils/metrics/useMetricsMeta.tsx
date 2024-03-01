import type {PageFilters} from 'sentry/types';
import {formatMRI, getUseCaseFromMRI} from 'sentry/utils/metrics/mri';
import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import type {MetricMeta, MRI, UseCase} from '../../types/metrics';

import {getMetaDateTimeParams} from './index';

const EMPTY_ARRAY: MetricMeta[] = [];
const DEFAULT_USE_CASES = ['sessions', 'transactions', 'custom', 'spans'];

export function getMetricsMetaQueryKeys(
  orgSlug: string,
  projects: PageFilters['projects'],
  useCases?: UseCase[]
): ApiQueryKey[] {
  return (
    useCases?.map(useCase => getMetricsMetaQueryKey(orgSlug, {projects}, useCase)) ?? []
  );
}

export function getMetricsMetaQueryKey(
  orgSlug: string,
  {projects, datetime}: Partial<PageFilters>,
  useCase: UseCase
): ApiQueryKey {
  const queryParams = projects?.length
    ? {useCase, project: projects, ...getMetaDateTimeParams(datetime)}
    : {useCase, ...getMetaDateTimeParams(datetime)};
  return [`/organizations/${orgSlug}/metrics/meta/`, {query: queryParams}];
}

function useMetaUseCase(
  useCase: UseCase,
  pageFilters: Partial<PageFilters>,
  options: Omit<UseApiQueryOptions<MetricMeta[]>, 'staleTime'>
) {
  const {slug} = useOrganization();

  const apiQueryResult = useApiQuery<MetricMeta[]>(
    getMetricsMetaQueryKey(slug, pageFilters, useCase),
    {
      ...options,
      staleTime: 2000, // 2 seconds to cover page load
    }
  );

  return apiQueryResult;
}

export function useMetricsMeta(
  pageFilters: Partial<PageFilters>,
  useCases?: UseCase[],
  filterBlockedMetrics = true,
  enabled: boolean = true
): {data: MetricMeta[]; isLoading: boolean} {
  const enabledUseCases = useCases ?? DEFAULT_USE_CASES;

  const {data: sessionMeta = [], ...sessionsReq} = useMetaUseCase(
    'sessions',
    pageFilters,
    {
      enabled: enabled && enabledUseCases.includes('sessions'),
    }
  );
  const {data: txnsMeta = [], ...txnsReq} = useMetaUseCase('transactions', pageFilters, {
    enabled: enabled && enabledUseCases.includes('transactions'),
  });
  const {data: customMeta = [], ...customReq} = useMetaUseCase('custom', pageFilters, {
    enabled: enabled && enabledUseCases.includes('custom'),
  });
  const {data: spansMeta = [], ...spansReq} = useMetaUseCase('spans', pageFilters, {
    enabled: enabled && enabledUseCases.includes('spans'),
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
    data: isLoading
      ? EMPTY_ARRAY
      : data.filter(meta => {
          return meta.blockingStatus?.every(({isBlocked}) => !isBlocked) ?? true;
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
