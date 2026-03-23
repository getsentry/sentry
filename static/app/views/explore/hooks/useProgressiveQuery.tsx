import type {CaseInsensitive} from 'sentry/components/searchQueryBuilder/hooks';

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
export type RPCQueryExtras = {
  caseInsensitive?: CaseInsensitive;
  disableAggregateExtrapolation?: string;
  logQuery?: string[];
  metricQuery?: string[];
  samplingMode?: SamplingMode;
  spanQuery?: string[];
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
    };
  };
  queryOptions?: QueryOptions<TQueryFn>;
}

interface QueryOptions<TQueryFn extends (...args: any[]) => any> {
  canTriggerHighAccuracy?: (data: ReturnType<TQueryFn>['result']) => boolean;
  disableExtrapolation?: boolean;
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
