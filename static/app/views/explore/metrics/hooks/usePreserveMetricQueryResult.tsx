import {useEffect, useEffectEvent, useState} from 'react';

export function usePreserveMetricQueryResult<T>(
  result: T,
  preservePreviousData: boolean,
  queryState: {
    isPending: boolean;
    dataUpdatedAt?: number;
    errorUpdatedAt?: number;
    resultVersion?: unknown;
  }
): T {
  const [lastSettledResult, setLastSettledResult] = useState(result);
  const updateLastSettledResult = useEffectEvent(() => setLastSettledResult(result));

  useEffect(() => {
    if (!queryState.isPending) {
      updateLastSettledResult();
    }
  }, [
    queryState.dataUpdatedAt,
    queryState.errorUpdatedAt,
    queryState.isPending,
    queryState.resultVersion,
  ]);

  return preservePreviousData && queryState.isPending ? lastSettledResult : result;
}
