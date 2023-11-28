import {useMemo} from 'react';

import {PageFilters} from 'sentry/types';
import {ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {MetricMeta, UseCase} from '../../types/metrics';

interface Options {
  useCases?: UseCase[];
}

const DEFAULT_USE_CASES = ['sessions', 'transactions', 'custom', 'spans'];

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
  const hasSpans = enabledUseCases.includes('spans');

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
  const spansMeta = useApiQuery<MetricMeta[]>(getKey('spans'), {
    ...commonOptions,
    enabled: hasSpans,
  });

  const combinedMeta = useMemo<Record<string, MetricMeta>>(() => {
    return [
      ...(hasSessions ? sessionsMeta.data ?? [] : []),
      ...(hasTransactions ? txnsMeta.data ?? [] : []),
      ...(hasCustom ? customMeta.data ?? [] : []),
      ...(hasSpans ? spansMeta.data ?? [] : []),
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
    hasSpans,
    spansMeta.data,
  ]);

  return {
    data: combinedMeta,
    isLoading:
      (sessionsMeta.isLoading && sessionsMeta.fetchStatus !== 'idle') ||
      (txnsMeta.isLoading && txnsMeta.fetchStatus !== 'idle') ||
      (customMeta.isLoading && customMeta.fetchStatus !== 'idle') ||
      (spansMeta.isLoading && spansMeta.fetchStatus !== 'idle'),
  };
}
