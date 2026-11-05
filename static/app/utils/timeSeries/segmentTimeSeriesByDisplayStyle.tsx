import {segmentSequentialBy} from 'sentry/utils/array/segmentSequentialBy';
import type {
  TimeSeries,
  TimeSeriesItem,
} from 'sentry/views/dashboards/widgets/common/types';

export type TimeSeriesDisplayStyle = 'normal' | 'lowConfidence' | 'incomplete';

/**
 * `TimeSeriesItem` properties that can split a series into differently-styled segments
 */
export type TimeSeriesSegmentField = 'completeness' | 'confidence';

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
  const segments = segmentSequentialBy(timeSeries.values, item =>
    getDisplayStyle(item, options.segmentBy)
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

/**
 * When more than one field applies to an item, the highest-precedence style wins
 */
function getDisplayStyle(
  item: TimeSeriesItem,
  segmentBy: readonly TimeSeriesSegmentField[]
): TimeSeriesDisplayStyle {
  return segmentBy
    .map(field => SEGMENTERS[field](item))
    .reduce(
      (winner, style) =>
        STYLE_PRECEDENCE[style] < STYLE_PRECEDENCE[winner] ? style : winner,
      'normal'
    );
}

const SEGMENTERS: Record<
  TimeSeriesSegmentField,
  (item: TimeSeriesItem) => TimeSeriesDisplayStyle
> = {
  completeness: item => (item.incomplete ? 'incomplete' : 'normal'),
  confidence: item => (item.confidence === 'low' ? 'lowConfidence' : 'normal'),
};

const STYLE_PRECEDENCE: Record<TimeSeriesDisplayStyle, number> = {
  incomplete: 0,
  lowConfidence: 1,
  normal: 2,
};
