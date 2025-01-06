import {filterMonitorStatsBucketByEnv} from 'sentry/views/monitors/components/timeline/utils/filterMonitorStatsBucketByEnv';

import type {
  JobTickData,
  JobTickDataWithStats,
  MonitorBucket,
  MonitorBucketWithStats,
} from '../types';

import {
  getAggregateStatus,
  getAggregateStatusFromStatsBucket,
} from './getAggregateStatus';
import {
  getAggregateStatusFromMultipleBuckets,
  getAggregateStatusFromMultipleStatsBuckets,
} from './getAggregateStatusFromMultipleBuckets';
import {isEnvMappingEmpty, isStatsBucketEmpty} from './isEnvMappingEmpty';
import {mergeEnvMappings, mergeStats} from './mergeEnvMappings';

function generateJobTickFromBucket(
  bucket: MonitorBucket,
  options?: Partial<JobTickData>
) {
  const [timestamp, envMapping] = bucket;
  return {
    endTs: timestamp,
    startTs: timestamp,
    width: 1,
    envMapping,
    roundedLeft: false,
    roundedRight: false,
    ...options,
  };
}

function generateJobTickFromBucketWithStats(
  bucket: MonitorBucketWithStats,
  options?: Partial<JobTickDataWithStats>
) {
  const [timestamp, stats] = bucket;
  return {
    endTs: timestamp,
    startTs: timestamp,
    width: 1,
    stats,
    roundedLeft: false,
    roundedRight: false,
    ...options,
  };
}

export function mergeBuckets(data: MonitorBucket[], environment: string) {
  const minTickWidth = 4;

  const jobTicks: JobTickData[] = [];
  data.reduce(
    (currentJobTick, bucket, i) => {
      const filteredBucket = filterMonitorStatsBucketByEnv(bucket, environment);

      const [timestamp, envMapping] = filteredBucket;
      const envMappingEmpty = isEnvMappingEmpty(envMapping);
      if (!currentJobTick) {
        return envMappingEmpty
          ? currentJobTick
          : generateJobTickFromBucket(filteredBucket, {roundedLeft: true});
      }
      const bucketStatus = getAggregateStatus(envMapping);
      const currJobTickStatus = getAggregateStatus(currentJobTick.envMapping);
      // If the current bucket is empty and our job tick has reached a min width
      if (envMappingEmpty && currentJobTick.width >= minTickWidth) {
        // Then add our current tick to the running list of job ticks to render
        currentJobTick.roundedRight = true;
        jobTicks.push(currentJobTick);

        return null;
      }

      const nextTickAggregateStatus = getAggregateStatusFromMultipleBuckets(
        data.slice(i, i + minTickWidth).map(([_, envData]) => envData)
      );
      // If the next buckets have a different status from our current job tick
      if (
        bucketStatus !== currJobTickStatus &&
        nextTickAggregateStatus !== currJobTickStatus &&
        currentJobTick.width >= minTickWidth
      ) {
        // Then add our current tick to the running list of job ticks to render
        jobTicks.push(currentJobTick);
        return generateJobTickFromBucket(filteredBucket);
      }

      // Merge our current tick with the current bucket data
      currentJobTick = {
        ...currentJobTick,
        endTs: timestamp,
        envMapping: mergeEnvMappings(currentJobTick.envMapping, envMapping),
        width: currentJobTick.width + 1,
      };

      // Ensure we render the last tick
      if (i === data.length - 1) {
        currentJobTick.roundedRight = true;
        jobTicks.push(currentJobTick);
      }
      return currentJobTick;
    },
    null as JobTickData | null
  );

  return jobTicks;
}

export function mergeBucketsWithStats(
  data: MonitorBucketWithStats[]
): JobTickDataWithStats[] {
  const minTickWidth = 4;
  const jobTicks: JobTickDataWithStats[] = [];

  data.reduce(
    (currentJobTick: JobTickDataWithStats | null, [timestamp, stats], i) => {
      const statsEmpty = isStatsBucketEmpty(stats);

      // If no current job tick, we start the first one
      if (!currentJobTick) {
        return statsEmpty
          ? currentJobTick
          : generateJobTickFromBucketWithStats([timestamp, stats], {roundedLeft: true});
      }

      const bucketStatus = getAggregateStatusFromStatsBucket(stats);
      const currJobTickStatus = getAggregateStatusFromStatsBucket(currentJobTick.stats);

      // If the current stats are empty and our job tick has reached the min width, finalize the tick
      if (statsEmpty && currentJobTick.width >= minTickWidth) {
        currentJobTick.roundedRight = true;
        jobTicks.push(currentJobTick);
        return null;
      }

      // Calculate the aggregate status for the next minTickWidth buckets
      const nextTickAggregateStatus = getAggregateStatusFromMultipleStatsBuckets(
        data.slice(i, i + minTickWidth).map(([_, sliceStats]) => sliceStats)
      );

      // If the status changes or we reach the min width, push the current tick and start a new one
      if (
        bucketStatus !== currJobTickStatus &&
        nextTickAggregateStatus !== currJobTickStatus &&
        currentJobTick.width >= minTickWidth
      ) {
        jobTicks.push(currentJobTick);
        return generateJobTickFromBucketWithStats([timestamp, stats]);
      }

      // Otherwise, continue merging data into the current job tick
      currentJobTick = {
        ...currentJobTick,
        endTs: timestamp,
        stats: mergeStats(currentJobTick.stats, stats),
        width: currentJobTick.width + 1,
      };

      // Ensure we render the last tick if it's the final bucket
      if (i === data.length - 1) {
        currentJobTick.roundedRight = true;
        jobTicks.push(currentJobTick);
      }

      return currentJobTick;
    },
    null as JobTickDataWithStats | null
  );

  return jobTicks;
}
