import {useEffect, useEffectEvent, useState} from 'react';

interface QueryValidationResult {
  data: {valid: boolean} | undefined;
  error: unknown;
  isFetching: boolean;
  isLoading: boolean;
  isPlaceholderData: boolean;
}

export function getQueryValidationState(validationResult: QueryValidationResult) {
  const isPending =
    validationResult.isFetching ||
    validationResult.isLoading ||
    validationResult.isPlaceholderData;
  const queriesEnabled =
    !isPending && !validationResult.error && validationResult.data?.valid === true;
  const preservePreviousData =
    !validationResult.error &&
    (isPending ? validationResult.data?.valid !== false : queriesEnabled);

  return {preservePreviousData, queriesEnabled};
}

export function getEmptyQueryResult<
  TResult extends {
    data: unknown;
    error: unknown;
    isError: boolean;
    isLoading: boolean;
    isPending: boolean;
  },
>(result: TResult, data: TResult['data']): TResult {
  return {
    ...result,
    data,
    error: null,
    isError: false,
    isLoading: false,
    isPending: false,
  };
}

interface QueryState {
  dataUpdatedAt: number;
  errorUpdatedAt: number;
  isPending: boolean;
}

export function useLastSettledQueryResult<T>(
  result: T,
  queryState: QueryState,
  enabled = true
): T {
  const [lastSettledResult, setLastSettledResult] = useState(result);
  const updateLastSettledResult = useEffectEvent(() => setLastSettledResult(result));

  useEffect(() => {
    if (enabled && !queryState.isPending) {
      updateLastSettledResult();
    }
  }, [
    enabled,
    queryState.dataUpdatedAt,
    queryState.errorUpdatedAt,
    queryState.isPending,
  ]);

  return lastSettledResult;
}

export function usePreserveQueryResult<T>(
  result: T,
  preservePreviousData: boolean,
  queryState: QueryState
): T {
  const lastSettledResult = useLastSettledQueryResult(result, queryState);
  return preservePreviousData && queryState.isPending ? lastSettledResult : result;
}
