import useOrganization from 'sentry/utils/useOrganization';
import {useExploreVisualizes} from 'sentry/views/explore/contexts/pageParamsContext';
import {computeTotals} from 'sentry/views/explore/hooks/useAnalytics';

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
export type SpansRPCQueryExtras = {
  samplingMode?: SamplingMode;
};

interface ProgressiveQueryOptions<TQueryFn extends (...args: any[]) => any> {
  queryHookArgs: Parameters<TQueryFn>[0];

  // Enforces that isFetched is always present in the result, required for the
  // progressive loading to surface the correct data.
  queryHookImplementation: (props: Parameters<TQueryFn>[0]) => ReturnType<TQueryFn> & {
    result: {
      data: any;
      isFetched: boolean;
    };
  };
  queryOptions?: QueryOptions;
}

interface QueryOptions {
  isTimeseries?: boolean;
  isTopN?: boolean;
  queryMode?: QueryMode;
  withholdBestEffort?: boolean;
}

/**
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
  const visualizes = useExploreVisualizes();
  const canUseProgressiveLoading = organization.features.includes(
    'visibility-explore-progressive-loading'
  );

  const queryMode = queryOptions?.queryMode ?? QUERY_MODE.SERIAL;

  const singleQueryResult = queryHookImplementation({
    ...queryHookArgs,
    enabled: queryHookArgs.enabled && !canUseProgressiveLoading,
  });

  const preflightRequest = queryHookImplementation({
    ...queryHookArgs,
    queryExtras: LOW_SAMPLING_MODE_QUERY_EXTRAS,
    enabled: queryHookArgs.enabled && canUseProgressiveLoading,
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
      (queryMode === QUERY_MODE.PARALLEL ||
        triggerBestEffortAfterPreflight ||
        triggerBestEffortRequestForEmptyPreflight),
  });

  if (!canUseProgressiveLoading) {
    return singleQueryResult;
  }

  if (bestEffortRequest.result.isFetched) {
    if (queryOptions?.isTimeseries) {
      const bestEffortSampleCount = computeTotals(
        visualizes,
        bestEffortRequest.result.data,
        queryOptions?.isTopN ?? false
      ).reduce((sum, count) => sum + count, 0);
      const preflightSampleCount = computeTotals(
        visualizes,
        preflightRequest.result.data,
        queryOptions?.isTopN ?? false
      ).reduce((sum, count) => sum + count, 0);

      if (preflightSampleCount > bestEffortSampleCount) {
        // Continue to show the preflight results if they have more samples
        // than best effort
        return {
          ...preflightRequest,
          samplingMode: SAMPLING_MODE.BEST_EFFORT,
        };
      }
    }

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
