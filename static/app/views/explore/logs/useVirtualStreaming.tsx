import {useCallback, useEffect, useRef, useState} from 'react';
import {logger} from '@sentry/react';
import isEqual from 'lodash/isEqual';

import type {ApiResult} from 'sentry/api';
import type {InfiniteData} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePrevious from 'sentry/utils/usePrevious';
import {
  useLogsAutoRefreshContinued,
  useLogsAutoRefreshEnabled,
  useLogsRefreshInterval,
  useSetLogsAutoRefresh,
} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {
  MAX_LOG_INGEST_DELAY,
  VIRTUAL_STREAMED_INTERVAL_MS,
} from 'sentry/views/explore/logs/constants';
import type {
  EventsLogsResult,
  OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {useLogsQueryKeyWithInfinite} from 'sentry/views/explore/logs/useLogsQuery';

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
export function useVirtualStreaming({
  data,
  highFidelity,
}: {
  data: InfiniteData<ApiResult<EventsLogsResult>> | undefined;
  highFidelity?: boolean;
}) {
  const organization = useOrganization();
  const setLogsAutoRefresh = useSetLogsAutoRefresh();
  const autoRefresh = useLogsAutoRefreshEnabled();
  const previousAutoRefresh = usePrevious(autoRefresh);
  const isAutoRefreshContinued = useLogsAutoRefreshContinued();
  const refreshInterval = useLogsRefreshInterval();
  const rafOn = useRef(false);
  const [virtualTimestamp, setVirtualTimestamp] = useState<number | undefined>(undefined);
  const logsQueryKey = useLogsQueryKeyWithInfinite({
    referrer: 'api.explore.logs-table',
    autoRefresh: false,
    highFidelity,
  });
  const warnRef = useRef(() => {});
  const hasWarnedRef = useRef(false);
  const queryKeyString = JSON.stringify(logsQueryKey);
  const previousQueryKeyString = usePrevious(queryKeyString);

  const organizationRef = useRef(organization);

  useEffect(() => {
    if (previousQueryKeyString !== queryKeyString) {
      // We reset the virtual timestamp when the query key changes.
      setVirtualTimestamp(undefined);
    }
  }, [queryKeyString, previousQueryKeyString]);

  // If we've received data, initialize the virtual timestamp to be refreshEvery seconds before the max ingest delay timestamp
  const initializeVirtualTimestamp = useCallback(() => {
    if (!data?.pages?.length) {
      return;
    }

    const firstPageWithData = data.pages.find(page => page?.[0]?.data?.length > 0);
    const pageData = firstPageWithData?.[0]?.data;

    if (!pageData || pageData.length === 0) {
      return;
    }

    // Calculate the target timestamp: refreshEvery seconds before the max ingest delay
    const targetTimestamp = Date.now() - MAX_LOG_INGEST_DELAY - refreshInterval;

    // Find the first row with timestamp less than targetTimestamp
    let selectedRow = pageData[0];
    for (const row of pageData) {
      const rowTimestamp = Number(
        BigInt(row[OurLogKnownFieldKey.TIMESTAMP_PRECISE]) / 1_000_000n
      );
      if (rowTimestamp <= targetTimestamp) {
        selectedRow = row;
        break;
      }
    }

    const initialTimestamp = selectedRow
      ? Number(BigInt(selectedRow[OurLogKnownFieldKey.TIMESTAMP_PRECISE]) / 1_000_000n)
      : Number(
          BigInt(pageData[0]?.[OurLogKnownFieldKey.TIMESTAMP_PRECISE] ?? 0n) / 1_000_000n
        );

    setVirtualTimestamp(initialTimestamp);
  }, [data, refreshInterval]);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    if (virtualTimestamp === undefined) {
      // First time enabling autorefresh, initialize virtual timestamp.
      initializeVirtualTimestamp();
      return;
    }

    if (isAutoRefreshContinued) {
      // Re-enabling autorefresh with existing virtual timestamp, and within continue window, do nothing.
      return;
    }
    if (!isEqual(autoRefresh, previousAutoRefresh)) {
      // Re-enabling autorefresh with existing virtual timestamp, but outside continue window, reset virtual timestamp.
      initializeVirtualTimestamp();
    }
  }, [
    autoRefresh,
    initializeVirtualTimestamp,
    virtualTimestamp,
    isAutoRefreshContinued,
    previousAutoRefresh,
  ]);

  // Get the newest timestamp from the latest page to calculate how far behind we are
  const getMostRecentPageDataTimestamp = useCallback(() => {
    if (!data?.pages?.length) {
      return 0;
    }

    const latestPage = data.pages[data.pages.length - 1];
    const latestPageData = latestPage?.[0]?.data;
    const rawTimestamp = latestPageData?.[0]?.[OurLogKnownFieldKey.TIMESTAMP_PRECISE];

    if (!rawTimestamp) {
      return null;
    }

    // Since data is always sorted by timestamp descending, the first row (index 0) is the latest timestamp.
    return Number(BigInt(rawTimestamp) / 1_000_000n);
  }, [data]);

  // We only want to warn once per session, also warning shouldn't add to the dependencies of the RAF useEffect.
  warnRef.current = () => {
    if (hasWarnedRef.current) {
      return;
    }
    hasWarnedRef.current = true;

    logger.warn(
      `No most recent page data timestamp found, skipping virtual streaming update`,
      {
        logId:
          data?.pages?.[data.pages.length - 1]?.[0]?.data?.[0]?.[OurLogKnownFieldKey.ID],
        traceId:
          data?.pages?.[data.pages.length - 1]?.[0]?.data?.[0]?.[
            OurLogKnownFieldKey.TRACE_ID
          ],
        organization: organization.slug,
      }
    );
  };

  // We setup a RAF loop to update the virtual timestamp smoothly to emulate real-time streaming.
  useEffect(() => {
    let rafId = 0;
    rafOn.current = autoRefresh;

    if (autoRefresh) {
      const callback = () => {
        if (!rafOn.current) {
          return;
        }

        const targetVirtualTime = Date.now() - MAX_LOG_INGEST_DELAY - refreshInterval;
        const mostRecentPageDataTimestamp = getMostRecentPageDataTimestamp();

        if (mostRecentPageDataTimestamp === null) {
          warnRef.current();
          logger.info(
            'No most recent page data timestamp found, setting auto-refresh to error',
            {
              organization: organizationRef.current.slug,
            }
          );
          setLogsAutoRefresh('error');
          return;
        }

        setVirtualTimestamp(prev => {
          if (prev === undefined) {
            // We don't want the deps to include the virtual timestamp (to check if it's undefined), so we return the previous value if it's undefined.
            return prev;
          }

          return updateVirtualStreamingTimestamp({
            currentTimestamp: prev ?? 0,
            mostRecentPageDataTimestamp,
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
  }, [autoRefresh, getMostRecentPageDataTimestamp, refreshInterval, setLogsAutoRefresh]);

  return {
    virtualStreamedTimestamp: virtualTimestamp,
  };
}

/**
 * Checks if a log row should be visible in the virtual stream based on the current virtual timestamp.
 */
export function isRowVisibleInVirtualStream(
  row: OurLogsResponseItem,
  virtualStreamedTimestamp: number | undefined
): boolean {
  if (!virtualStreamedTimestamp) {
    return true;
  }

  const rowTimestamp = getApproximateTimestamp(row);

  // Show rows that are older than or equal to the virtual timestamp
  return rowTimestamp <= virtualStreamedTimestamp;
}

let timestampHasWarned = false;

function getApproximateTimestamp(row: {
  [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: number | string;
  [OurLogKnownFieldKey.TIMESTAMP]: string;
  [OurLogKnownFieldKey.ID]: string;
  [OurLogKnownFieldKey.TRACE_ID]: string;
}): number {
  if (row[OurLogKnownFieldKey.TIMESTAMP_PRECISE]) {
    return Number(BigInt(row[OurLogKnownFieldKey.TIMESTAMP_PRECISE]) / 1_000_000n);
  }
  if (!timestampHasWarned) {
    timestampHasWarned = true;
    logger.warn(`No timestamp precise found for log row, using timestamp instead`, {
      logId: row[OurLogKnownFieldKey.ID],
      traceId: row[OurLogKnownFieldKey.TRACE_ID],
      timestamp: row[OurLogKnownFieldKey.TIMESTAMP],
      timestampPrecise: row[OurLogKnownFieldKey.TIMESTAMP_PRECISE],
    });
  }
  return Number(new Date(row[OurLogKnownFieldKey.TIMESTAMP]).getTime());
}

/**
 * Updates the virtual timestamp for streaming based on current state and target time.
 * This function is extracted to be testable and mockable.
 */
export function updateVirtualStreamingTimestamp({
  currentTimestamp,
  mostRecentPageDataTimestamp,
  targetVirtualTime,
}: {
  currentTimestamp: number;
  mostRecentPageDataTimestamp: number;
  targetVirtualTime: number;
}): number {
  if (currentTimestamp > targetVirtualTime) {
    // If we're ahead of the target virtual time (eg. virtual time was just initialized), don't change the current virtual time.
    return currentTimestamp;
  }

  // Calculate how far behind we are based on latest data
  const timeBehind = mostRecentPageDataTimestamp - currentTimestamp;

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
