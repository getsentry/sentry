import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
import {isEventsStats} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

// Timeseries with more than this ratio of low confidence intervals will be considered low confidence
const LOW_CONFIDENCE_RATIO = 0.25;

// Returns true if any of the time series are low confidence
export function isLowConfidenceTimeSeries(
  data: EventsStats | MultiSeriesEventsStats | null
) {
  if (data) {
    if (isEventsStats(data)) {
      return _isLowConfidenceEventsStats(data);
    }
    return Object.values(data).some(_isLowConfidenceEventsStats);
  }
  return false;
}

function _isLowConfidenceEventsStats(data: EventsStats) {
  const numIntervals = data.data.length;
  const numLowConfidenceIntervals = data.data.filter(
    series => series[1][0]?.confidence === 'LOW'
  ).length;
  return numLowConfidenceIntervals / numIntervals > LOW_CONFIDENCE_RATIO;
}
