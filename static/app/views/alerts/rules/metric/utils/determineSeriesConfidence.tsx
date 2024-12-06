import type {
  Confidence,
  EventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import {defined} from 'sentry/utils';

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

export function determineMultiSeriesConfidence(
  data: MultiSeriesEventsStats,
  threshold = LOW_CONFIDENCE_THRESHOLD
): Confidence {
  return Object.values(data).reduce(
    (acc, eventsStats) =>
      combineConfidence(acc, determineSeriesConfidence(eventsStats, threshold)),
    null as Confidence
  );
}

export function combineConfidence(a: Confidence, b: Confidence): Confidence {
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
