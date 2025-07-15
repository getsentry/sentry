import type {RefObject} from 'react';
import {useEffect, useMemo, useRef} from 'react';
import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';

import {defined} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import usePrevious from 'sentry/utils/usePrevious';
import type {
  TimeSeries,
  TimeSeriesItem,
} from 'sentry/views/dashboards/widgets/common/types';
import type {useLogsPageDataQueryResult} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  useLogsAutoRefresh,
  useLogsGroupBy,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {
  getLogRowTimestampMillis,
  getLogTimestampBucketIndex,
} from 'sentry/views/explore/logs/utils';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

type BufferEntry = {
  bucketIndex: number;
  count: number;
};

type BufferedTimeseriesGroup = {
  stableIndex: number;
  values: BufferEntry[];
};

/**
 * Streaming Timeseries Result
 *
 * Creates a streaming effect for timeseries charts by building a buffer from streaming table data when autorefresh is on.
 * Creates interval buckets that match the underlying timeseries intervals and adding table counts to those buckets.
 *
 * The streaming approach is as follows:
 * 1. Start accumulating table data from the last timeseries bucket onwards
 * 2. Replace (don't merge) the last bucket with fresh counts since we can't be sure which log item was counted in the original timeseries bucket.
 * 3. Maintain fixed-length buffers that match the original timeseries intervals for visual consistency, shifting out old data as new data arrives
 * 4. Only recalculate buckets from the beginning of the bucket containing the current virtual time onwards to not recount logs
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
 *                   (logs assigned to nearest interval, but only from the last bucket in timeseries onwards)
 *
 *    Buffer from streamed table data + original data (final result):
 *    ┌─────────────────────────────────────────────────────────────┐
 *    │ [01:00] [02:00] [03:00] [04:00] [05:00] [06:00] [07:00] ... │
 *    │  +0      +0      +0      +0       1       1       1         │ ← From table
 *    │   1       2       3       4    replaced  n/a     n/a        │ ← Original
 *    │  ---     ---     ---     ---     ---     ---     ---        │
 *    │   1       2       3       4       1       1       1         │ ← Final result
 *    └─────────────────────────────────────────────────────────────┘
 *                                        ↑ Replace the last timeseries bucket with the table data
 */

export function useStreamingTimeseriesResult(
  tableData: ReturnType<typeof useLogsPageDataQueryResult>,
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>
): ReturnType<typeof useSortedTimeSeries> {
  const organization = useOrganization();
  const groupByKey = useLogsGroupBy();
  const autoRefresh = useLogsAutoRefresh();
  const {selection} = usePageFilters();
  const previousSelection = usePrevious(selection);

  const groupBuffersRef = useRef<Record<string, BufferedTimeseriesGroup>>({});
  const lastProcessedBucketRef = useRef<number | null>(null);

  const timeseriesValues = timeseriesResult.data
    ? Object.values(timeseriesResult.data)[0]?.[0]?.values
    : undefined;
  const shouldUseStreamedData =
    organization.features.includes('ourlogs-live-refresh') && !!timeseriesValues?.length;

  const timeseriesStartTimestamp = timeseriesValues?.[0]?.timestamp;
  const timeseriesLastTimestamp =
    timeseriesValues?.[timeseriesValues.length - 1]?.timestamp;
  const timeseriesNextTimestamp = timeseriesValues?.[1]?.timestamp;
  const timeseriesIntervalDuration =
    timeseriesNextTimestamp &&
    timeseriesStartTimestamp &&
    timeseriesNextTimestamp - timeseriesStartTimestamp > 0
      ? timeseriesNextTimestamp - timeseriesStartTimestamp
      : null;
  const timeseriesLastBucketIndex = timeseriesValues?.length
    ? timeseriesValues.length - 1
    : null;

  useEffect(() => {
    if (autoRefresh || !isEqual(selection, previousSelection)) {
      groupBuffersRef.current = {};
      lastProcessedBucketRef.current = null;
    }
  }, [autoRefresh, selection, previousSelection]);

  const groupBuffers = useMemo(() => {
    const buffers = createBufferFromTableData(
      shouldUseStreamedData,
      tableData.data,
      timeseriesValues,
      timeseriesLastBucketIndex,
      timeseriesStartTimestamp,
      timeseriesLastTimestamp,
      timeseriesIntervalDuration,
      groupByKey,
      groupBuffersRef.current,
      lastProcessedBucketRef,
      autoRefresh,
      timeseriesResult.data ? Object.values(timeseriesResult.data)[0] : undefined
    );
    groupBuffersRef.current = buffers;
    return {...buffers};
  }, [
    shouldUseStreamedData,
    tableData.data,
    timeseriesValues,
    timeseriesLastBucketIndex,
    timeseriesStartTimestamp,
    timeseriesLastTimestamp,
    timeseriesIntervalDuration,
    groupByKey,
    autoRefresh,
    timeseriesResult.data,
  ]);

  return useMemo(() => {
    const mergedData = createMergedDataFromBuffer(
      shouldUseStreamedData,
      timeseriesResult,
      groupBuffers,
      timeseriesStartTimestamp,
      timeseriesIntervalDuration,
      timeseriesLastBucketIndex
    );

    return {
      ...timeseriesResult,
      data: mergedData,
    };
  }, [
    timeseriesResult,
    groupBuffers,
    shouldUseStreamedData,
    timeseriesStartTimestamp,
    timeseriesIntervalDuration,
    timeseriesLastBucketIndex,
  ]);
}

function createBufferFromTableData(
  shouldUseStreamedData: boolean,
  tableRows: OurLogsResponseItem[] | undefined,
  timeseriesValues: TimeSeriesItem[] | undefined,
  timeseriesLastBucketIndex: number | null,
  timeseriesStartTimestamp: number | undefined,
  timeseriesLastTimestamp: number | undefined,
  timeseriesIntervalDuration: number | null,
  groupBy: string | undefined,
  groupBuffers: Record<string, BufferedTimeseriesGroup>,
  lastProcessedBucketRef: RefObject<number | null>,
  autoRefresh: boolean,
  originalTimeseries?: TimeSeries[]
) {
  if (
    !shouldUseStreamedData ||
    !timeseriesStartTimestamp ||
    !timeseriesLastTimestamp ||
    !timeseriesIntervalDuration ||
    !defined(timeseriesLastBucketIndex) ||
    !timeseriesValues ||
    !autoRefresh
  ) {
    return groupBuffers;
  }

  if (!tableRows?.length || !tableRows[0]) {
    return groupBuffers;
  }

  if (lastProcessedBucketRef.current === null) {
    lastProcessedBucketRef.current = timeseriesLastBucketIndex - 2;
  }

  const firstRowTimestamp = getLogRowTimestampMillis(tableRows[0]);
  if (firstRowTimestamp) {
    // Remove buckets from lastProcessedBucket onwards to reprocess them
    Object.values(groupBuffers).forEach(buffer => {
      buffer.values = buffer.values.filter(
        entry => entry.bucketIndex < lastProcessedBucketRef.current!
      );
    });
  }

  for (const row of tableRows) {
    const timestamp = getLogRowTimestampMillis(row);
    if (!timestamp) {
      continue;
    }

    const rowBucketIndex = getLogTimestampBucketIndex(
      timestamp,
      timeseriesStartTimestamp,
      timeseriesIntervalDuration
    );

    if (rowBucketIndex < lastProcessedBucketRef.current) {
      continue;
    }

    const groupValue = groupBy ? String(row[groupBy] ?? '') : '';

    if (!groupBuffers[groupValue]) {
      groupBuffers[groupValue] = {
        stableIndex: getStableIndex(groupValue, groupBuffers, originalTimeseries),
        values: [],
      };
    }

    const buffer = groupBuffers[groupValue];
    const existingEntry = buffer.values.find(
      entry => entry.bucketIndex === rowBucketIndex
    );

    if (existingEntry) {
      existingEntry.count += 1;
    } else {
      buffer.values.unshift({bucketIndex: rowBucketIndex, count: 1});
    }
  }

  // Move last processed bucket ahead to avoid recounting logs into old buckets
  if (firstRowTimestamp) {
    const streamHeadBucket = getLogTimestampBucketIndex(
      firstRowTimestamp,
      timeseriesStartTimestamp,
      timeseriesIntervalDuration
    );

    lastProcessedBucketRef.current = streamHeadBucket - 1;
  }

  Object.keys(groupBuffers).forEach(groupValue => {
    const buffer = groupBuffers[groupValue];
    if (buffer?.values) {
      buffer.values.sort((a, b) => a.bucketIndex - b.bucketIndex);
    }
  });

  Object.keys(groupBuffers).forEach(groupValue => {
    const buffer = groupBuffers[groupValue];
    if (buffer?.values && buffer.values.length > timeseriesValues.length) {
      const maxBucketIndex = Math.max(...buffer.values.map(entry => entry.bucketIndex));
      const minBucketIndex = maxBucketIndex - timeseriesValues.length + 1;
      buffer.values = buffer.values.filter(entry => entry.bucketIndex >= minBucketIndex);
    }
  });

  return groupBuffers;
}

function createMergedDataFromBuffer(
  shouldUseStreamedData: boolean,
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>,
  groupBuffers: Record<string, BufferedTimeseriesGroup>,
  timeseriesStartTimestamp: number | undefined,
  timeseriesIntervalDuration: number | null,
  timeseriesLastBucketIndex: number | null
): typeof timeseriesResult.data {
  if (!shouldUseStreamedData) {
    return timeseriesResult.data;
  }

  if (
    !timeseriesStartTimestamp ||
    !timeseriesIntervalDuration ||
    timeseriesLastBucketIndex === null
  ) {
    return timeseriesResult.data;
  }

  const mergedData: typeof timeseriesResult.data = {};
  const aggregateKey = Object.keys(timeseriesResult.data)[0];

  if (!aggregateKey) {
    return timeseriesResult.data;
  }

  mergedData[aggregateKey] = [];
  const originalGroupedTimeSeries = timeseriesResult.data[aggregateKey];
  const targetLength = originalGroupedTimeSeries?.[0]?.values.length;

  if (!Array.isArray(originalGroupedTimeSeries) || !targetLength) {
    return timeseriesResult.data;
  }

  const hasBufferData = Object.keys(groupBuffers).length > 0;
  let maxBucketIndex = timeseriesLastBucketIndex;
  let minBucketIndex = timeseriesLastBucketIndex;

  if (hasBufferData) {
    maxBucketIndex = Math.max(
      ...Object.values(groupBuffers).flatMap(buffer =>
        buffer.values.map(entry => entry.bucketIndex)
      )
    );
    minBucketIndex = Math.min(
      ...Object.values(groupBuffers).flatMap(buffer =>
        buffer.values.map(entry => entry.bucketIndex)
      )
    );
  }

  const allGroupValues = new Set([
    ...originalGroupedTimeSeries.map(series => series.yAxis),
    ...Object.keys(groupBuffers),
  ]);

  Array.from(allGroupValues).forEach(groupValue => {
    const originalSeries = originalGroupedTimeSeries.find(
      series => series.yAxis === groupValue
    );
    const groupBuffer = groupBuffers[groupValue];

    if (!hasBufferData && originalSeries) {
      if (mergedData[aggregateKey]) {
        mergedData[aggregateKey].push(originalSeries);
      }
      return;
    }

    const mergedValues: TimeSeriesItem[] = [];

    for (
      let i = maxBucketIndex;
      i >= minBucketIndex && mergedValues.length < targetLength;
      i--
    ) {
      const entry = groupBuffer?.values.find(e => e.bucketIndex === i);

      const mergedValue: TimeSeriesItem = {
        timestamp: timeseriesStartTimestamp + i * timeseriesIntervalDuration,
        value: 0,
      };
      if (!entry) {
        if (i === maxBucketIndex) {
          mergedValue.incomplete = true;
        }
        mergedValues.unshift(mergedValue);
        continue;
      }

      mergedValue.value = entry.count;
      if (i === maxBucketIndex) {
        mergedValue.incomplete = true;
      }
      mergedValues.unshift(mergedValue);
    }

    for (let i = minBucketIndex - 1; i >= 0 && mergedValues.length < targetLength; i--) {
      const originalValue = originalSeries?.values[i] ?? {
        timestamp: timeseriesStartTimestamp + i * timeseriesIntervalDuration,
        value: 0,
      }; // If original series is not found, it means it's either a new group that doesn't exist in the original timeseries, or we received empty table data for a period of time so we need to backfill with zeros.
      if (originalValue) {
        mergedValues.unshift(originalValue);
      }
    }

    if (mergedData[aggregateKey] && originalGroupedTimeSeries[0]) {
      mergedData[aggregateKey].push({
        ...(originalSeries ?? {
          ...pick(originalGroupedTimeSeries[0], ['dataScanned', 'confidence']),
          meta: {
            ...originalGroupedTimeSeries[0].meta,
            order: groupBuffer?.stableIndex ?? 0,
          },
        }),
        values: mergedValues,
        yAxis: groupValue,
      });
    }
  });

  mergedData[aggregateKey].sort((a, b) => (a.meta.order ?? 0) - (b.meta.order ?? 0));

  return mergedData;
}

/**
 * A stable index is used to ensure that the order of the series in the timeseries data is consistent otherwise the colors randomly change.
 *
 * 1. If the group value already exists in the originalTimeseries, return the index of the originalTimeseries.
 * 2. If the group value does not exist in the originalTimeseries, but exists in the groupBuffers, return the index of the groupBuffers.
 * 3. If the group value does not exist in the originalTimeseries or the groupBuffers, return the next available index.
 */
function getStableIndex(
  groupValue: string,
  groupBuffers: Record<string, BufferedTimeseriesGroup>,
  originalTimeseries?: TimeSeries[]
): number {
  if (originalTimeseries) {
    const originalIndex = originalTimeseries.findIndex(
      series => series.yAxis === groupValue
    );
    if (originalIndex >= 0) {
      return originalIndex;
    }
  }

  if (groupBuffers[groupValue]) {
    return groupBuffers[groupValue].stableIndex;
  }

  const allYAxisValues = new Set([
    ...(originalTimeseries?.map(series => series.yAxis) ?? []),
    ...Object.keys(groupBuffers),
  ]);

  return allYAxisValues.size;
}
