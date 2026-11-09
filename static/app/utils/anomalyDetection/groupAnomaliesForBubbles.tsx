import type {Anomaly} from 'sentry/views/alerts/types';
import {AnomalyType} from 'sentry/views/alerts/types';
import type {IncidentPeriod} from 'sentry/views/detectors/hooks/useIncidentMarkers';

/**
 * Groups consecutive anomalous data points into rich incident periods for bubble rendering
 */
export function groupAnomaliesForBubbles(
  anomalies: Anomaly[],
  timePeriodMs?: number
): IncidentPeriod[] {
  const periods: IncidentPeriod[] = [];
  let currentPeriod: IncidentPeriod | null = null;

  for (const anomaly of anomalies) {
    const timestampMs = anomaly.timestamp * 1000;
    const isAnomalous = [
      AnomalyType.HIGH_CONFIDENCE,
      AnomalyType.LOW_CONFIDENCE,
    ].includes(anomaly.anomaly.anomaly_type);

    if (isAnomalous) {
      const isHighConfidence =
        anomaly.anomaly.anomaly_type === AnomalyType.HIGH_CONFIDENCE;

      if (currentPeriod === null) {
        // Start a new anomaly period
        currentPeriod = {
          // Anomaly id is not shown
          id: anomalies.indexOf(anomaly).toString(),
          type: 'open-period-start',
          priority: isHighConfidence ? 'high' : 'medium',
          start: timestampMs,
          end: timestampMs,
        };
      } else {
        // Extend the current period
        currentPeriod.end = timestampMs;
        // Use higher confidence if available
        if (isHighConfidence) {
          currentPeriod.priority = 'high';
        }
      }
    } else if (currentPeriod) {
      // End the current period and add it to results
      periods.push(currentPeriod);
      currentPeriod = null;
    }
  }

  // Handle last period if it ends with an anomaly
  if (currentPeriod) {
    periods.push(currentPeriod);
  }

  // Ensure each period spans at least 2 data points for better visualization
  if (timePeriodMs) {
    periods.forEach(period => {
      if (period.start === period.end) {
        // Extend single-point anomalies to span at least one more time period
        period.end = period.start + timePeriodMs;
      }
    });
  }

  return periods;
}
