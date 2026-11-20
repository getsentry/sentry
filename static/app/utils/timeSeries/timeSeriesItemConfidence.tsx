import {defined} from 'sentry/utils/defined';
import type {TimeSeriesItem} from 'sentry/views/dashboards/widgets/common/types';

export function isExtrapolatedTimeSeriesItem(item: TimeSeriesItem): boolean {
  return defined(item.sampleRate) && item.sampleRate < 1;
}

/**
 * A `null` confidence on extrapolated data means the backend could not estimate a confidence interval at all, which is even less reliable than `"low"`. Unextrapolated data also gets `null` confidence, but it's exact, so it doesn't count
 */
export function isLowConfidenceTimeSeriesItem(item: TimeSeriesItem): boolean {
  return (
    item.confidence === 'low' ||
    (item.confidence === null && isExtrapolatedTimeSeriesItem(item))
  );
}
