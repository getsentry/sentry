import {segmentSequentialBy} from 'sentry/utils/array/segmentSequentialBy';
import type {
  TimeSeries,
  TimeSeriesItem,
} from 'sentry/views/dashboards/widgets/common/types';

/**
 * Splits a `TimeSeries` object into a sequence of segments, where each segment is a `TimeSeries` object with a boolean flag indicating whether it contains incomplete data.
 */
export function segmentTimeSeriesByIncompleteData(
  timeSeries: TimeSeries
): Array<[TimeSeries, boolean]> {
  const segments = segmentSequentialBy(timeSeries.values, isTimeSeriesItemIncomplete);

  let previousSegment = segments.at(0)!;

  for (let i = 1; i < segments.length; i++) {
    const currentSegment = segments[i];

    if (!currentSegment) {
      break;
    }

    // The previous segment is complete, and the current segment is incomplete. Add the last complete datum from the previous segment to the beginning of the current segment to create a continuous visual line.
    if (
      previousSegment.predicateValue === false &&
      currentSegment.predicateValue === true
    ) {
      const lastCompleteDatum = previousSegment.data.at(-1)!;
      currentSegment.data.unshift(lastCompleteDatum);
    }

    // The previous segment is incomplete, and the current segment is complete. Add the first complete datum from the current segment to the end of the previous segment to create a continuous visual line.
    if (
      previousSegment.predicateValue === true &&
      currentSegment.predicateValue === false
    ) {
      const firstCompleteDatum = currentSegment.data.at(0)!;
      previousSegment.data.push(firstCompleteDatum);
    }

    previousSegment = currentSegment;
  }

  return segments.map(partition => {
    return [
      {
        ...timeSeries,
        values: partition.data,
      },
      partition.predicateValue,
    ];
  });
}

const isTimeSeriesItemIncomplete = (item: TimeSeriesItem): boolean =>
  Boolean(item.incomplete);
