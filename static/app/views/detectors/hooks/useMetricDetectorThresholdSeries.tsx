import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import color from 'color';

import type {AreaChartSeries} from 'sentry/components/charts/areaChart';
import MarkArea from 'sentry/components/charts/components/markArea';
import MarkLine from 'sentry/components/charts/components/markLine';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import type {MetricDetectorConfig} from 'sentry/types/workflowEngine/detectors';

function createThresholdMarkLine(lineColor: string, threshold: number) {
  return MarkLine({
    silent: true,
    lineStyle: {color: lineColor, type: 'dashed', width: 1},
    data: [{yAxis: threshold}],
    label: {
      show: false,
    },
  });
}

function createThresholdMarkArea(areaColor: string, threshold: number, isAbove: boolean) {
  // Highlight the "safe" area - opposite of the alert condition
  const yAxis = isAbove
    ? [{yAxis: 'min'}, {yAxis: threshold}]
    : [{yAxis: threshold}, {yAxis: 'max'}];

  return MarkArea({
    silent: true,
    itemStyle: {
      color: color(areaColor).alpha(0.1).rgb().string(),
    },
    data: [yAxis as any],
  });
}

function extractThresholdsFromConditions(conditions: Array<Omit<DataCondition, 'id'>>): {
  thresholds: Array<{
    priority: DetectorPriorityLevel;
    type: DataConditionType;
    value: number;
  }>;
} {
  const thresholds = conditions
    .filter(condition => condition.conditionResult !== DetectorPriorityLevel.OK)
    .map(condition => ({
      value: condition.comparison,
      priority: condition.conditionResult || DetectorPriorityLevel.MEDIUM,
      type: condition.type,
    }))
    .sort((a, b) => a.value - b.value);

  return {thresholds};
}

interface UseMetricDetectorThresholdSeriesProps {
  conditions: Array<Omit<DataCondition, 'id'>>;
  detectionType: MetricDetectorConfig['detectionType'];
}

interface UseMetricDetectorThresholdSeriesResult {
  /**
   * Helps set the y-axis bounds to ensure all thresholds are visible
   */
  maxValue: number | undefined;
  series: AreaChartSeries[];
}

export function useMetricDetectorThresholdSeries({
  conditions,
  detectionType,
}: UseMetricDetectorThresholdSeriesProps): UseMetricDetectorThresholdSeriesResult {
  const theme = useTheme();

  return useMemo((): UseMetricDetectorThresholdSeriesResult => {
    if (detectionType !== 'static') {
      // Other detectionTypes are not currently supported
      return {series: [], maxValue: undefined};
    }

    const {thresholds} = extractThresholdsFromConditions(conditions);
    const series = thresholds.map((threshold): AreaChartSeries => {
      const isAbove = threshold.type === DataConditionType.GREATER;
      const lineColor =
        threshold.priority === DetectorPriorityLevel.HIGH
          ? theme.red300
          : theme.yellow300;
      const areaColor = lineColor;

      return {
        // This name isn't actually shown in the chart and just contains our markLine and markArea
        seriesName: 'Threshold Line',
        type: 'line',
        markLine: createThresholdMarkLine(lineColor, threshold.value),
        markArea: createThresholdMarkArea(areaColor, threshold.value, isAbove),
        data: [],
      };
    });

    const maxValue = Math.max(...thresholds.map(threshold => threshold.value));

    return {series, maxValue};
  }, [conditions, detectionType, theme]);
}
