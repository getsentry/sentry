import {useMemo} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import type {
  LineSeriesOption,
  MarkAreaComponentOption,
  TooltipComponentFormatterCallbackParams,
} from 'echarts';

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

import {useMetricDetectorAnomalies} from './useMetricDetectorAnomalies';

/**
 * Represents a continuous anomaly time period
 */
interface AnomalyPeriod {
  confidence: AnomalyType;
  end: string;
  start: string;
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

/**
 * Groups consecutive anomalous data points into continuous periods
 */
function groupAnomaliesIntoPeriods(anomalies: Anomaly[]): AnomalyPeriod[] {
  const periods: AnomalyPeriod[] = [];
  let currentPeriod: AnomalyPeriod | null = null;

  for (const anomaly of anomalies) {
    const timestamp = new Date(anomaly.timestamp * 1000).toISOString();
    const isAnomalous = [
      AnomalyType.HIGH_CONFIDENCE,
      AnomalyType.LOW_CONFIDENCE,
    ].includes(anomaly.anomaly.anomaly_type);

    if (isAnomalous) {
      if (currentPeriod === null) {
        // Start a new anomaly period
        currentPeriod = {
          confidence: anomaly.anomaly.anomaly_type,
          end: timestamp,
          start: timestamp,
        };
      } else {
        // Extend the current period
        currentPeriod.end = timestamp;
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

  return periods;
}

function getAnomalyMarkerSeries(anomalies: Anomaly[], theme: Theme): LineSeriesOption[] {
  if (!Array.isArray(anomalies) || anomalies.length === 0) {
    return [];
  }

  const anomalyPeriods = groupAnomaliesIntoPeriods(anomalies);
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

  // Create shaded areas spanning the full duration of each anomaly period
  const markAreaData: MarkAreaComponentOption['data'] = anomalyPeriods.map(period => [
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

interface UseMetricDetectorAnomalySeriesProps {
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

interface UseMetricDetectorAnomalySeriesResult {
  anomalySeries: LineSeriesOption[];
  error: Error | null;
  isLoading: boolean;
}

export function useMetricDetectorAnomalySeries({
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
}: UseMetricDetectorAnomalySeriesProps): UseMetricDetectorAnomalySeriesResult {
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
    return getAnomalyMarkerSeries(anomalies, theme);
  }, [anomalies, theme, isHistoricalLoading, isLoading]);

  return {
    anomalySeries,
    isLoading: isHistoricalLoading || isLoading,
    error,
  };
}
