import {useCallback, useState} from 'react';
import {hashKey, useQueryClient} from '@tanstack/react-query';

import {
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import type {LogsInfiniteQueryKey} from 'sentry/views/explore/logs/useLogsApiOptions';

export interface LogAnchor {
  id: string;
  timestampPrecise: bigint;
}

export function useLogAnchor({
  autoRefresh,
  queryKey,
}: {
  autoRefresh: boolean;
  queryKey: LogsInfiniteQueryKey;
}) {
  const queryClient = useQueryClient();
  const queryKeyHash = hashKey(queryKey);
  const [anchorState, setAnchorState] = useState<{
    anchor: LogAnchor;
    queryKeyHash: string;
  } | null>(null);
  const [previousAutoRefresh, setPreviousAutoRefresh] = useState(autoRefresh);

  if (autoRefresh !== previousAutoRefresh) {
    setPreviousAutoRefresh(autoRefresh);
    if (autoRefresh) {
      setAnchorState(null);
    }
  }

  const anchorToLog = useCallback(
    (row: OurLogsResponseItem) => {
      queryClient.removeQueries({predicate: query => query.queryHash === queryKeyHash});
      setAnchorState({
        anchor: {
          id: row[OurLogKnownFieldKey.ID],
          timestampPrecise: BigInt(row[OurLogKnownFieldKey.TIMESTAMP_PRECISE]),
        },
        queryKeyHash,
      });
    },
    [queryClient, queryKeyHash]
  );

  const clearAnchor = useCallback(() => setAnchorState(null), []);

  const anchor =
    !autoRefresh && anchorState?.queryKeyHash === queryKeyHash
      ? anchorState.anchor
      : undefined;

  return {anchor, anchorToLog, clearAnchor};
}
