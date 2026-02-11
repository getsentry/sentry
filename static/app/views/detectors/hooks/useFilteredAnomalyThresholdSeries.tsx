import {useMemo} from 'react';

import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {AlertRuleThresholdType} from 'sentry/views/alerts/rules/metric/types';

interface UseFilteredAnomalyThresholdSeriesProps {
  anomalyThresholdSeries: any[];
  /**
   * The detector object - used in details view
   */
  detector?: MetricDetector;
  /**
   * Whether this is anomaly detection - used in forms view
   */
  isAnomalyDetection?: boolean;
  /**
   * The threshold type - used in forms view
   */
  thresholdType?: AlertRuleThresholdType;
}

/**
 * Filters anomaly threshold series based on the threshold type configuration.
 * Returns upper threshold, lower threshold, and/or seer value based on whether
 * the alert is configured for ABOVE, BELOW, or ABOVE_AND_BELOW thresholds.
 */
export function useFilteredAnomalyThresholdSeries({
  anomalyThresholdSeries,
  detector,
  isAnomalyDetection,
  thresholdType: directThresholdType,
}: UseFilteredAnomalyThresholdSeriesProps) {
  return useMemo(() => {
    if (!anomalyThresholdSeries.length) {
      return [];
    }

    let thresholdType: AlertRuleThresholdType | undefined;

    if (detector) {
      const condition = detector.conditionGroup?.conditions[0];
      if (!condition || condition.type !== 'anomaly_detection') {
        return [];
      }

      if (typeof condition.comparison === 'number') {
        return [];
      }

      thresholdType = condition.comparison.thresholdType;
    } else {
      if (!isAnomalyDetection) {
        return [];
      }
      thresholdType = directThresholdType;
    }

    if (thresholdType === undefined) {
      return [];
    }

    const [upperThreshold, lowerThreshold, seerValue] = anomalyThresholdSeries;

    const filtered = [];
    if (thresholdType !== AlertRuleThresholdType.BELOW) filtered.push(upperThreshold);
    if (thresholdType !== AlertRuleThresholdType.ABOVE) filtered.push(lowerThreshold);
    if (seerValue) filtered.push(seerValue);

    return filtered.filter((s): s is NonNullable<typeof s> => !!s);
  }, [anomalyThresholdSeries, detector, isAnomalyDetection, directThresholdType]);
}
