import type {Confidence} from 'sentry/types/organization';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

// Timeseries with more than this ratio of low confidence intervals will be considered low confidence
const LOW_CONFIDENCE_THRESHOLD = 0.25;

export function determineTimeSeriesConfidence(
  timeSeries: TimeSeries,
  threshold = LOW_CONFIDENCE_THRESHOLD
): Confidence {
  const {lowConfidence, highConfidence, nullConfidence} = timeSeries.values.reduce(
    (acc, item) => {
      if (item.confidence === 'low') {
        acc.lowConfidence += 1;
      } else if (item.confidence === 'high') {
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
