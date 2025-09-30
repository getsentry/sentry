import {useMemo} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
  Dataset,
  EventTypes,
  TimePeriod,
} from 'sentry/views/alerts/rules/metric/types';
import type {Anomaly} from 'sentry/views/alerts/types';
import {AnomalyType} from 'sentry/views/alerts/types';
import {
  EAP_HISTORICAL_TIME_PERIOD_MAP,
  HISTORICAL_TIME_PERIOD_MAP,
  HISTORICAL_TIME_PERIOD_MAP_FIVE_MINS,
} from 'sentry/views/alerts/utils/timePeriods';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';
import {isEapDataset} from 'sentry/views/detectors/datasetConfig/utils/isEapDataset';
import {useMetricDetectorSeries} from 'sentry/views/detectors/hooks/useMetricDetectorSeries';

import type {IncidentPeriod} from './useIncidentMarkers';
import {useMetricDetectorAnomalies} from './useMetricDetectorAnomalies';

interface UseMetricDetectorAnomalyPeriodsProps {
  aggregate: string;
  dataset: Dataset;
  detectorDataset: DetectorDataset;
  enabled: boolean;
  environment: string | undefined;
  eventTypes: EventTypes[];
  interval: number;
  /**
   * Should not fetch anomalies if series is loading
   */
  isLoadingSeries: boolean;
  projectId: string;
  query: string;
  sensitivity: AlertRuleSensitivity | undefined;
  series: Series[];
  statsPeriod: TimePeriod;
  thresholdType: AlertRuleThresholdType | undefined;
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
          // Anomaly id is not shown
          id: anomalies.indexOf(anomaly).toString(),
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
  isLoadingSeries,
  detectorDataset,
  dataset,
  aggregate,
  query,
  eventTypes,
  environment,
  projectId,
  statsPeriod,
  interval,
  thresholdType,
  sensitivity,
  enabled,
}: UseMetricDetectorAnomalyPeriodsProps): UseMetricDetectorAnomalyPeriodsResult {
  const theme = useTheme();

  // Fetch historical data with extended time period for anomaly detection baseline comparison
  const isFiveMinuteInterval = interval === 300;
  // EAP datasets have to select fewer historical data points
  const historicalPeriod = isEapDataset(detectorDataset)
    ? EAP_HISTORICAL_TIME_PERIOD_MAP[
        statsPeriod as keyof typeof EAP_HISTORICAL_TIME_PERIOD_MAP
      ]
    : // 5-minute intervals also require fewer historical data points
      isFiveMinuteInterval
      ? HISTORICAL_TIME_PERIOD_MAP_FIVE_MINS[
          statsPeriod as keyof typeof HISTORICAL_TIME_PERIOD_MAP_FIVE_MINS
        ]
      : HISTORICAL_TIME_PERIOD_MAP[
          statsPeriod as keyof typeof HISTORICAL_TIME_PERIOD_MAP
        ];

  const {
    series: historicalSeries,
    isLoading: isHistoricalLoading,
    error: historicalError,
  } = useMetricDetectorSeries({
    detectorDataset,
    dataset,
    aggregate,
    interval,
    query,
    eventTypes,
    environment,
    projectId,
    statsPeriod: historicalPeriod as TimePeriod,
    options: {
      enabled,
    },
  });

  const {
    data: anomalies,
    isLoading: isAnomalyLoading,
    error: anomalyError,
  } = useMetricDetectorAnomalies({
    series,
    historicalSeries,
    projectId,
    thresholdType,
    sensitivity,
    interval,
    // Wait until both regular series and historical series are loaded
    enabled: enabled && !isLoadingSeries && !isHistoricalLoading,
  });

  const anomalyPeriods = useMemo<IncidentPeriod[]>(() => {
    if (
      !anomalies ||
      anomalies.length === 0 ||
      isHistoricalLoading ||
      isAnomalyLoading ||
      isLoadingSeries
    ) {
      return [];
    }
    // Convert timePeriod from seconds to milliseconds for minimum anomaly width
    const timePeriodMs = interval ? interval * 1000 : undefined;
    return groupAnomaliesForBubbles(anomalies, theme, timePeriodMs);
  }, [
    anomalies,
    theme,
    interval,
    isHistoricalLoading,
    isAnomalyLoading,
    isLoadingSeries,
  ]);

  return {
    anomalyPeriods,
    isLoading: isHistoricalLoading || isAnomalyLoading,
    error: historicalError || anomalyError,
  };
}
