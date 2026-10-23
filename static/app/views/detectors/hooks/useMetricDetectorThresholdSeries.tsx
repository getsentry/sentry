import {useMemo} from 'react';
import {useTheme, type Theme} from '@emotion/react';
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
  getThresholdBands,
  type ThresholdBand,
  type ThresholdBound,
} from 'sentry/views/detectors/utils/thresholdBands';

function getThresholdColor(theme: Theme, priority: DetectorPriorityLevel): string {
  return priority === DetectorPriorityLevel.HIGH
    ? theme.colors.red400
    : theme.colors.yellow400;
}

function sortThresholdsBySeverity<Threshold extends {priority: DetectorPriorityLevel}>(
  thresholds: Threshold[]
): Threshold[] {
  return thresholds.toSorted((a, b) => a.priority - b.priority);
}

function createPriorityThresholdBands<Bound extends ThresholdBound>({
  resolution,
  theme,
  thresholds,
}: {
  theme: Theme;
  thresholds: Array<{
    bound: Bound;
    priority: DetectorPriorityLevel;
    type: DataConditionType;
  }>;
  resolution?: Bound;
}): Array<ThresholdBand<Bound>> {
  const thresholdsBySeverity = sortThresholdsBySeverity(thresholds);

  const [leastSevereThreshold] = thresholdsBySeverity;

  if (!leastSevereThreshold) {
    return [];
  }

  return getThresholdBands({
    alertBoundaries: thresholdsBySeverity.map(threshold => ({
      bound: threshold.bound,
      color: getThresholdColor(theme, threshold.priority),
    })),
    isAbove: leastSevereThreshold.type === DataConditionType.GREATER,
    okBoundary: {
      bound: resolution ?? leastSevereThreshold.bound,
      color: theme.colors.green400,
    },
  });
}

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

      const percentThresholdSeries = thresholdLines.map(({priority, series}) => {
        const lineColor = getThresholdColor(theme, priority);

        return createLineSeries({
          name: series.seriesName,
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
        });
      });

      const percentThresholdBands = createPriorityThresholdBands({
        theme,
        thresholds: thresholdLines.map(line => ({...line, bound: line.series.data})),
      });

      additional.push(
        ...percentThresholdSeries,
        ...percentThresholdBands.flatMap((band, index) =>
          createPercentThresholdBandSeries(band, `percent-threshold-band-${index}`)
        )
      );

      // Calculate maxValue from threshold data points (similar to static thresholds)
      const thresholdValues = thresholdLines.flatMap(({series}) =>
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

      // Resolution is considered "automatic" when it equals any alert threshold value
      const isResolutionManual = Boolean(
        resolution && !thresholds.some(threshold => threshold.value === resolution.value)
      );
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

      const staticThresholdBands = createPriorityThresholdBands({
        theme,
        thresholds: thresholds.map(threshold => ({...threshold, bound: threshold.value})),
        resolution: resolution?.value,
      });

      additional.push(...staticThresholdBands.map(createStaticThresholdBandSeries));

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
