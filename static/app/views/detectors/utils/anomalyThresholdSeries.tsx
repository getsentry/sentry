import type {Theme} from '@emotion/react';
import type {LineSeriesOption} from 'echarts';

import {createLineSeries} from 'sentry/components/charts/series/lineSeries';
import type {Series} from 'sentry/types/echarts';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {AlertRuleThresholdType} from 'sentry/views/alerts/rules/metric/types';

// These are used as series names for chart lookup - do not translate
const UPPER_THRESHOLD_SERIES_NAME = 'Upper Threshold';
const LOWER_THRESHOLD_SERIES_NAME = 'Lower Threshold';

export interface AnomalyThresholdDataPoint {
  external_alert_id: number;
  timestamp: number;
  value: number;
  yhat_lower: number;
  yhat_upper: number;
}

/**
 * Round large anomaly bounds more aggressively while keeping precision for
 * small unitless metrics (e.g. CLS ~0.004) so tooltips don't collapse to 0.
 */
export function smartRound(value: number): number {
  const magnitude = Math.abs(value);

  if (magnitude >= 100) {
    return Math.round(value);
  }
  if (magnitude >= 10) {
    return Math.round(value * 10) / 10;
  }
  if (magnitude >= 1) {
    return Math.round(value * 100) / 100;
  }
  if (magnitude >= 0.1) {
    return Math.round(value * 1000) / 1000;
  }
  if (magnitude >= 0.01) {
    return Math.round(value * 10000) / 10000;
  }

  return value;
}

function createAnomalyBoundSeries({
  name,
  data,
  lineColor,
  origin,
}: {
  data: Array<[number, number]>;
  lineColor: string;
  name: string;
  origin: 'start' | 'end';
}): LineSeriesOption {
  // Threshold series are silent so their areas don't block hovering the open
  // periods drawn beneath them
  return createLineSeries({
    name,
    silent: true,
    data,
    lineStyle: {
      color: lineColor,
      type: 'dashed',
      width: 1,
      dashOffset: 0,
    },
    areaStyle: {
      color: lineColor,
      opacity: 0.05,
      origin,
    },
    itemStyle: {color: lineColor},
    animation: false,
    animationThreshold: 1,
    animationDuration: 0,
    symbol: 'none',
    connectNulls: true,
    step: false,
  });
}

/**
 * Upper and lower anomaly bounds for each data point Seer has bounds for, drawn as
 * dashed lines with the area outside the expected range shaded
 */
export function createAnomalyThresholdSeries({
  anomalyThresholds,
  series,
  theme,
}: {
  anomalyThresholds: AnomalyThresholdDataPoint[];
  series: Series[];
  theme: Theme;
}): LineSeriesOption[] {
  const metricData = series[0]?.data;

  if (anomalyThresholds.length === 0 || !metricData || metricData.length === 0) {
    return [];
  }

  const anomalyMap = new Map(
    anomalyThresholds.map(point => [point.timestamp * 1000, point])
  );

  const upperBoundData: Array<[number, number]> = [];
  const lowerBoundData: Array<[number, number]> = [];

  metricData.forEach(metricPoint => {
    const timestamp =
      typeof metricPoint.name === 'number'
        ? metricPoint.name
        : new Date(metricPoint.name).getTime();
    const anomalyPoint = anomalyMap.get(timestamp);

    if (anomalyPoint) {
      upperBoundData.push([timestamp, smartRound(anomalyPoint.yhat_upper)]);
      lowerBoundData.push([timestamp, smartRound(anomalyPoint.yhat_lower)]);
    }
  });

  const lineColor = theme.colors.red400;

  return [
    createAnomalyBoundSeries({
      name: UPPER_THRESHOLD_SERIES_NAME,
      data: upperBoundData,
      lineColor,
      origin: 'end',
    }),
    createAnomalyBoundSeries({
      name: LOWER_THRESHOLD_SERIES_NAME,
      data: lowerBoundData,
      lineColor,
      origin: 'start',
    }),
  ];
}

export function getAnomalyThresholdType(
  detector: MetricDetector
): AlertRuleThresholdType | undefined {
  const condition = detector.conditionGroup?.conditions[0];

  if (
    condition?.type !== 'anomaly_detection' ||
    typeof condition.comparison === 'number'
  ) {
    return undefined;
  }

  return condition.comparison.thresholdType;
}

/**
 * Keeps the bounds the detector alerts on: the upper bound for above, the lower bound
 * for below, and both for above and below
 */
export function filterAnomalyThresholdSeries<SeriesOption>({
  anomalyThresholdSeries,
  thresholdType,
}: {
  anomalyThresholdSeries: SeriesOption[];
  thresholdType: AlertRuleThresholdType | undefined;
}): SeriesOption[] {
  if (anomalyThresholdSeries.length === 0 || thresholdType === undefined) {
    return [];
  }

  const [upperThreshold, lowerThreshold, seerValue] = anomalyThresholdSeries;

  const filtered = [];
  if (thresholdType !== AlertRuleThresholdType.BELOW) {
    filtered.push(upperThreshold);
  }
  if (thresholdType !== AlertRuleThresholdType.ABOVE) {
    filtered.push(lowerThreshold);
  }
  if (seerValue) {
    filtered.push(seerValue);
  }

  return filtered.filter((s): s is NonNullable<typeof s> => !!s);
}
