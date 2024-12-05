import type {
  Confidence,
  EventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {isEventsStats} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

// Returns true if any of the time series are low confidence
export function isLowConfidenceTimeSeries(
  data: EventsStats | MultiSeriesEventsStats | null
) {
  if (data) {
    if (isEventsStats(data)) {
      return determineSeriesConfidence(data) === 'low';
    }
    return Object.values(data).some(d => determineSeriesConfidence(d) === 'low');
  }
  return false;
}

// Timeseries with more than this ratio of low confidence intervals will be considered low confidence
const LOW_CONFIDENCE_THRESHOLD = 0.25;

export function determineSeriesConfidence(
  data: EventsStats,
  threshold = LOW_CONFIDENCE_THRESHOLD
): Confidence {
  if (!defined(data.confidence) || data.confidence.length < 1) {
    return null;
  }

  const perDataUnitConfidence: Confidence[] = data.confidence.map(unit => {
    return unit[1].reduce(
      (acc, entry) => combineConfidence(acc, entry.count),
      null as Confidence
    );
  });

  const {lowConfidence, highConfidence, nullConfidence} = perDataUnitConfidence.reduce(
    (acc, confidence) => {
      if (confidence === 'low') {
        acc.lowConfidence += 1;
      } else if (confidence === 'high') {
        acc.highConfidence += 1;
      } else {
        acc.nullConfidence += 1;
      }
      return acc;
    },
    {lowConfidence: 0, highConfidence: 0, nullConfidence: 0}
  );

  if (lowConfidence <= 0 && highConfidence <= 0 && nullConfidence >= 0) {
    return null;
  }

  // Do not divide by (low + high + null) because nulls then can then heavily influence the final confidence
  if (lowConfidence / (lowConfidence + highConfidence) > threshold) {
    return 'low';
  }

  return 'high';
}

function combineConfidence(a: Confidence, b: Confidence): Confidence {
  if (!defined(a)) {
    return b;
  }

  if (!defined(b)) {
    return a;
  }

  if (a === 'low' || b === 'low') {
    return 'low';
  }

  return 'high';
}
