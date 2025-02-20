import type {DataCategoryInfo} from 'sentry/types/core';

import type {Spike, SpikeDetails} from 'getsentry/views/spikeProtection/types';

export function getDateFromString(date: string) {
  const newDate = new Date(date);
  newDate.setMilliseconds(0);
  return newDate;
}

// Rounds down the start time to the nearest value in the list of intervals
function findStartIntervalBinarySearch(intervals: string[], target: Date) {
  let start = 0;
  let end = intervals.length - 1;
  if (target <= new Date(intervals[start]!)) {
    return intervals[start];
  }

  while (start <= end) {
    const mid = Math.ceil((start + end) / 2);
    const interval = new Date(intervals[mid]!);

    if (interval >= target) {
      end = mid - 1;
    } else {
      start = mid + 1;
    }
  }
  return intervals[end];
}

// Rounds up the end time to the nearest value in the list of intervals
function findEndIntervalBinarySearch(intervals: string[], target: Date) {
  let start = 0;
  let end = intervals.length - 1;

  if (target >= new Date(intervals[end]!)) {
    return intervals[end];
  }

  while (start <= end) {
    const mid = Math.floor((start + end) / 2);
    const interval = new Date(intervals[mid]!);

    if (interval <= target) {
      start = mid + 1;
    } else {
      end = mid - 1;
    }
  }
  return intervals[start];
}

export function getSpikeInterval(intervals: string[], startDate: Date, endDate: Date) {
  return {
    startDate: findStartIntervalBinarySearch(intervals, startDate),
    endDate: findEndIntervalBinarySearch(intervals, endDate),
  };
}

export function getOngoingSpikeInterval(intervals: string[], startDate: Date) {
  return {
    startDate: findStartIntervalBinarySearch(intervals, startDate),
    endDate: intervals[intervals.length - 1],
  };
}

export function getSpikeDuration(spike: Spike) {
  // in seconds
  return spike.endDate
    ? Math.round(
        (new Date(spike.endDate).valueOf() - new Date(spike.startDate).valueOf()) / 1000
      )
    : null;
}

export function getSpikeDetailsFromSeries({
  storedSpikes,
  dataCategory,
}: {
  dataCategory: DataCategoryInfo['name'];
  storedSpikes: Spike[];
}) {
  const actualSpikes: SpikeDetails[] = [];

  if (storedSpikes.length === 0) {
    return actualSpikes;
  }

  storedSpikes.forEach(spike => {
    const duration = getSpikeDuration(spike);
    // only show spikes if they are ongoing
    actualSpikes.push({
      start: spike.startDate,
      end: spike.endDate,
      duration,
      dropped: spike.eventsDropped,
      threshold: spike.initialThreshold,
      dataCategory,
    });
  });

  return actualSpikes;
}
