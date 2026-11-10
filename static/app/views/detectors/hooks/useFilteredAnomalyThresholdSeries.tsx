import {useMemo} from 'react';

import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import type {AlertRuleThresholdType} from 'sentry/views/alerts/rules/metric/types';
import {
  filterAnomalyThresholdSeries,
  getAnomalyThresholdType,
} from 'sentry/views/detectors/utils/anomalyThresholdSeries';

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
    if (detector) {
      return filterAnomalyThresholdSeries({
        anomalyThresholdSeries,
        thresholdType: getAnomalyThresholdType(detector),
      });
    }

    return filterAnomalyThresholdSeries({
      anomalyThresholdSeries,
      thresholdType: isAnomalyDetection ? directThresholdType : undefined,
    });
  }, [anomalyThresholdSeries, detector, isAnomalyDetection, directThresholdType]);
}
