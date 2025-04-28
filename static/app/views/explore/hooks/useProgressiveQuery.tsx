import useOrganization from 'sentry/utils/useOrganization';

export const SAMPLING_MODE = {
  PREFLIGHT: 'PREFLIGHT',
  BEST_EFFORT: 'BEST_EFFORT',
  NORMAL: 'NORMAL',
  HIGH_ACCURACY: 'HIGH_ACCURACY',
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

const NORMAL_SAMPLING_MODE_QUERY_EXTRAS = {
  samplingMode: SAMPLING_MODE.NORMAL,
} as const;

type QueryMode = (typeof QUERY_MODE)[keyof typeof QUERY_MODE];
export type SamplingMode = (typeof SAMPLING_MODE)[keyof typeof SAMPLING_MODE];
export type SpansRPCQueryExtras = {
  samplingMode?: SamplingMode;
};

interface ProgressiveQueryOptions<TQueryFn extends (...args: any[]) => any> {
  queryHookArgs: Parameters<TQueryFn>[0];

  // Enforces that isFetched is always present in the result, required for the
  // progressive loading to surface the correct data.
  queryHookImplementation: (props: Parameters<TQueryFn>[0]) => ReturnType<TQueryFn> & {
    result: ReturnType<TQueryFn>['result'] & {
      data: any;
      isFetched: boolean;
    };
  };
  queryOptions?: QueryOptions<TQueryFn>;
}

interface QueryOptions<TQueryFn extends (...args: any[]) => any> {
  canTriggerHighAccuracy?: (data: ReturnType<TQueryFn>['result']) => boolean;
  queryMode?: QueryMode;
  withholdBestEffort?: boolean;
}

/**
 * Warning: This hook is experimental and subject to change, and currently should
 * only be used with requests for spans RPC data.
 *
 * A hook that composes the behavior of progressively loading from a preflight
 * endpoint and a best effort endpoint for quicker feedback for queries.
 *
 * This hook is meant to be used as a wrapper where another hook is passed along.
 * The hook argument must accept `enabled` and `queryExtras` as arguments and
 * return `results` and `isFetched` to indicate when the query is complete.
 *
 * When the best effort request is complete, the results will always use the
 * best effort results and surface the fidelity of the response that is served.
 */
export function useProgressiveQuery<
  TQueryFn extends (...args: any[]) => ReturnType<TQueryFn>,
>({
  queryHookImplementation,
  queryHookArgs,
  queryOptions,
}: ProgressiveQueryOptions<TQueryFn>): ReturnType<TQueryFn> & {
  samplingMode?: SamplingMode;
} {
  const organization = useOrganization();
  const canUseProgressiveLoading = organization.features.includes(
    'visibility-explore-progressive-loading'
  );
  const canUseNormalSamplingMode = organization.features.includes(
    'visibility-explore-progressive-loading-normal-sampling-mode'
  );

  const queryMode = queryOptions?.queryMode ?? QUERY_MODE.SERIAL;

  const singleQueryResult = queryHookImplementation({
    ...queryHookArgs,
    enabled:
      queryHookArgs.enabled && !canUseProgressiveLoading && !canUseNormalSamplingMode,
  });

  // This is the execution of the PREFLIGHT -> BEST_EFFORT flow
  const preflightRequest = queryHookImplementation({
    ...queryHookArgs,
    queryExtras: LOW_SAMPLING_MODE_QUERY_EXTRAS,
    enabled:
      queryHookArgs.enabled && canUseProgressiveLoading && !canUseNormalSamplingMode,
  });

  const triggerBestEffortAfterPreflight =
    !queryOptions?.withholdBestEffort && preflightRequest.result.isFetched;
  const triggerBestEffortRequestForEmptyPreflight =
    preflightRequest.result.isFetched &&
    queryOptions?.withholdBestEffort &&
    preflightRequest.result.data?.length === 0;

  const bestEffortRequest = queryHookImplementation({
    ...queryHookArgs,
    queryExtras: HIGH_SAMPLING_MODE_QUERY_EXTRAS,
    enabled:
      queryHookArgs.enabled &&
      canUseProgressiveLoading &&
      !canUseNormalSamplingMode &&
      (queryMode === QUERY_MODE.PARALLEL ||
        triggerBestEffortAfterPreflight ||
        triggerBestEffortRequestForEmptyPreflight),
  });
  // End of PREFLIGHT -> BEST_EFFORT flow

  // This is the execution of the NORMAL -> HIGH_ACCURACY flow
  const normalSamplingModeRequest = queryHookImplementation({
    ...queryHookArgs,
    queryExtras: NORMAL_SAMPLING_MODE_QUERY_EXTRAS,
    enabled: queryHookArgs.enabled && canUseNormalSamplingMode,
  });

  let triggerHighAccuracy = false;
  if (normalSamplingModeRequest.result.isFetched) {
    triggerHighAccuracy =
      queryOptions?.canTriggerHighAccuracy?.(normalSamplingModeRequest.result) ?? false;
  }
  // queryExtras is not passed in here because this request should be unsampled.
  const highAccuracyRequest = queryHookImplementation({
    ...queryHookArgs,
    enabled: queryHookArgs.enabled && canUseNormalSamplingMode && triggerHighAccuracy,
  });
  // End of NORMAL -> HIGH_ACCURACY flow

  if (canUseNormalSamplingMode) {
    if (highAccuracyRequest?.result?.isFetched) {
      return {
        ...highAccuracyRequest,
        samplingMode: SAMPLING_MODE.HIGH_ACCURACY,
      };
    }

    return {
      ...normalSamplingModeRequest,
      samplingMode: SAMPLING_MODE.NORMAL,
    };
  }
  if (canUseProgressiveLoading) {
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

  // If neither of the sampling modes are available, return the single query result
  return singleQueryResult;
}
