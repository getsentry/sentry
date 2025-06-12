import {useEffect, useMemo, useRef, useState} from 'react';

import usePageFilters from 'sentry/utils/usePageFilters';
import usePrevious from 'sentry/utils/usePrevious';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import type {useLogsPageDataQueryResult} from 'sentry/views/explore/contexts/logs/logsPageData';
import {useLogsAutoRefresh} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {createEmptyTimeseriesResults} from 'sentry/views/explore/logs/utils';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

/**
 * Streaming Timeseries Result
 *
 * Using the pages initial timeseries view, creates a streaming effect for timeseries charts by building a
 * buffer from streaming table data when autorefresh is on, creating interval buckets that match the underlying
 * timeseries intervals and adding table counts to those buckets.
 *
 * This can be moved to an endpoint in the future if there are logic differences.
 *
 *    Original Timeseries (from /event-stats API):
 *    ┌─────────────────────────────────────────────────────────────┐
 *    │ [01:00] [02:00] [03:00] [04:00] [05:00] [-----] [-----] ... │
 *    │   1       2       3       4       5      n/a    n/a         │
 *    └─────────────────────────────────────────────────────────────┘
 *                                   ↑
 *                        1 hour intervals (from 1 to 5)
 *
 *    Table Data (streaming in into interval buckets from the table):
 *    ┌─────────────────────────────────────────────────────────────┐
 *    │ [01:01] [02:02] [03:03] [04:04] [05:05] [06:06] [07:07] ... │
 *    │ log_a   log_b   log_c   log_d   log_e   log_f   log_g       │
 *    └─────────────────────────────────────────────────────────────┘
 *                          ↓
 *                   Bucketing Process
 *                   (logs assigned to nearest interval)
 *
 *    Buffer from streamed table data + original data (final result):
 *    ┌─────────────────────────────────────────────────────────────┐
 *    │ [01:00] [02:00] [03:00] [04:00] [05:00] [06:00] [07:00] ... │
 *    │  +1      +1      +1      +1      +1      +1      +1         │ ← From table
 *    │   1       2       3       4       5       1       1         │ ← Original
 *    │  ---     ---     ---     ---     ---     ---     ---        │
 *    │   2       3       4       5       6       1       1         │ ← Final result
 *    └─────────────────────────────────────────────────────────────┘
 *
 */

export function useStreamingTimeseriesResult(
  tableData: ReturnType<typeof useLogsPageDataQueryResult>,
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>
): ReturnType<typeof useSortedTimeSeries> {
  const autoRefresh = useLogsAutoRefresh();
  const pageFilters = usePageFilters();
  const [timeseriesIntervals, setTimeseriesIntervals] = useState<number[]>([]);
  const [emptyTimeseriesResult, setEmptyTimeseriesResult] = useState<Record<
    string,
    TimeSeries[]
  > | null>(null);
  const [bufferUpdateTrigger, setBufferUpdateTrigger] = useState(0);
  const bufferCountsRef = useRef<number[]>([]);
  const bufferFirstTimestampRef = useRef<number | null>(null);
  const latestTimestampSeenRef = useRef<number | null>(null);
  const timeseriesKeysRef = useRef<string[]>([]);
  const timeseriesDataRef = useRef<ReturnType<typeof useSortedTimeSeries>['data']>(null);
  const tableDataRef = useRef(tableData);
  const processedTimeseriesDataRef =
    useRef<ReturnType<typeof useSortedTimeSeries>['data']>(null);

  const previousTimeseriesIntervals = usePrevious(timeseriesIntervals);

  // Calculate interval duration for circular buffer
  const intervalDuration =
    timeseriesIntervals.length >= 2
      ? timeseriesIntervals[1]! - timeseriesIntervals[0]!
      : null;

  // Update tableData ref on every render to have latest data
  tableDataRef.current = tableData;

  // Create empty data for streaming when autoRefresh is enabled and original is empty
  useEffect(() => {
    if (!autoRefresh) {
      setEmptyTimeseriesResult(null);
      return;
    }

    // If we have no timeseries data or it's empty, create empty data for streaming
    if (!timeseriesResult.data || Object.keys(timeseriesResult.data).length === 0) {
      const emptyData = createEmptyTimeseriesResults(pageFilters.selection.datetime);
      setEmptyTimeseriesResult(emptyData);
    } else {
      setEmptyTimeseriesResult(null);
    }
  }, [autoRefresh, timeseriesResult.data, pageFilters.selection.datetime]);

  // Extract intervals from timeseries result (or empty data) and store keys
  useEffect(() => {
    const dataToProcess = emptyTimeseriesResult || timeseriesResult.data;

    if (!dataToProcess || Object.keys(dataToProcess).length === 0) {
      return;
    }

    // Skip if we've already processed this exact data reference
    if (processedTimeseriesDataRef.current === dataToProcess) {
      return;
    }

    // Store the keys and data for later use
    timeseriesKeysRef.current = Object.keys(dataToProcess);
    timeseriesDataRef.current = dataToProcess;
    processedTimeseriesDataRef.current = dataToProcess;

    const firstSeries = Object.values(dataToProcess)[0];
    if (firstSeries && firstSeries.length > 0) {
      const firstTimeSeries = firstSeries[0];
      if (firstTimeSeries && firstTimeSeries.values.length > 0) {
        const timestamps = firstTimeSeries.values.map(v => v.timestamp);
        if (!arraysEqual(timestamps, timeseriesIntervals)) {
          setTimeseriesIntervals(timestamps);
        }
      }
    }
  }, [timeseriesResult.data, emptyTimeseriesResult, timeseriesIntervals]);

  // Detect page refresh/query change and reset buffer
  useEffect(() => {
    if (
      previousTimeseriesIntervals &&
      !arraysEqual(previousTimeseriesIntervals, timeseriesIntervals)
    ) {
      // Intervals changed, assume page refresh - blow away buffer
      bufferCountsRef.current = [];
      bufferFirstTimestampRef.current = null;
      latestTimestampSeenRef.current = null;
      processedTimeseriesDataRef.current = null; // Reset processed data tracking
      setBufferUpdateTrigger(prev => prev + 1);
    }
  }, [timeseriesIntervals, previousTimeseriesIntervals]);

  // Process new table rows and update buffer - only when data actually changes
  useEffect(() => {
    if (
      !autoRefresh ||
      timeseriesIntervals.length === 0 ||
      timeseriesKeysRef.current.length === 0 ||
      !tableData?.data?.length ||
      intervalDuration === null
    ) {
      return;
    }

    // Initialize timestamp if not set yet
    if (latestTimestampSeenRef.current === null) {
      // Autorefresh only allows descending sort, so first row is newest, last row is oldest
      // Use the oldest timestamp (last row) to ensure all new data gets processed
      const lastRow = tableData.data[tableData.data.length - 1];
      const oldestRowTimestamp = Number(lastRow![OurLogKnownFieldKey.TIMESTAMP_PRECISE]);
      latestTimestampSeenRef.current = oldestRowTimestamp - 1000;
    }

    // Find new rows (those with timestamp > latestTimestampSeen)
    const newRows = tableData.data.filter(row => {
      const rowTimestamp = Number(row[OurLogKnownFieldKey.TIMESTAMP_PRECISE]);
      // Normalize timestamp to milliseconds for bucket matching
      const normalizedTimestamp =
        rowTimestamp < 1e12 ? rowTimestamp * 1000 : rowTimestamp;
      const normalizedLatest =
        latestTimestampSeenRef.current! < 1e12
          ? latestTimestampSeenRef.current! * 1000
          : latestTimestampSeenRef.current!;
      return normalizedTimestamp > normalizedLatest;
    });

    if (newRows.length === 0) {
      return;
    }

    // Update latest timestamp seen
    const newestRowTimestamp = Math.max(
      ...newRows.map(row => {
        const timestamp = Number(row[OurLogKnownFieldKey.TIMESTAMP_PRECISE]);
        return timestamp < 1e12 ? timestamp * 1000 : timestamp;
      })
    );
    latestTimestampSeenRef.current = newestRowTimestamp;

    // Update circular buffer with new rows
    const newCounts = [...bufferCountsRef.current];

    // Initialize buffer if empty
    if (newCounts.length === 0) {
      newCounts.length = timeseriesIntervals.length;
      newCounts.fill(0);
    }

    // Group new rows into buffer buckets
    newRows.forEach(row => {
      const rowTimestamp = Number(row[OurLogKnownFieldKey.TIMESTAMP_PRECISE]);
      const normalizedTimestamp =
        rowTimestamp < 1e12 ? rowTimestamp * 1000 : rowTimestamp;

      // Find which buffer bucket this row belongs to
      const bucketIndex = findBufferBucketIndex(
        normalizedTimestamp,
        timeseriesIntervals,
        intervalDuration
      );

      if (bucketIndex !== null && bucketIndex >= 0 && bucketIndex < newCounts.length) {
        newCounts[bucketIndex] = (newCounts[bucketIndex] || 0) + 1;
      }
    });

    bufferCountsRef.current = newCounts;

    // Set buffer first timestamp if not set
    if (bufferFirstTimestampRef.current === null && timeseriesIntervals.length > 0) {
      bufferFirstTimestampRef.current = timeseriesIntervals[0]!;
    }

    // Trigger re-render to update the streaming data
    setBufferUpdateTrigger(prev => prev + 1);
  }, [autoRefresh, timeseriesIntervals, tableData?.data, intervalDuration]);

  // Create streaming timeseries data when autoRefresh is enabled
  const streamingTimeseriesData = useMemo(() => {
    if (!autoRefresh) {
      return timeseriesResult.data;
    }

    // If we have buffer data, merge it with original data
    if (bufferCountsRef.current.length > 0 && bufferFirstTimestampRef.current !== null) {
      const originalData = timeseriesDataRef.current || timeseriesResult.data;
      if (!originalData) {
        return emptyTimeseriesResult || {};
      }

      // Merge original data with circular buffer
      const mergedData: Record<string, TimeSeries[]> = {};

      Object.keys(originalData).forEach(seriesKey => {
        const originalSeries = originalData[seriesKey];
        if (!originalSeries) return;

        mergedData[seriesKey] = originalSeries.map(series => {
          const mergedValues = series.values.map((value, index) => {
            // Map timeseries bucket to buffer bucket
            const bufferIndex = index < bufferCountsRef.current.length ? index : -1;
            const bufferCount =
              bufferIndex >= 0 ? bufferCountsRef.current[bufferIndex] || 0 : 0;

            return {
              ...value,
              value: (value.value || 0) + bufferCount,
            };
          });

          return {
            ...series,
            values: mergedValues,
          };
        });
      });

      return mergedData;
    }

    // If we have empty data (original timeseries was empty), use it
    if (emptyTimeseriesResult) {
      return emptyTimeseriesResult;
    }

    // Fallback to original data
    return timeseriesResult.data;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, bufferUpdateTrigger, emptyTimeseriesResult, timeseriesResult.data]);

  if (!autoRefresh) {
    return timeseriesResult;
  }

  return {
    ...timeseriesResult,
    data: streamingTimeseriesData,
  };
}

// Helper function to check if two arrays are equal
function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, index) => val === b[index]);
}

// Helper function to find which buffer bucket a timestamp belongs to
function findBufferBucketIndex(
  timestamp: number,
  intervals: number[],
  intervalDuration: number | null
): number | null {
  if (intervals.length === 0 || intervalDuration === null) {
    return null;
  }

  // Find the closest interval bucket
  for (let i = 0; i < intervals.length; i++) {
    const bucketStart = intervals[i];
    if (bucketStart === undefined) continue;

    const bucketEnd = bucketStart + intervalDuration;

    if (timestamp >= bucketStart && timestamp < bucketEnd) {
      return i;
    }
  }

  // If timestamp is beyond the last bucket, put it in the last bucket
  const lastInterval = intervals[intervals.length - 1];
  if (lastInterval !== undefined && timestamp >= lastInterval) {
    return intervals.length - 1;
  }

  return null;
}
