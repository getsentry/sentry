import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import color from 'color';
import type {LineSeriesOption} from 'echarts';

import MarkArea from 'sentry/components/charts/components/markArea';
import MarkLine from 'sentry/components/charts/components/markLine';
import LineSeries from 'sentry/components/charts/series/lineSeries';
import type {Series} from 'sentry/types/echarts';
import {
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import type {
  MetricCondition,
  MetricDetectorConfig,
} from 'sentry/types/workflowEngine/detectors';

function createThresholdMarkLine(lineColor: string, threshold: number) {
  return MarkLine({
    silent: true,
    lineStyle: {color: lineColor, type: 'dashed', width: 1},
    data: [{yAxis: threshold}],
    label: {
      show: false,
    },
    animation: false,
  });
}

function createThresholdMarkArea(areaColor: string, threshold: number, isAbove: boolean) {
  return MarkArea({
    silent: true,
    itemStyle: {
      color: color(areaColor).alpha(0.1).rgb().string(),
    },
    data: [
      // Highlight the "safe" area - opposite of the alert condition
      isAbove
        ? [{yAxis: 'min'}, {yAxis: threshold}]
        : [{yAxis: threshold}, {yAxis: 'max'}],
    ],
  });
}

function createPercentThresholdSeries(
  comparisonSeries: Series[],
  thresholdPercentage: number,
  isAbove: boolean,
  seriesName: string
): Series {
  if (!comparisonSeries.length || !comparisonSeries[0]?.data.length) {
    return {
      seriesName,
      data: [],
    };
  }

  const comparisonData = comparisonSeries[0].data;

  // Calculate threshold points: comparison value ± percentage
  const thresholdData = comparisonData.map(point => {
    const comparisonValue = point.value;
    const multiplier = isAbove
      ? 1 + thresholdPercentage / 100
      : 1 - thresholdPercentage / 100;
    // Clamp to 0 to avoid negative values
    const thresholdValue = Math.max(comparisonValue * multiplier, 0);

    return {
      name: point.name,
      value: thresholdValue,
    };
  });

  return {
    seriesName,
    data: thresholdData,
  };
}

function extractThresholdsFromConditions(
  conditions: Array<Omit<MetricCondition, 'id'>>
): {
  thresholds: Array<{
    priority: DetectorPriorityLevel;
    type: DataConditionType;
    value: number;
  }>;
  resolution?: {type: DataConditionType; value: number};
} {
  const thresholds = conditions
    .filter(
      condition =>
        condition.conditionResult !== DetectorPriorityLevel.OK &&
        typeof condition.comparison === 'number'
    )
    .map(condition => ({
      value: Number(condition.comparison),
      priority: condition.conditionResult || DetectorPriorityLevel.MEDIUM,
      type: condition.type,
    }))
    .sort((a, b) => a.value - b.value);

  const resolutionCondition = conditions.find(
    condition => condition.conditionResult === DetectorPriorityLevel.OK
  );

  const resolution =
    resolutionCondition && typeof resolutionCondition.comparison === 'number'
      ? {type: resolutionCondition.type, value: Number(resolutionCondition.comparison)}
      : undefined;

  return {thresholds, resolution};
}

interface UseMetricDetectorThresholdSeriesProps {
  conditions: Array<Omit<MetricCondition, 'id'>> | undefined;
  detectionType: MetricDetectorConfig['detectionType'];
  comparisonSeries?: Series[];
}

interface UseMetricDetectorThresholdSeriesResult {
  /**
   * Complete additional series array for chart (includes comparison, thresholds, static thresholds)
   */
  additionalSeries: LineSeriesOption[];
  /**
   * Helps set the y-axis bounds to ensure all thresholds are visible
   */
  maxValue: number | undefined;
}

export function useMetricDetectorThresholdSeries({
  conditions,
  detectionType,
  comparisonSeries = [],
}: UseMetricDetectorThresholdSeriesProps): UseMetricDetectorThresholdSeriesResult {
  const theme = useTheme();

  return useMemo((): UseMetricDetectorThresholdSeriesResult => {
    if (!conditions) {
      return {maxValue: undefined, additionalSeries: []};
    }

    const {thresholds, resolution} = extractThresholdsFromConditions(conditions);
    const additional: LineSeriesOption[] = [];

    if (detectionType === 'percent') {
      if (comparisonSeries.length === 0 || thresholds.length === 0) {
        return {maxValue: undefined, additionalSeries: additional};
      }

      const percentThresholdSeries = thresholds.map(threshold => {
        const isAbove = threshold.type === DataConditionType.GREATER;
        const lineColor =
          threshold.priority === DetectorPriorityLevel.HIGH
            ? theme.red300
            : theme.yellow300;

        const seriesName = `${threshold.value}% ${isAbove ? 'Higher' : 'Lower'} Threshold`;

        const series = createPercentThresholdSeries(
          comparisonSeries,
          threshold.value,
          isAbove,
          seriesName
        );

        return LineSeries({
          name: seriesName,
          data: series.data.map(({name, value}) => [name, value]),
          lineStyle: {
            color: lineColor,
            type: 'dashed',
            width: 2,
          },
          areaStyle: {
            color: lineColor,
            opacity: 0.2,
            origin: isAbove ? 'end' : 'start', // Apply area style in appropriate direction
          },
          itemStyle: {color: lineColor},
          animation: false,
          animationThreshold: 1,
          animationDuration: 0,
          symbol: 'none', // Hide data point markers
        });
      });

      additional.push(...percentThresholdSeries);

      // Calculate maxValue from threshold data points (similar to static thresholds)
      const thresholdValues = thresholds.flatMap(threshold => {
        const isAbove = threshold.type === DataConditionType.GREATER;
        const series = createPercentThresholdSeries(
          comparisonSeries,
          threshold.value,
          isAbove,
          `${threshold.value}% ${isAbove ? 'Higher' : 'Lower'} Threshold`
        );
        return series.data.map(point => point.value);
      });

      const maxValue =
        thresholdValues.length > 0 ? Math.max(...thresholdValues) : undefined;
      return {maxValue, additionalSeries: additional};
    }

    if (detectionType === 'static') {
      // For static detection, use traditional horizontal threshold lines
      const thresholdSeries = thresholds.map((threshold): LineSeriesOption => {
        const isAbove = threshold.type === DataConditionType.GREATER;
        const lineColor =
          threshold.priority === DetectorPriorityLevel.HIGH
            ? theme.red300
            : theme.yellow300;
        const areaColor = lineColor;

        return {
          type: 'line',
          markLine: createThresholdMarkLine(lineColor, threshold.value),
          markArea: createThresholdMarkArea(areaColor, threshold.value, isAbove),
          data: [],
        };
      });

      additional.push(...thresholdSeries);
      // Add manual resolution line and safe area if present (green)
      if (resolution) {
        const resolutionSeries: LineSeriesOption = {
          type: 'line',
          markLine: createThresholdMarkLine(theme.green300, resolution.value),
          markArea: createThresholdMarkArea(
            theme.green300,
            resolution.value,
            resolution.type === DataConditionType.GREATER
          ),
          data: [],
        };
        additional.push(resolutionSeries);
      }

      const valuesForMax = [
        ...thresholds.map(threshold => threshold.value),
        ...(resolution ? [resolution.value] : []),
      ];
      const maxValue = valuesForMax.length > 0 ? Math.max(...valuesForMax) : undefined;
      return {maxValue, additionalSeries: additional};
    }

    // Other detection types not supported yet
    return {maxValue: undefined, additionalSeries: additional};
  }, [conditions, detectionType, comparisonSeries, theme]);
}
