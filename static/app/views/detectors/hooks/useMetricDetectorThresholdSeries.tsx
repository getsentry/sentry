import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import type {LineSeriesOption} from 'echarts';

import {markLine} from 'sentry/components/charts/components/markLine';
import {createLineSeries} from 'sentry/components/charts/series/lineSeries';
import type {Series} from 'sentry/types/echarts';
import {
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import type {
  MetricCondition,
  MetricDetectorConfig,
} from 'sentry/types/workflowEngine/detectors';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {isSessionPercentageOperation} from 'sentry/views/detectors/utils/metricDetectorSuffix';
import {percentThresholdAbsoluteToDelta} from 'sentry/views/detectors/utils/percentThreshold';
import {
  createPercentThresholdBandSeries,
  createStaticThresholdBandSeries,
  getThresholdColor,
} from 'sentry/views/detectors/utils/thresholdBands';

function createThresholdMarkLine(lineColor: string, threshold: number) {
  return markLine({
    silent: true,
    lineStyle: {color: lineColor, type: 'dashed', width: 1},
    data: [{yAxis: threshold}],
    label: {
      show: false,
    },
    animation: false,
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

function createPercentResolutionSeries(
  comparisonSeries: Series[],
  resolution: {type: DataConditionType; value: number}
): Series {
  // Resolving at or below a threshold means the alert fires above it
  const isAbove = [DataConditionType.LESS, DataConditionType.LESS_OR_EQUAL].includes(
    resolution.type
  );

  return createPercentThresholdSeries(
    comparisonSeries,
    resolution.value,
    isAbove,
    `${resolution.value}% ${isAbove ? 'Higher' : 'Lower'} Resolution Threshold`
  );
}

/**
 * Normalizes percentage threshold values to 0-1 scale for consistent display.
 * - SESSIONS_OPERATIONS percentages (crash_free_rate, crash_rate, anr_rate, etc.) store values as percentages (5 for 5%)
 * - Other percentage operations like failure_rate() store values as 0-1 (0.05 = 5%)
 */
function normalizePercentageThreshold(aggregate: string, value: number): number {
  const outputType = aggregateOutputType(aggregate);
  if (outputType !== 'percentage') {
    return value;
  }

  // Session operations store as percentage (5 for 5%), needs conversion to 0-1
  if (isSessionPercentageOperation(aggregate)) {
    return value / 100;
  }

  // Other operations like failure_rate store as decimal (0.05 for 5%), already in 0-1 scale
  return value;
}

function extractThresholdsFromConditions(
  conditions: Array<Omit<MetricCondition, 'id'>>,
  aggregate: string,
  detectionType: MetricDetectorConfig['detectionType']
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
    .map(condition => {
      let value = Number(condition.comparison);
      if (detectionType === 'percent') {
        value = percentThresholdAbsoluteToDelta(value);
      } else {
        value = normalizePercentageThreshold(aggregate, value);
      }
      return {
        value,
        priority: condition.conditionResult || DetectorPriorityLevel.MEDIUM,
        type: condition.type,
      };
    })
    .sort((a, b) => a.value - b.value);

  const resolutionCondition = conditions.find(
    condition => condition.conditionResult === DetectorPriorityLevel.OK
  );

  const resolution =
    resolutionCondition && typeof resolutionCondition.comparison === 'number'
      ? {
          type: resolutionCondition.type,
          value:
            detectionType === 'percent'
              ? percentThresholdAbsoluteToDelta(Number(resolutionCondition.comparison))
              : normalizePercentageThreshold(
                  aggregate,
                  Number(resolutionCondition.comparison)
                ),
        }
      : undefined;

  return {thresholds, resolution};
}

interface UseMetricDetectorThresholdSeriesProps {
  /**
   * The aggregate function to determine if thresholds should be scaled for percentage display
   */
  aggregate: string;
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
  aggregate,
  comparisonSeries = [],
}: UseMetricDetectorThresholdSeriesProps): UseMetricDetectorThresholdSeriesResult {
  const theme = useTheme();

  return useMemo((): UseMetricDetectorThresholdSeriesResult => {
    if (!conditions) {
      return {maxValue: undefined, additionalSeries: []};
    }

    const {thresholds, resolution} = extractThresholdsFromConditions(
      conditions,
      aggregate,
      detectionType
    );
    const additional: LineSeriesOption[] = [];

    // Resolution is considered "automatic" when it equals any alert threshold value
    const isResolutionManual = Boolean(
      resolution && !thresholds.some(threshold => threshold.value === resolution.value)
    );

    if (detectionType === 'percent') {
      if (comparisonSeries.length === 0 || thresholds.length === 0) {
        return {maxValue: undefined, additionalSeries: additional};
      }

      const thresholdLines = thresholds.map(threshold => {
        const isAbove = threshold.type === DataConditionType.GREATER;
        const seriesName = `${threshold.value}% ${isAbove ? 'Higher' : 'Lower'} Threshold`;

        return {
          ...threshold,
          series: createPercentThresholdSeries(
            comparisonSeries,
            threshold.value,
            isAbove,
            seriesName
          ),
        };
      });

      const resolutionLine = resolution
        ? createPercentResolutionSeries(comparisonSeries, resolution)
        : undefined;

      // Tooltip rows follow series order: most severe threshold first, resolution last
      const thresholdLinesBySeverity = thresholdLines.toSorted(
        (a, b) => b.priority - a.priority
      );

      const visibleLines = [
        ...thresholdLinesBySeverity.map(({priority, series}) => ({
          series,
          lineColor: getThresholdColor(theme, priority),
        })),
        ...(resolutionLine && isResolutionManual
          ? [{series: resolutionLine, lineColor: theme.colors.green400}]
          : []),
      ];

      const percentThresholdSeries = visibleLines.map(({series, lineColor}) =>
        createLineSeries({
          name: series.seriesName,
          // Don't block hovering the open periods drawn beneath the threshold line
          silent: true,
          data: series.data.map(({name, value}) => [name, value]),
          lineStyle: {
            color: lineColor,
            type: 'dashed',
            width: 2,
          },
          itemStyle: {color: lineColor},
          animation: false,
          animationThreshold: 1,
          animationDuration: 0,
          symbol: 'none', // Hide data point markers
        })
      );

      const percentThresholdBands = createPercentThresholdBandSeries({
        theme,
        thresholds: thresholdLines.map(line => ({...line, bound: line.series.data})),
        resolution: resolutionLine?.data,
      });

      additional.push(...percentThresholdSeries, ...percentThresholdBands);

      // Calculate maxValue from threshold data points (similar to static thresholds)
      const thresholdValues = visibleLines.flatMap(({series}) =>
        series.data.map(point => point.value)
      );

      const maxValue =
        thresholdValues.length > 0 ? Math.max(...thresholdValues) : undefined;
      return {maxValue, additionalSeries: additional};
    }

    if (detectionType === 'static') {
      // For static detection, use traditional horizontal threshold lines
      const thresholdSeries = thresholds.map((threshold): LineSeriesOption => {
        const lineColor = getThresholdColor(theme, threshold.priority);
        // Thresholds are normalized to correct scale via normalizePercentageThreshold()
        const displayThreshold = threshold.value;

        return {
          type: 'line',
          markLine: createThresholdMarkLine(lineColor, displayThreshold),
          data: [],
        };
      });
      additional.push(...thresholdSeries);

      if (resolution && isResolutionManual) {
        // Resolution value is normalized to correct scale via normalizePercentageThreshold()
        const displayResolution = resolution.value;
        const resolutionSeries: LineSeriesOption = {
          type: 'line',
          markLine: createThresholdMarkLine(theme.colors.green400, displayResolution),
          data: [],
        };
        additional.push(resolutionSeries);
      }

      const staticThresholdBands = createStaticThresholdBandSeries({
        theme,
        thresholds: thresholds.map(threshold => ({...threshold, bound: threshold.value})),
        resolution: resolution?.value,
      });

      additional.push(...staticThresholdBands);

      const valuesForMax = [
        ...thresholds.map(threshold => threshold.value),
        ...(resolution && isResolutionManual ? [resolution.value] : []),
      ];
      const maxValue = valuesForMax.length > 0 ? Math.max(...valuesForMax) : undefined;
      return {maxValue, additionalSeries: additional};
    }

    // Other detection types not supported yet
    return {maxValue: undefined, additionalSeries: additional};
  }, [aggregate, conditions, detectionType, comparisonSeries, theme]);
}
