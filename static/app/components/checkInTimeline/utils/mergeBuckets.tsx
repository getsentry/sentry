import type {CheckInBucket as CheckInStats, JobTickData} from '../types';

import {getAggregateStatus} from './getAggregateStatus';
import {getAggregateStatusFromMultipleBuckets} from './getAggregateStatusFromMultipleBuckets';
import {isStatsBucketEmpty} from './isStatsBucketEmpty';
import {mergeStats} from './mergeStats';

function generateJobTickFromBucketWithStats<Status extends string>(
  bucket: CheckInStats<Status>,
  options?: Partial<JobTickData<Status>>
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

export function mergeBuckets<Status extends string>(
  statusPrecedent: Status[],
  data: CheckInStats<Status>[]
): JobTickData<Status>[] {
  const minTickWidth = 4;
  const jobTicks: JobTickData<Status>[] = [];

  data.reduce<JobTickData<Status> | null>((currentJobTick, [timestamp, stats], i) => {
    const statsEmpty = isStatsBucketEmpty(stats);

    // If no current job tick, we start the first one
    if (!currentJobTick) {
      return statsEmpty
        ? currentJobTick
        : generateJobTickFromBucketWithStats([timestamp, stats], {roundedLeft: true});
    }

    const bucketStatus = getAggregateStatus(statusPrecedent, stats);
    const currJobTickStatus = getAggregateStatus(statusPrecedent, currentJobTick.stats);

    // If the current stats are empty and our job tick has reached the min width, finalize the tick
    if (statsEmpty && currentJobTick.width >= minTickWidth) {
      currentJobTick.roundedRight = true;
      jobTicks.push(currentJobTick);
      return null;
    }

    // Calculate the aggregate status for the next minTickWidth buckets
    const nextTickAggregateStatus = getAggregateStatusFromMultipleBuckets(
      statusPrecedent,
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
      stats: mergeStats(statusPrecedent, currentJobTick.stats, stats),
      width: currentJobTick.width + 1,
    };

    // Ensure we render the last tick if it's the final bucket
    if (i === data.length - 1) {
      currentJobTick.roundedRight = true;
      jobTicks.push(currentJobTick);
    }

    return currentJobTick;
  }, null);

  return jobTicks;
}
