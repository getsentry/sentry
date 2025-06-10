import {useEffect, useMemo, useRef, useState} from 'react';

import usePrevious from 'sentry/utils/usePrevious';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import type {useLogsPageDataQueryResult} from 'sentry/views/explore/contexts/logs/logsPageData';
import {useLogsAutoRefresh} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

/**
 * Streaming Timeseries Result
 *
 * Creates a streaming effect for timeseries charts by building a buffer from table data
 * and creating interval buckets that match the underlying timeseries intervals.
 *
 *    Original Timeseries (from API):
 *    ┌─────────────────────────────────────────────────────────────┐
 *    │ [13:00] [12:30] [12:00] [11:30] [11:00] [10:30] [10:00] ... │
 *    │   9       7       3      15       8      12       5         │
 *    └─────────────────────────────────────────────────────────────┘
 *                                   ↑
 *                            30min intervals (descending)
 *
 *    Table Data (streaming in, descending timestamp):
 *    ┌─────────────────────────────────────────────────────────────┐
 *    │ [12:45] [12:42] [12:38] [12:35] [12:31] [12:28] [12:25] ... │
 *    │ log_a   log_b   log_c   log_d   log_e   log_f   log_g       │
 *    └─────────────────────────────────────────────────────────────┘
 *                          ↓
 *                   Buffer Building
 *
 *    Buffer Buckets (matching timeseries intervals, descending):
 *    ┌─────────────────────────────────────────────────────────────┐
 *    │ [13:00] [12:30] [12:00] [11:30] [11:00] [10:30] [10:00] ... │
 *    │   +0      +2      +0      +0      +0      +0      +0        │ ← From table
 *    │    9       7       3      15       8      12       5        │ ← Original
 *    │   ---     ---     ---     ---     ---     ---     ---       │
 *    │    9       9       3      15       8      12       5        │ ← Final result
 *    └─────────────────────────────────────────────────────────────┘
 *                          ↑
 *               Same number of buckets maintained,
 *               oldest dropped as new ones added
 *
 * The virtual streaming is already applied to the table data from the infinite query.
 */
export function useStreamingTimeseriesResult(
  tableData: ReturnType<typeof useLogsPageDataQueryResult>,
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>
): ReturnType<typeof useSortedTimeSeries> {
  const autoRefresh = useLogsAutoRefresh();
  const [bufferData, setBufferData] = useState<Record<string, TimeSeries[]>>({});
  const [latestTimestampSeen, setLatestTimestampSeen] = useState<number | null>(null);
  const [timeseriesIntervals, setTimeseriesIntervals] = useState<number[]>([]);
  const hasInitializedBuffer = useRef(false);
  const timeseriesKeysRef = useRef<string[]>([]);
  const timeseriesDataRef = useRef<ReturnType<typeof useSortedTimeSeries>['data']>(null);
  const tableDataLengthRef = useRef(0);

  const previousTimeseriesIntervals = usePrevious(timeseriesIntervals);

  // Track table data length to avoid unnecessary effects when data reference changes
  // but actual data hasn't changed meaningfully
  const currentTableDataLength = tableData?.data?.length ?? 0;
  const tableDataLengthChanged = tableDataLengthRef.current !== currentTableDataLength;
  if (tableDataLengthChanged) {
    tableDataLengthRef.current = currentTableDataLength;
  }

  // Extract intervals from timeseries result and store keys
  useEffect(() => {
    if (!timeseriesResult.data || Object.keys(timeseriesResult.data).length === 0) {
      return;
    }

    // Store the keys and data for later use
    timeseriesKeysRef.current = Object.keys(timeseriesResult.data);
    timeseriesDataRef.current = timeseriesResult.data;

    const firstSeries = Object.values(timeseriesResult.data)[0];
    if (firstSeries && firstSeries.length > 0) {
      const firstTimeSeries = firstSeries[0];
      if (firstTimeSeries && firstTimeSeries.values.length > 0) {
        const timestamps = firstTimeSeries.values.map(v => v.timestamp);
        setTimeseriesIntervals(timestamps);
      }
    }
  }, [timeseriesResult.data]);

  // Detect page refresh/query change and reset buffer
  useEffect(() => {
    if (
      previousTimeseriesIntervals &&
      !arraysEqual(previousTimeseriesIntervals, timeseriesIntervals)
    ) {
      // Intervals changed, assume page refresh - blow away buffer
      setBufferData({});
      setLatestTimestampSeen(null);
      hasInitializedBuffer.current = false;
    }
  }, [timeseriesIntervals, previousTimeseriesIntervals]);

  // Initialize buffer when autoRefresh is enabled and we have data
  useEffect(() => {
    if (
      !autoRefresh ||
      !timeseriesDataRef.current ||
      hasInitializedBuffer.current ||
      timeseriesIntervals.length === 0
    ) {
      return;
    }

    // Initialize buffer with current data and set initial timestamp
    setBufferData(timeseriesDataRef.current);

    // Set initial timestamp from first table row if available
    if (tableData?.data?.length && tableData.data[0]) {
      const firstRowTimestamp = Number(
        BigInt(tableData.data[0][OurLogKnownFieldKey.TIMESTAMP_PRECISE]) / 1_000_000n
      );
      setLatestTimestampSeen(firstRowTimestamp);
    }

    hasInitializedBuffer.current = true;
  }, [autoRefresh, timeseriesIntervals.length, currentTableDataLength, tableData?.data]);

  // Reset buffer when autoRefresh is disabled
  useEffect(() => {
    if (!autoRefresh) {
      hasInitializedBuffer.current = false;
      setBufferData({});
      setLatestTimestampSeen(null);
    }
  }, [autoRefresh]);

  // Process new table rows and update buffer - only when data actually changes
  useEffect(() => {
    if (
      !autoRefresh ||
      !tableData?.data?.length ||
      !latestTimestampSeen ||
      timeseriesIntervals.length === 0 ||
      timeseriesKeysRef.current.length === 0 ||
      !tableDataLengthChanged
    ) {
      return;
    }

    // Find new rows (those with timestamp > latestTimestampSeen)
    const newRows = tableData.data.filter(row => {
      const rowTimestamp = Number(
        BigInt(row[OurLogKnownFieldKey.TIMESTAMP_PRECISE]) / 1_000_000n
      );
      return rowTimestamp > latestTimestampSeen;
    });

    if (newRows.length === 0) {
      return;
    }

    // Update latest timestamp seen
    const newestRowTimestamp = Math.max(
      ...newRows.map(row =>
        Number(BigInt(row[OurLogKnownFieldKey.TIMESTAMP_PRECISE]) / 1_000_000n)
      )
    );
    setLatestTimestampSeen(newestRowTimestamp);

    // Update buffer data by creating new buckets from table data
    setBufferData(prevBuffer => {
      const newBuffer = {...prevBuffer};

      // For each series key we stored from the original timeseries
      timeseriesKeysRef.current.forEach(seriesKey => {
        const originalSeries = prevBuffer[seriesKey];
        if (!originalSeries) return;

        const updatedSeries = originalSeries.map(series => {
          // Create buckets that match the original intervals
          const newValues = [...series.values];

          // Group new rows into interval buckets
          const bucketCounts: Record<number, number> = {};

          newRows.forEach(row => {
            const rowTimestamp = Number(
              BigInt(row[OurLogKnownFieldKey.TIMESTAMP_PRECISE]) / 1_000_000n
            );

            // Find the bucket this row belongs to
            const bucketTimestamp = findBucketForTimestamp(
              rowTimestamp,
              timeseriesIntervals
            );
            if (bucketTimestamp !== null) {
              bucketCounts[bucketTimestamp] = (bucketCounts[bucketTimestamp] || 0) + 1;
            }
          });

          // Update the values with new counts, maintaining same number of buckets
          newValues.forEach((value, index) => {
            const bucketCount = bucketCounts[value.timestamp] || 0;
            if (bucketCount > 0) {
              newValues[index] = {
                ...value,
                value: (value.value || 0) + bucketCount,
              };
            }
          });

          return {
            ...series,
            values: newValues,
          };
        });

        newBuffer[seriesKey] = updatedSeries;
      });

      return newBuffer;
    });
  }, [
    autoRefresh,
    currentTableDataLength,
    latestTimestampSeen,
    timeseriesIntervals,
    tableDataLengthChanged,
    tableData?.data,
  ]);

  // Create streaming timeseries data when autoRefresh is enabled
  const streamingTimeseriesData = useMemo(() => {
    if (!autoRefresh || Object.keys(bufferData).length === 0) {
      return timeseriesResult.data;
    }

    return bufferData;
  }, [autoRefresh, bufferData, timeseriesResult.data]);

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

// Helper function to find which bucket a timestamp belongs to
function findBucketForTimestamp(timestamp: number, intervals: number[]): number | null {
  if (intervals.length === 0) {
    return null;
  }

  // Find the bucket that this timestamp should belong to
  // For now, find the closest interval (could be more sophisticated)
  let closest = intervals[0]!; // We know it exists because we checked length > 0
  let minDiff = Math.abs(timestamp - intervals[0]!);

  for (const interval of intervals) {
    const diff = Math.abs(timestamp - interval);
    if (diff < minDiff) {
      minDiff = diff;
      closest = interval;
    }
  }

  return closest;
}
