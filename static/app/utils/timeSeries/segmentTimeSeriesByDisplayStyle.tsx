import {segmentSequentialBy} from 'sentry/utils/array/segmentSequentialBy';
import type {
  TimeSeries,
  TimeSeriesItem,
} from 'sentry/views/dashboards/widgets/common/types';

export type TimeSeriesDisplayStyle = 'normal' | 'lowConfidence' | 'incomplete';

interface Options {
  /**
   * Whether to split out low-confidence items. When `false`, they're treated as normal
   */
  showLowConfidence?: boolean;
}

/**
 * Splits a `TimeSeries` into sequential segments that each share a display style. Neighbouring segments share one boundary point so the plotted line stays continuous. The boundary point is drawn in the weaker style (e.g., the dashed low-confidence segment reaches all the way to its solid neighbour).
 */
export function segmentTimeSeriesByDisplayStyle(
  timeSeries: TimeSeries,
  options: Options = {}
): Array<[TimeSeries, TimeSeriesDisplayStyle]> {
  const {showLowConfidence = false} = options;

  const segments = segmentSequentialBy(timeSeries.values, item =>
    getDisplayStyle(item, showLowConfidence)
  );

  for (let i = 1; i < segments.length; i++) {
    const previousSegment = segments[i - 1]!;
    const currentSegment = segments[i]!;

    if (
      STYLE_WEAKNESS[currentSegment.predicateValue] >
      STYLE_WEAKNESS[previousSegment.predicateValue]
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
  showLowConfidence: boolean
): TimeSeriesDisplayStyle {
  if (item.incomplete) {
    return 'incomplete';
  }

  if (showLowConfidence && item.confidence === 'low') {
    return 'lowConfidence';
  }

  return 'normal';
}

const STYLE_WEAKNESS: Record<TimeSeriesDisplayStyle, number> = {
  normal: 0,
  lowConfidence: 1,
  incomplete: 2,
};
