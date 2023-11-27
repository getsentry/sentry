import {useMemo} from 'react';

import {PageFilters} from 'sentry/types';
import {UseCase} from 'sentry/utils/metrics';
import {ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

// TODO(ddm): reuse from types/metrics.tsx
type MetricMeta = {
  mri: string;
  name: string;
  operations: string[];
  type: string;
  unit: string;
};

interface Options {
  useCases?: UseCase[];
}

const DEFAULT_USE_CASES = ['sessions', 'transactions', 'custom'];

export function useMetricsMeta(
  projects: PageFilters['projects'],
  options?: Options
): {data: Record<string, MetricMeta>; isLoading: boolean} {
  const {slug} = useOrganization();
  const enabledUseCases = options?.useCases ?? DEFAULT_USE_CASES;

  const getKey = (useCase: UseCase): ApiQueryKey => {
    return [
      `/organizations/${slug}/metrics/meta/`,
      {query: {useCase, project: projects}},
    ];
  };

  const hasSessions = enabledUseCases.includes('sessions');
  const hasTransactions = enabledUseCases.includes('transactions');
  const hasCustom = enabledUseCases.includes('custom');

  const commonOptions = {
    staleTime: Infinity,
  };

  const sessionsMeta = useApiQuery<MetricMeta[]>(getKey('sessions'), {
    ...commonOptions,
    enabled: hasSessions,
  });
  const txnsMeta = useApiQuery<MetricMeta[]>(getKey('transactions'), {
    ...commonOptions,
    enabled: hasTransactions,
  });
  const customMeta = useApiQuery<MetricMeta[]>(getKey('custom'), {
    ...commonOptions,
    enabled: hasCustom,
  });

  const combinedMeta = useMemo<Record<string, MetricMeta>>(() => {
    return [
      ...(hasSessions ? sessionsMeta.data ?? [] : []),
      ...(hasTransactions ? txnsMeta.data ?? [] : []),
      ...(hasCustom ? customMeta.data ?? [] : []),
    ].reduce((acc, metricMeta) => {
      return {...acc, [metricMeta.mri]: metricMeta};
    }, {});
  }, [
    hasSessions,
    sessionsMeta.data,
    hasTransactions,
    txnsMeta.data,
    hasCustom,
    customMeta.data,
  ]);

  return {
    data: combinedMeta,
    isLoading:
      (sessionsMeta.isLoading && sessionsMeta.fetchStatus !== 'idle') ||
      (txnsMeta.isLoading && txnsMeta.fetchStatus !== 'idle') ||
      (customMeta.isLoading && customMeta.fetchStatus !== 'idle'),
  };
}
