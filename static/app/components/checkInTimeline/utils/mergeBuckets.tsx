import chunk from 'lodash/chunk';

import type {CheckInBucket as CheckInStats, JobTickData, RollupConfig} from '../types';

import {getAggregateStatus} from './getAggregateStatus';
import {isStatsBucketEmpty} from './isStatsBucketEmpty';
import {mergeStats} from './mergeStats';

// The smallest size in pixels that a tick should be represented on the timeline
const MINIMUM_TICK_WIDTH = 4;

type MakeOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

function makeTick<Status extends string>(
  options: MakeOptional<JobTickData<Status>, 'isStarting' | 'isEnding'>
): JobTickData<Status> {
  return {
    isStarting: false,
    isEnding: false,
    ...options,
  };
}

export function mergeBuckets<Status extends string>(
  statusPrecedent: Status[],
  rollupConfig: RollupConfig,
  data: Array<CheckInStats<Status>>
): Array<JobTickData<Status>> {
  const {bucketPixels, interval} = rollupConfig;

  const jobTicks: Array<JobTickData<Status>> = [];

  // In the case where multiple buckets fit into a single pixel partition the
  // buckets together so we have a single bucket per pixel to deal with
  const groupedBuckets =
    bucketPixels < 1 ? chunk(data, 1 / bucketPixels) : data.map(d => [d]);

  // How many pixels does each one of our bucket groups take up?
  const width = Math.max(1, bucketPixels);

  // Take groupedBuckets to fill up ticks until we can't anymore
  groupedBuckets.forEach((currentGroup, index) => {
    const lastTick = jobTicks.at(-1);

    const lastTickBigEnough = lastTick && lastTick.width >= MINIMUM_TICK_WIDTH;

    const left = index * width;

    const startTs = currentGroup?.at(0)![0];
    const endTs = currentGroup.at(-1)![0] + interval;
    const stats = mergeStats(statusPrecedent, ...currentGroup.map(b => b[1]));

    const emptyBucket = isStatsBucketEmpty(stats);

    // Nothing to do if we don't have any data yet
    if (emptyBucket && !lastTick) {
      return;
    }

    // No data, either expand the previous bucket if it's not big enough or cap
    // off the last tick.
    if (emptyBucket && lastTick) {
      if (lastTickBigEnough === true) {
        lastTick.isEnding = true;
      } else {
        lastTick.endTs = endTs;
        lastTick.width += width;
      }
      return;
    }

    const startingNewTick = lastTick?.isEnding;
    const isFirstTick = !lastTick;

    if (isFirstTick || (startingNewTick && lastTickBigEnough === true)) {
      const tick = makeTick({stats, startTs, endTs, left, width, isStarting: true});
      jobTicks.push(tick);
      return;
    }

    const currentStatus = getAggregateStatus(statusPrecedent, stats);
    const lastTickStatus = lastTick?.stats
      ? getAggregateStatus(statusPrecedent, lastTick.stats)
      : null;

    // We are extending the previous tick if the status's are equal OR if the
    // previous bucket has not reached it's minimum size yet.
    if (currentStatus === lastTickStatus || lastTickBigEnough === false) {
      lastTick.endTs = endTs;
      lastTick.stats = mergeStats(statusPrecedent, lastTick.stats, stats);
      lastTick.width += width;

      // If we extended the previous tick and the status didn't change there's
      // nothing left to do
      if (lastTickStatus === getAggregateStatus(statusPrecedent, lastTick.stats)) {
        return;
      }

      // We've aggregated a new status into the last tick, we may need to merge
      // the last tick into other ticks prior to the lastTick, otherwise we may
      // end up with multiple ticks that have the same status
      while (jobTicks.length > 2) {
        const currentTick = jobTicks.at(-1)!;
        const priorTick = jobTicks.at(-2)!;

        const currentTickStatus = getAggregateStatus(statusPrecedent, currentTick.stats);
        const priorTickStatus = getAggregateStatus(statusPrecedent, priorTick.stats);

        // Nothing to change if the tick prior is an ending tick or has a
        // different status from the
        if (priorTick.isEnding || currentTickStatus !== priorTickStatus) {
          break;
        }

        jobTicks.pop()!;
        priorTick.endTs = currentTick.endTs;
        priorTick.stats = mergeStats(statusPrecedent, priorTick.stats, currentTick.stats);
        priorTick.width += currentTick.width;
      }

      return;
    }

    // Status between the previous tick and the new one is different. Create a
    // new tick conjoined to the previous tick.
    const tick = makeTick({stats, startTs, endTs, left, width});
    jobTicks.push(tick);
  });

  return jobTicks;
}
