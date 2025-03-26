import useOrganization from 'sentry/utils/useOrganization';

interface ProgressiveQueryOptions<TQueryFn extends (...args: any[]) => any> {
  queryHookArgs: Parameters<TQueryFn>[0];
  queryHookImplementation: (props: Parameters<TQueryFn>[0]) => ReturnType<TQueryFn>;
  queryMode: 'serial' | 'parallel';
}

export const FIDELITY = {
  LOW: 'low',
  AUTO: 'auto',
} as const;

export const QUERY_MODE = {
  SERIAL: 'serial',
  PARALLEL: 'parallel',
} as const;

const LOW_FIDELITY_QUERY_EXTRAS = {
  fidelity: FIDELITY.LOW,
} as const;

const HIGH_FIDELITY_QUERY_EXTRAS = {
  fidelity: FIDELITY.AUTO,
} as const;

export type Fidelity = (typeof FIDELITY)[keyof typeof FIDELITY];

export function useProgressiveQuery<TQueryFn extends (...args: any[]) => any>({
  queryHookImplementation,
  queryHookArgs,
  queryMode,
}: ProgressiveQueryOptions<TQueryFn>): ReturnType<TQueryFn> & {
  fidelity?: Fidelity;
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
      (queryMode === QUERY_MODE.PARALLEL || lowFidelityResult.isFetched),
  });

  if (!canUseProgressiveLoading) {
    return singleQueryResult;
  }

  if (highFidelityResult.result.isFetched) {
    return {
      ...highFidelityResult,
      fidelity: FIDELITY.AUTO,
    };
  }

  return {
    ...lowFidelityResult,
    fidelity: FIDELITY.LOW,
  };
}
