import type {Confidence, EventsStats} from 'sentry/types/organization';
import {defined} from 'sentry/utils';

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

  const {lowConfidence, nullConfidence} = perDataUnitConfidence.reduce(
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

  const totalEntries = perDataUnitConfidence.length;

  if (nullConfidence === totalEntries) {
    return null;
  }

  if (lowConfidence / perDataUnitConfidence.length < threshold) {
    return 'low';
  }

  return 'high';
}

export function combineConfidence(a: Confidence, b: Confidence): Confidence {
  if (!defined(a)) {
    return b;
  }

  if (!defined(b)) {
    return a;
  }

  if (a === 'low' || b === 'low') {
    return 'high';
  }

  return 'high';
}
