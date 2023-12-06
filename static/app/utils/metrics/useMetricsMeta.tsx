import {useMemo} from 'react';
import isArray from 'lodash/isArray';

import {PageFilters} from 'sentry/types';
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
      staleTime: Infinity,
    }
  );

  if (apiQueryResult.data && isArray(apiQueryResult.data)) {
    apiQueryResult.data = apiQueryResult.data.sort((a, b) => a.mri.localeCompare(b.mri));
  }

  return apiQueryResult;
}

export function useMetricsMeta(
  projects: PageFilters['projects'],
  useCases?: UseCase[]
): {data: Record<string, MetricMeta>; isLoading: boolean} {
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

  const combinedMeta = useMemo<Record<string, MetricMeta>>(() => {
    return [...sessionMeta, ...txnsMeta, ...customMeta, ...spansMeta].reduce(
      (acc, metricMeta) => {
        return {...acc, [metricMeta.mri]: metricMeta};
      },
      {}
    );
  }, [sessionMeta, txnsMeta, customMeta, spansMeta]);

  return {
    data: combinedMeta,
    isLoading:
      (sessionsReq.isLoading && sessionsReq.fetchStatus !== 'idle') ||
      (txnsReq.isLoading && txnsReq.fetchStatus !== 'idle') ||
      (customReq.isLoading && customReq.fetchStatus !== 'idle') ||
      (spansReq.isLoading && spansReq.fetchStatus !== 'idle'),
  };
}
