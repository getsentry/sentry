import {useMemo} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import type {LineSeriesOption, TooltipComponentFormatterCallbackParams} from 'echarts';

import MarkArea from 'sentry/components/charts/components/markArea';
import MarkLine from 'sentry/components/charts/components/markLine';
import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import {getFormat, getFormattedDate} from 'sentry/utils/dates';
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

import type {IncidentPeriod} from './useIncidentBubbles';
import {useMetricDetectorAnomalies} from './useMetricDetectorAnomalies';

interface UseMetricDetectorAnomalyDataProps {
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

interface UseMetricDetectorAnomalyDataResult {
  anomalies: Anomaly[] | undefined;
  anomalyPeriods: IncidentPeriod[];
  anomalySeries: LineSeriesOption[];
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
 * Groups consecutive anomalous data points into simple periods for legacy marker series (lines/shaded areas)
 */
function groupAnomaliesForMarkers(
  anomalies: Anomaly[],
  timePeriodMs?: number
): Array<{
  confidence: AnomalyType;
  end: number;
  start: number;
}> {
  const periods: Array<{
    confidence: AnomalyType;
    end: number;
    start: number;
  }> = [];
  let currentPeriod: {
    confidence: AnomalyType;
    end: number;
    start: number;
  } | null = null;

  for (const anomaly of anomalies) {
    const timestampMs = anomaly.timestamp * 1000;
    const isAnomalous = [
      AnomalyType.HIGH_CONFIDENCE,
      AnomalyType.LOW_CONFIDENCE,
    ].includes(anomaly.anomaly.anomaly_type);

    if (isAnomalous) {
      if (currentPeriod === null) {
        // Start a new anomaly period
        currentPeriod = {
          confidence: anomaly.anomaly.anomaly_type,
          end: timestampMs,
          start: timestampMs,
        };
      } else {
        // Extend the current period
        currentPeriod.end = timestampMs;
        // Use higher confidence if available
        if (anomaly.anomaly.anomaly_type === AnomalyType.HIGH_CONFIDENCE) {
          currentPeriod.confidence = AnomalyType.HIGH_CONFIDENCE;
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

function anomalyTooltipFormatter(
  params: TooltipComponentFormatterCallbackParams
): string {
  const param = Array.isArray(params) ? params[0]! : params;

  const timestamp = param.value as string;
  const formattedTime = getFormattedDate(
    timestamp,
    getFormat({timeZone: true, year: true}),
    {local: true}
  );

  return [
    '<div class="tooltip-series">',
    `<span class="tooltip-label"><strong>${t('Anomaly Detected')}</strong></span>`,
    '</div>',
    `<div class="tooltip-footer">${formattedTime}</div>`,
    '<div class="tooltip-arrow"></div>',
  ].join('');
}

function getAnomalyMarkerSeries(
  anomalies: Anomaly[],
  theme: Theme,
  timePeriod?: number
): LineSeriesOption[] {
  if (!Array.isArray(anomalies) || anomalies.length === 0) {
    return [];
  }

  // Convert timePeriod from seconds to milliseconds for minimum anomaly width
  const timePeriodMs = timePeriod ? timePeriod * 1000 : undefined;
  const anomalyPeriods = groupAnomaliesForMarkers(anomalies, timePeriodMs);
  if (anomalyPeriods.length === 0) {
    return [];
  }

  // Create vertical line markers at the start of each anomaly period
  const anomalyStartMarkers = anomalyPeriods.map(period => ({
    xAxis: period.start,
    tooltip: {
      formatter: anomalyTooltipFormatter,
    },
  }));

  // Create 2d shaded areas spanning the full duration of each anomaly period
  const markAreaData = anomalyPeriods.map<[{xAxis: number}, {xAxis: number}]>(period => [
    {xAxis: period.start},
    {xAxis: period.end},
  ]);

  return [
    {
      name: 'Anomaly Detection',
      type: 'line',
      data: [],
      markLine: MarkLine({
        silent: false,
        lineStyle: {
          color: theme.pink300,
          type: 'dashed',
          width: 2,
        },
        label: {
          show: false,
        },
        data: anomalyStartMarkers,
        animation: false,
      }),
      markArea: MarkArea({
        silent: true,
        itemStyle: {
          color: theme.red200,
        },
        data: markAreaData,
        animation: false,
      }),
    },
  ];
}

/**
 * Hook for fetching anomaly detection data for metric detectors
 * Handles historical data fetching, anomaly detection, and legacy marker series creation
 */
export function useMetricDetectorAnomalyData({
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
}: UseMetricDetectorAnomalyDataProps): UseMetricDetectorAnomalyDataResult {
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

  const anomalySeries = useMemo<LineSeriesOption[]>(() => {
    if (!anomalies || anomalies.length === 0 || isHistoricalLoading || isLoading) {
      return [];
    }
    return getAnomalyMarkerSeries(anomalies, theme, timePeriod);
  }, [anomalies, theme, timePeriod, isHistoricalLoading, isLoading]);

  const anomalyPeriods = useMemo<IncidentPeriod[]>(() => {
    if (!anomalies || anomalies.length === 0 || isHistoricalLoading || isLoading) {
      return [];
    }
    // Convert timePeriod from seconds to milliseconds for minimum anomaly width
    const timePeriodMs = timePeriod ? timePeriod * 1000 : undefined;
    return groupAnomaliesForBubbles(anomalies, theme, timePeriodMs);
  }, [anomalies, theme, timePeriod, isHistoricalLoading, isLoading]);

  return {
    anomalies,
    anomalyPeriods,
    anomalySeries,
    isLoading: isHistoricalLoading || isLoading,
    error,
  };
}
