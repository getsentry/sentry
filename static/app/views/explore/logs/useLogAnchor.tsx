import {useCallback, useMemo, useState} from 'react';
import {hashKey, useQueryClient} from '@tanstack/react-query';
import {useQueryState} from 'nuqs';

import {defined} from 'sentry/utils/defined';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {
  LOGS_ANCHOR_TIMESTAMP_KEY,
  LOGS_ROW_ID_KEY,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {useLogsFrozenIsFrozen} from 'sentry/views/explore/logs/logsFrozenContext';
import {
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import type {LogsInfiniteQueryKey} from 'sentry/views/explore/logs/useLogsApiOptions';

export interface LogAnchor {
  id: string;
  timestampPrecise: bigint;
}

function useUrlLogAnchor() {
  const location = useLocation();
  const isFrozen = useLogsFrozenIsFrozen();
  const id = decodeScalar(location.query[LOGS_ROW_ID_KEY]);
  const timestampPrecise = decodeScalar(location.query[LOGS_ANCHOR_TIMESTAMP_KEY]);
  const [, setTimestampPrecise] = useQueryState(LOGS_ANCHOR_TIMESTAMP_KEY);

  const urlAnchor = useMemo(
    () =>
      isFrozen || !id || !timestampPrecise || !/^\d+$/.test(timestampPrecise)
        ? undefined
        : {id, timestampPrecise: BigInt(timestampPrecise)},
    [id, isFrozen, timestampPrecise]
  );

  const clearUrlAnchor = useCallback(() => {
    if (!isFrozen && defined(timestampPrecise)) {
      setTimestampPrecise(null);
    }
  }, [isFrozen, setTimestampPrecise, timestampPrecise]);

  return {urlAnchor, clearUrlAnchor};
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
  const {urlAnchor, clearUrlAnchor} = useUrlLogAnchor();
  const [anchorState, setAnchorState] = useState<{
    anchor: LogAnchor;
    queryKeyHash: string;
  } | null>(null);
  const [previousAutoRefresh, setPreviousAutoRefresh] = useState(autoRefresh);

  if (anchorState && anchorState.queryKeyHash !== queryKeyHash) {
    setAnchorState(null);
  }

  if (autoRefresh !== previousAutoRefresh) {
    setPreviousAutoRefresh(autoRefresh);
    if (autoRefresh) {
      setAnchorState(null);
    }
  }

  const anchorToLog = useCallback(
    (row: OurLogsResponseItem) => {
      queryClient.removeQueries({predicate: query => query.queryHash === queryKeyHash});
      clearUrlAnchor();
      setAnchorState({
        anchor: {
          id: row[OurLogKnownFieldKey.ID],
          timestampPrecise: BigInt(row[OurLogKnownFieldKey.TIMESTAMP_PRECISE]),
        },
        queryKeyHash,
      });
    },
    [clearUrlAnchor, queryClient, queryKeyHash]
  );

  const clearAnchor = useCallback(() => {
    clearUrlAnchor();
    setAnchorState(null);
  }, [clearUrlAnchor]);

  const anchor = autoRefresh
    ? undefined
    : anchorState?.queryKeyHash === queryKeyHash
      ? anchorState.anchor
      : urlAnchor;

  return {anchor, anchorToLog, clearAnchor};
}
