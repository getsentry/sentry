import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import type {ApiResult} from 'sentry/api';
import type {InfiniteData} from 'sentry/utils/queryClient';
import {useLogsAutoRefresh} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {
  LOG_INGEST_DELAY,
  VIRTUAL_STREAMED_INTERVAL_MS,
} from 'sentry/views/explore/logs/constants';
import type {
  EventsLogsResult,
  OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

/**
 * Virtual Streaming
 *
 * Creates a streaming effect where logs appear to stream in real-time even though
 * we're fetching them in chunks via polling. Works by keeping a "virtual timestamp" that moves
 * forward over time, hiding rows that are "in the future" relative to this virtual time.
 *
 *    What we actually have (all the data):
 *    ┌─────────────────────────────────────────────────────────────┐
 *    │ [log1] [log2] [log3] [log4] [log5] [log6] [log7] [log8] ... │
 *    │   10s    15s    20s    25s    30s    35s    40s    45s      │
 *    └─────────────────────────────────────────────────────────────┘
 *
 *    What the user sees (virtual stream head at 22s):
 *                            ↓
 *    ┌─────────────────────────────────────────────────────────────┐
 *    │ [log1] [log2] [log3] [••••] [••••] [••••] [••••] [••••] ... │
 *    │   10s    15s    20s   HIDDEN HIDDEN HIDDEN HIDDEN           │
 *    └─────────────────────────────────────────────────────────────┘
 *                            ↑
 *                      stream head moves right →
 *
 *    A bit later (stream head at 32s):
 *                                     ↓
 *    ┌─────────────────────────────────────────────────────────────┐
 *    │ [log1] [log2] [log3] [log4] [log5] [••••] [••••] [••••] ... │
 *    │   10s    15s    20s    25s    30s  HIDDEN HIDDEN HIDDEN     │
 *    └─────────────────────────────────────────────────────────────┘
 *
 */
export function useVirtualStreaming(
  data: InfiniteData<ApiResult<EventsLogsResult>> | undefined
) {
  const autoRefresh = useLogsAutoRefresh();
  const rafOn = useRef(false);
  const hasInitialized = useRef(false);
  const [virtualTimestamp, setVirtualTimestamp] = useState<number | undefined>(undefined);

  const initializeVirtualTimestamp = useCallback(() => {
    if (!data?.pages?.length || hasInitialized.current) {
      return;
    }

    const firstPageWithData = data.pages.find(page => page?.[0]?.data?.length > 0);

    if (!firstPageWithData) {
      return;
    }

    const pageData = firstPageWithData[0]?.data;

    if (!pageData || pageData.length === 0) {
      return;
    }

    // We use the first row which will show up in the table with the <= virtual time condition.
    const firstRow = pageData[0];
    if (firstRow) {
      const firstRowTimestamp = Number(
        BigInt(firstRow[OurLogKnownFieldKey.TIMESTAMP_PRECISE]) / 1_000_000n
      );
      setVirtualTimestamp(firstRowTimestamp);
    }

    hasInitialized.current = true;
  }, [data]);

  // Get the newest timestamp from the latest page to calculate how far behind we are
  const getLatestTimestamp = useCallback(() => {
    if (!data?.pages?.length) {
      return 0;
    }

    const latestPage = data.pages[data.pages.length - 1];
    const latestPageData = latestPage?.[0]?.data;

    if (!latestPageData?.length) {
      return 0;
    }

    // Since data is descending sorted, newest timestamp is the first row
    const newestRow = latestPageData[0];
    if (!newestRow) {
      return 0;
    }

    return Number(BigInt(newestRow[OurLogKnownFieldKey.TIMESTAMP_PRECISE]) / 1_000_000n);
  }, [data]);

  useEffect(() => {
    let rafId = 0;
    rafOn.current = autoRefresh;

    if (autoRefresh) {
      const callback = () => {
        if (!rafOn.current) {
          return;
        }

        const targetVirtualTime = Date.now() - LOG_INGEST_DELAY;
        const latestTimestamp = getLatestTimestamp();

        setVirtualTimestamp(prev => {
          if (!prev) {
            return prev;
          }

          return updateVirtualStreamingTimestamp({
            currentTimestamp: prev,
            latestTimestamp,
            targetVirtualTime,
          });
        });

        rafId = requestAnimationFrame(callback);
      };

      rafId = requestAnimationFrame(callback);
    }

    return () => {
      rafOn.current = false;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [autoRefresh, getLatestTimestamp]);

  // Initialize when auto refresh is enabled and we have data
  useEffect(() => {
    if (autoRefresh && data?.pages?.length && !hasInitialized.current) {
      initializeVirtualTimestamp();
    }
  }, [autoRefresh, data, initializeVirtualTimestamp]);

  // Reset when auto refresh is disabled
  useEffect(() => {
    if (!autoRefresh) {
      hasInitialized.current = false;
      setVirtualTimestamp(undefined);
    }
  }, [autoRefresh]);

  const virtualStreamedTimestamp = useMemo(() => {
    if (!autoRefresh || !virtualTimestamp) {
      return undefined;
    }

    // Don't apply any buffer - we want to show data starting from our initialized timestamp
    return virtualTimestamp;
  }, [autoRefresh, virtualTimestamp]);

  return {
    virtualStreamedTimestamp,
  };
}

/**
 * Checks if a log row should be visible in the virtual stream based on the current virtual timestamp.
 *
 * @param row - The log row to check
 * @param virtualStreamedTimestamp - The current virtual streaming timestamp (in milliseconds)
 * @returns true if the row should be visible, false if it should be filtered out
 */
export function isRowVisibleInVirtualStream(
  row: OurLogsResponseItem,
  virtualStreamedTimestamp: number | undefined
): boolean {
  if (!virtualStreamedTimestamp) {
    return true;
  }

  const rowTimestamp = BigInt(row[OurLogKnownFieldKey.TIMESTAMP_PRECISE]) / 1_000_000n;

  // Show rows that are older than or equal to the virtual timestamp
  return rowTimestamp <= virtualStreamedTimestamp;
}

/**
 * Updates the virtual timestamp for streaming based on current state and target time.
 * This function is extracted to be testable and mockable.
 */
export function updateVirtualStreamingTimestamp({
  currentTimestamp,
  latestTimestamp,
  targetVirtualTime,
}: {
  currentTimestamp: number;
  latestTimestamp: number;
  targetVirtualTime: number;
}): number {
  // Calculate how far behind we are based on latest data
  const timeBehind = latestTimestamp - currentTimestamp;

  // Catch up proportionally, but cap at 3 intervals per update
  const maxCatchUp = VIRTUAL_STREAMED_INTERVAL_MS * 3;
  const proportionalCatchUp = Math.min(
    timeBehind * 0.1, // Catch up at 10% of the gap per update
    maxCatchUp
  );

  let newTimestamp = currentTimestamp;

  // If we're significantly behind, use proportional catch-up
  if (timeBehind > VIRTUAL_STREAMED_INTERVAL_MS * 2) {
    newTimestamp = currentTimestamp + proportionalCatchUp;
  } else {
    // Normal progression
    newTimestamp = currentTimestamp + VIRTUAL_STREAMED_INTERVAL_MS;
  }

  // Don't exceed the target virtual time
  return Math.min(newTimestamp, targetVirtualTime);
}
