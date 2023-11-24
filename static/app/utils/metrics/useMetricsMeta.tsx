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

  const commonOptions = {
    staleTime: Infinity,
  };

  const sessionsMeta = useApiQuery<MetricMeta[]>(getKey('sessions'), {
    ...commonOptions,
    enabled: enabledUseCases.includes('sessions'),
  });
  const txnsMeta = useApiQuery<MetricMeta[]>(getKey('transactions'), {
    ...commonOptions,
    enabled: enabledUseCases.includes('transactions'),
  });
  const customMeta = useApiQuery<MetricMeta[]>(getKey('custom'), {
    ...commonOptions,
    enabled: enabledUseCases.includes('custom'),
  });

  const combinedMeta = useMemo<Record<string, MetricMeta>>(() => {
    return [
      ...(sessionsMeta.data ?? []),
      ...(txnsMeta.data ?? []),
      ...(customMeta.data ?? []),
    ].reduce((acc, metricMeta) => {
      return {...acc, [metricMeta.mri]: metricMeta};
    }, {});
  }, [sessionsMeta.data, txnsMeta.data, customMeta.data]);

  return {
    data: combinedMeta,
    isLoading: sessionsMeta.isLoading || txnsMeta.isLoading || customMeta.isLoading,
  };
}
