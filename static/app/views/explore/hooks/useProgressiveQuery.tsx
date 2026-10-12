import {useEffect, useEffectEvent, useRef} from 'react';

import type {CaseInsensitive} from 'sentry/components/searchQueryBuilder/hooks';
import type {CrossEventQueryExtras} from 'sentry/views/explore/queryParams/crossEvent';

export const SAMPLING_MODE = {
  NORMAL: 'NORMAL',
  HIGH_ACCURACY: 'HIGHEST_ACCURACY',
  FLEX_TIME: 'HIGHEST_ACCURACY_FLEX_TIME',
} as const;

const NORMAL_SAMPLING_MODE_QUERY_EXTRAS = {
  samplingMode: SAMPLING_MODE.NORMAL,
} as const;

const HIGH_ACCURACY_SAMPLING_MODE_QUERY_EXTRAS = {
  samplingMode: SAMPLING_MODE.HIGH_ACCURACY,
} as const;

const NON_EXTRAPOLATED_SAMPLING_MODE_QUERY_EXTRAS = {
  disableAggregateExtrapolation: '1',
  samplingMode: SAMPLING_MODE.HIGH_ACCURACY,
} as const;

export type SamplingMode = (typeof SAMPLING_MODE)[keyof typeof SAMPLING_MODE];
export type RPCQueryExtras = Partial<CrossEventQueryExtras> & {
  caseInsensitive?: CaseInsensitive;
  disableAggregateExtrapolation?: string;
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
      isFetching: boolean;
      isError?: boolean;
    };
  };
  queryOptions?: QueryOptions<TQueryFn>;
}

interface QueryOptions<TQueryFn extends (...args: any[]) => any> {
  canTriggerHighAccuracy?: (data: ReturnType<TQueryFn>['result']) => boolean;
  disableExtrapolation?: boolean;
  onHighAccuracyError?: (result: ReturnType<TQueryFn>['result']) => void;
  onHighAccuracyRequest?: () => void;
  onHighAccuracySuccess?: (result: ReturnType<TQueryFn>['result']) => void;
}

/**
 * A hook used for querying spans data from EAP in stages.
 *
 * It first fires a query using `SAMPLING_MODE.NORMAL`, allowing EAP to make a
 * decision around which tier data to query so that it returns within an acceptable
 * amount of time.
 *
 * In the event that the first query succeeds but returned no data, check to see
 * if EAP used a partial data scan to answer the query. If it did, that means there
 * is the possibility scanning the full table will result in some data. Here, it
 * fires another query using `SAMPLING_MODE.HIGH_ACCURACY`. This comes at the risk
 * of possibly timing out for a chance to answer the query with an non empty response.
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
  const disableExtrapolation = queryOptions?.disableExtrapolation || false;

  const nonExtrapolatedMode = disableExtrapolation && queryHookArgs.enabled;
  const nonExtrapolatedModeRequest = queryHookImplementation({
    ...queryHookArgs,
    queryExtras: {
      ...queryHookArgs.queryExtras,
      ...NON_EXTRAPOLATED_SAMPLING_MODE_QUERY_EXTRAS,
    },
    enabled: nonExtrapolatedMode,
  });

  const normalMode = !disableExtrapolation && queryHookArgs.enabled;
  const normalSamplingModeRequest = queryHookImplementation({
    ...queryHookArgs,
    queryExtras: {
      ...queryHookArgs.queryExtras,
      ...NORMAL_SAMPLING_MODE_QUERY_EXTRAS,
    },
    enabled: normalMode,
  });

  let triggerHighAccuracy = false;
  if (normalSamplingModeRequest.result.isFetched) {
    triggerHighAccuracy =
      queryOptions?.canTriggerHighAccuracy?.(normalSamplingModeRequest.result) ?? false;
  }
  const highAccuracyMode =
    !disableExtrapolation && queryHookArgs.enabled && triggerHighAccuracy;
  const highAccuracyRequest = queryHookImplementation({
    ...queryHookArgs,
    queryExtras: {
      ...queryHookArgs.queryExtras,
      ...HIGH_ACCURACY_SAMPLING_MODE_QUERY_EXTRAS,
    },
    enabled: highAccuracyMode,
  });

  const highAccuracyIsFetching =
    highAccuracyMode && highAccuracyRequest.result.isFetching;
  const highAccuracyIsError = highAccuracyMode && !!highAccuracyRequest.result.isError;
  const highAccuracyIsSuccess =
    highAccuracyMode &&
    highAccuracyRequest.result.isFetched &&
    !highAccuracyIsFetching &&
    !highAccuracyIsError;

  const onHighAccuracyRequest = useEffectEvent(() => {
    queryOptions?.onHighAccuracyRequest?.();
  });
  const onHighAccuracySuccess = useEffectEvent(() => {
    queryOptions?.onHighAccuracySuccess?.(highAccuracyRequest.result);
  });
  const onHighAccuracyError = useEffectEvent(() => {
    queryOptions?.onHighAccuracyError?.(highAccuracyRequest.result);
  });

  // Outcomes are only reported for fetches observed here, so cached results
  // read on remount don't count as successes or failures without a request.
  const hasPendingHighAccuracyFetch = useRef(false);

  useEffect(() => {
    if (highAccuracyIsFetching) {
      hasPendingHighAccuracyFetch.current = true;
      onHighAccuracyRequest();
    }
  }, [highAccuracyIsFetching]);

  useEffect(() => {
    if (highAccuracyIsSuccess && hasPendingHighAccuracyFetch.current) {
      hasPendingHighAccuracyFetch.current = false;
      onHighAccuracySuccess();
    }
  }, [highAccuracyIsSuccess]);

  useEffect(() => {
    if (highAccuracyIsError && hasPendingHighAccuracyFetch.current) {
      hasPendingHighAccuracyFetch.current = false;
      onHighAccuracyError();
    }
  }, [highAccuracyIsError]);

  if (nonExtrapolatedMode) {
    return {
      ...nonExtrapolatedModeRequest,
      samplingMode: SAMPLING_MODE.HIGH_ACCURACY,
    };
  }

  if (highAccuracyMode) {
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
