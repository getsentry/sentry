import {PageFilters} from 'sentry/types';
import {formatMRI} from 'sentry/utils/metrics/mri';
import {useApiQuery, UseApiQueryOptions} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {MetricMeta, UseCase} from '../../types/metrics';

const DEFAULT_USE_CASES = ['sessions', 'transactions', 'custom', 'spans'];

function useMetaUseCase(
  useCase: UseCase,
  projects: PageFilters['projects'],
  options: Omit<UseApiQueryOptions<MetricMeta[]>, 'staleTime'>
) {
  const {slug} = useOrganization();

  const apiQueryResult = useApiQuery<MetricMeta[]>(
    [`/organizations/${slug}/metrics/meta/`, {query: {useCase, project: projects}}],
    {
      ...options,
      staleTime: 2000, // 2 seconds to cover page load
    }
  );

  return apiQueryResult;
}

export function useMetricsMeta(
  projects: PageFilters['projects'],
  useCases?: UseCase[]
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

  const data = [
    ...(enabledUseCases.includes('sessions') ? sessionMeta : []),
    ...(enabledUseCases.includes('transactions') ? txnsMeta : []),
    ...(enabledUseCases.includes('custom') ? customMeta : []),
    ...(enabledUseCases.includes('spans') ? spansMeta : []),
  ].sort((a, b) => formatMRI(a.mri).localeCompare(formatMRI(b.mri)));

  return {
    data,
    isLoading:
      (sessionsReq.isLoading && sessionsReq.fetchStatus !== 'idle') ||
      (txnsReq.isLoading && txnsReq.fetchStatus !== 'idle') ||
      (customReq.isLoading && customReq.fetchStatus !== 'idle') ||
      (spansReq.isLoading && spansReq.fetchStatus !== 'idle'),
  };
}
