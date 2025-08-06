import {useMemo} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
  TimePeriod,
} from 'sentry/views/alerts/rules/metric/types';
import type {Anomaly} from 'sentry/views/alerts/types';
import {AnomalyType} from 'sentry/views/alerts/types';
import {
  HISTORICAL_TIME_PERIOD_MAP,
  HISTORICAL_TIME_PERIOD_MAP_FIVE_MINS,
} from 'sentry/views/alerts/utils/timePeriods';
import type {DetectorDataset} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {useMetricDetectorSeries} from 'sentry/views/detectors/hooks/useMetricDetectorSeries';

import type {IncidentPeriod} from './useIncidentMarkers';
import {useMetricDetectorAnomalies} from './useMetricDetectorAnomalies';

interface UseMetricDetectorAnomalyPeriodsProps {
  aggregate: string;
  dataset: DetectorDataset;
  enabled: boolean;
  environment: string | undefined;
  projectId: string;
  query: string;
  sensitivity: AlertRuleSensitivity | undefined;
  series: Series[];
  statsPeriod: TimePeriod;
  thresholdType: AlertRuleThresholdType | undefined;
  timePeriod: number;
}

interface UseMetricDetectorAnomalyPeriodsResult {
  anomalyPeriods: IncidentPeriod[];
  error: Error | null;
  isLoading: boolean;
}

/**
 * Groups consecutive anomalous data points into rich incident periods for bubble rendering
 */
function groupAnomaliesForBubbles(
  anomalies: Anomaly[],
  theme: Theme,
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
          type: anomaly.anomaly.anomaly_type,
          name: isHighConfidence
            ? t('High Confidence Anomaly')
            : t('Low Confidence Anomaly'),
          color: isHighConfidence ? theme.red400 : theme.yellow400,
          hoverColor: isHighConfidence ? theme.red300 : theme.yellow400,
          start: timestampMs,
          end: timestampMs,
        };
      } else {
        // Extend the current period
        currentPeriod.end = timestampMs;
        // Use higher confidence if available
        if (isHighConfidence) {
          currentPeriod.type = AnomalyType.HIGH_CONFIDENCE;
          currentPeriod.name = t('High Confidence Anomaly');
          currentPeriod.color = theme.red400;
          currentPeriod.hoverColor = theme.red300;
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

/**
 * Fetches the appropriate historical data and generates incident periods
 */
export function useMetricDetectorAnomalyPeriods({
  series,
  dataset,
  aggregate,
  query,
  environment,
  projectId,
  statsPeriod,
  timePeriod,
  thresholdType,
  sensitivity,
  enabled,
}: UseMetricDetectorAnomalyPeriodsProps): UseMetricDetectorAnomalyPeriodsResult {
  const theme = useTheme();

  // Fetch historical data with extended time period for anomaly detection baseline comparison
  const isFiveMinuteTimePeriod = timePeriod === 300;
  const historicalPeriod = isFiveMinuteTimePeriod
    ? HISTORICAL_TIME_PERIOD_MAP_FIVE_MINS[
        statsPeriod as keyof typeof HISTORICAL_TIME_PERIOD_MAP_FIVE_MINS
      ]
    : HISTORICAL_TIME_PERIOD_MAP[statsPeriod as keyof typeof HISTORICAL_TIME_PERIOD_MAP];

  const {series: historicalSeries, isLoading: isHistoricalLoading} =
    useMetricDetectorSeries({
      dataset,
      aggregate,
      interval: timePeriod,
      query,
      environment,
      projectId,
      statsPeriod: historicalPeriod as TimePeriod,
      options: {
        enabled,
      },
    });

  const {
    data: anomalies,
    isLoading,
    error,
  } = useMetricDetectorAnomalies({
    series,
    historicalSeries,
    projectId,
    thresholdType,
    sensitivity,
    timePeriod,
    enabled,
  });

  const anomalyPeriods = useMemo<IncidentPeriod[]>(() => {
    if (!anomalies || anomalies.length === 0 || isHistoricalLoading || isLoading) {
      return [];
    }
    // Convert timePeriod from seconds to milliseconds for minimum anomaly width
    const timePeriodMs = timePeriod ? timePeriod * 1000 : undefined;
    return groupAnomaliesForBubbles(anomalies, theme, timePeriodMs);
  }, [anomalies, theme, timePeriod, isHistoricalLoading, isLoading]);

  return {
    anomalyPeriods,
    isLoading: isHistoricalLoading || isLoading,
    error,
  };
}
