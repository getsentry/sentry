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
  if (
    !defined(data.meta?.accuracy?.confidence) ||
    data.meta.accuracy.confidence.length < 1
  ) {
    // for back compat but this code path should always return null because top
    // level confidence should be returned in the same cases as the confidence
    // inside the accuracy object
    return determineSeriesConfidenceDeprecated(data, threshold);
  }

  const {lowConfidence, highConfidence, nullConfidence} =
    data.meta.accuracy.confidence.reduce(
      (acc, item) => {
        if (item.value === 'low') {
          acc.lowConfidence += 1;
        } else if (item.value === 'high') {
          acc.highConfidence += 1;
        } else {
          acc.nullConfidence += 1;
        }
        return acc;
      },
      {lowConfidence: 0, highConfidence: 0, nullConfidence: 0}
    );

  return finalConfidence(lowConfidence, highConfidence, nullConfidence, threshold);
}

function determineSeriesConfidenceDeprecated(
  data: EventsStats,
  threshold: number
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

  return finalConfidence(lowConfidence, highConfidence, nullConfidence, threshold);
}

function finalConfidence(
  lowConfidence: number,
  highConfidence: number,
  nullConfidence: number,
  threshold: number
): Confidence {
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
