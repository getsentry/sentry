import useOrganization from 'sentry/utils/useOrganization';

export const SAMPLING_MODE = {
  PREFLIGHT: 'PREFLIGHT',
  BEST_EFFORT: 'BEST_EFFORT',
} as const;

export const QUERY_MODE = {
  SERIAL: 'serial',
  PARALLEL: 'parallel',
} as const;

const LOW_SAMPLING_MODE_QUERY_EXTRAS = {
  samplingMode: SAMPLING_MODE.PREFLIGHT,
} as const;

const HIGH_SAMPLING_MODE_QUERY_EXTRAS = {
  samplingMode: SAMPLING_MODE.BEST_EFFORT,
} as const;

export type QueryMode = (typeof QUERY_MODE)[keyof typeof QUERY_MODE];
export type SamplingMode = (typeof SAMPLING_MODE)[keyof typeof SAMPLING_MODE];

interface ProgressiveQueryOptions<TQueryFn extends (...args: any[]) => any> {
  queryHookArgs: Parameters<TQueryFn>[0];

  // Enforces that isFetched is always present in the result, required for the
  // progressive loading to surface the correct data.
  queryHookImplementation: (props: Parameters<TQueryFn>[0]) => ReturnType<TQueryFn> & {
    result: {
      isFetched: boolean;
    };
  };
  queryMode: QueryMode;
}

/**
 * A hook that composes the behavior of progressively loading from a preflight
 * endpoint and a best effort endpoint for quicker feedback for queries.
 *
 * This hook is meant to be used as a wrapper where another hook is passed along.
 * The hook argument must return `results` and `isFetched` to indicate when
 * the query is complete.
 *
 * When the best effort request is complete, the results will always use the
 * best effort results and surface the fidelity of the response that is served.
 */
export function useProgressiveQuery<
  TQueryFn extends (...args: any[]) => ReturnType<TQueryFn>,
>({
  queryHookImplementation,
  queryHookArgs,
  queryMode,
}: ProgressiveQueryOptions<TQueryFn>): ReturnType<TQueryFn> & {
  samplingMode?: SamplingMode;
} {
  const organization = useOrganization();
  const canUseProgressiveLoading = organization.features.includes(
    'visibility-explore-progressive-loading'
  );

  const singleQueryResult = queryHookImplementation({
    ...queryHookArgs,
    enabled: queryHookArgs.enabled && !canUseProgressiveLoading,
  });

  const preflightRequest = queryHookImplementation({
    ...queryHookArgs,
    queryExtras: LOW_SAMPLING_MODE_QUERY_EXTRAS,
    enabled: queryHookArgs.enabled && canUseProgressiveLoading,
  });

  const bestEffortRequest = queryHookImplementation({
    ...queryHookArgs,
    queryExtras: HIGH_SAMPLING_MODE_QUERY_EXTRAS,
    enabled:
      queryHookArgs.enabled &&
      canUseProgressiveLoading &&
      (queryMode === QUERY_MODE.PARALLEL || preflightRequest.result.isFetched),
  });

  if (!canUseProgressiveLoading) {
    return singleQueryResult;
  }

  if (bestEffortRequest.result.isFetched) {
    return {
      ...bestEffortRequest,
      samplingMode: SAMPLING_MODE.BEST_EFFORT,
    };
  }

  return {
    ...preflightRequest,
    samplingMode: SAMPLING_MODE.PREFLIGHT,
  };
}
