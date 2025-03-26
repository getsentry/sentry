import useOrganization from 'sentry/utils/useOrganization';

interface ProgressiveQueryOptions<TQueryFn extends (...args: any[]) => any> {
  queryHookArgs: Parameters<TQueryFn>[0];
  queryHookImplementation: (props: Parameters<TQueryFn>[0]) => ReturnType<TQueryFn>;
  queryMode: 'serial' | 'parallel';
}

const LOW_FIDELITY_QUERY_EXTRAS = {
  fidelity: 'low',
} as const;

const HIGH_FIDELITY_QUERY_EXTRAS = {
  fidelity: 'auto',
} as const;

export function useProgressiveQuery<TQueryFn extends (...args: any[]) => any>({
  queryHookImplementation,
  queryHookArgs,
  queryMode,
}: ProgressiveQueryOptions<TQueryFn>): ReturnType<TQueryFn> & {
  fidelity?: 'low' | 'auto';
} {
  const organization = useOrganization();
  const canUseProgressiveLoading = organization.features.includes(
    'visibility-explore-progressive-loading'
  );

  const singleQueryResult = queryHookImplementation({
    ...queryHookArgs,
    enabled: queryHookArgs.enabled && !canUseProgressiveLoading,
  });

  const lowFidelityResult = queryHookImplementation({
    ...queryHookArgs,
    queryExtras: LOW_FIDELITY_QUERY_EXTRAS,
  });

  const highFidelityResult = queryHookImplementation({
    ...queryHookArgs,
    queryExtras: HIGH_FIDELITY_QUERY_EXTRAS,
    enabled:
      queryHookArgs.enabled &&
      canUseProgressiveLoading &&
      (queryMode === 'parallel' || lowFidelityResult.isFetched),
  });

  if (!canUseProgressiveLoading) {
    return singleQueryResult;
  }

  if (highFidelityResult.result.isFetched) {
    return {
      ...highFidelityResult,
      fidelity: 'auto',
    };
  }

  return {
    ...lowFidelityResult,
    fidelity: 'low',
  };
}
