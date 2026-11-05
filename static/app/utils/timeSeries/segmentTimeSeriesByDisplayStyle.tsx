import {segmentSequentialBy} from 'sentry/utils/array/segmentSequentialBy';
import type {
  TimeSeries,
  TimeSeriesItem,
} from 'sentry/views/dashboards/widgets/common/types';

export type TimeSeriesDisplayStyle = 'normal' | 'lowConfidence' | 'incomplete';

/**
 * `TimeSeriesItem` properties that can split a series into differently-styled segments
 */
export type TimeSeriesSegmentField = 'confidence' | 'incomplete';

interface Options {
  /**
   * Which item properties to split on. Properties not listed are ignored, and those items are styled as normal
   */
  segmentBy: readonly TimeSeriesSegmentField[];
}

/**
 * Splits a `TimeSeries` into sequential segments that each share a display style. Neighbouring segments share one boundary point so the plotted line stays continuous. The boundary point is drawn in the higher-precedence style (e.g., a low-confidence segment reaches all the way to its normal neighbour).
 */
export function segmentTimeSeriesByDisplayStyle(
  timeSeries: TimeSeries,
  options: Options
): Array<[TimeSeries, TimeSeriesDisplayStyle]> {
  const segmentBy = new Set(options.segmentBy);

  const segments = segmentSequentialBy(timeSeries.values, item =>
    getDisplayStyle(item, segmentBy)
  );

  for (let i = 1; i < segments.length; i++) {
    const previousSegment = segments[i - 1]!;
    const currentSegment = segments[i]!;

    if (
      STYLE_PRECEDENCE[currentSegment.predicateValue] <
      STYLE_PRECEDENCE[previousSegment.predicateValue]
    ) {
      currentSegment.data.unshift(previousSegment.data.at(-1)!);
    } else {
      previousSegment.data.push(currentSegment.data.at(0)!);
    }
  }

  return segments.map(segment => [
    {...timeSeries, values: segment.data},
    segment.predicateValue,
  ]);
}

function getDisplayStyle(
  item: TimeSeriesItem,
  segmentBy: ReadonlySet<TimeSeriesSegmentField>
): TimeSeriesDisplayStyle {
  if (segmentBy.has('incomplete') && item.incomplete) {
    return 'incomplete';
  }

  if (segmentBy.has('confidence') && item.confidence === 'low') {
    return 'lowConfidence';
  }

  return 'normal';
}

// Lower number wins. An item that's both incomplete and low-confidence is drawn
// as incomplete, and a shared boundary point goes to the higher-precedence segment
const STYLE_PRECEDENCE: Record<TimeSeriesDisplayStyle, number> = {
  incomplete: 0,
  lowConfidence: 1,
  normal: 2,
};
