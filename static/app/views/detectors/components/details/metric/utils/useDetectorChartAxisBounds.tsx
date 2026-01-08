import {useMemo} from 'react';

import type {Series} from 'sentry/types/echarts';

interface UseChartAxisBoundsProps {
  series: Series[];
  thresholdMaxValue: number | undefined;
}

interface ChartAxisBounds {
  maxValue: number;
  minValue: number;
}

/**
 * Calculates y-axis bounds for detector charts based on series data and threshold values.
 * Adds padding to ensure all data points and thresholds are visible.
 */
export function useDetectorChartAxisBounds({
  series,
  thresholdMaxValue,
}: UseChartAxisBoundsProps): ChartAxisBounds {
  return useMemo(() => {
    if (series.length === 0) {
      return {maxValue: 0, minValue: 0};
    }

    const allSeriesValues = series.flatMap(s =>
      s.data
        .map(point => point.value)
        .filter(val => typeof val === 'number' && !isNaN(val))
    );

    if (allSeriesValues.length === 0) {
      return {maxValue: 0, minValue: 0};
    }

    const seriesMax = Math.max(...allSeriesValues);
    const seriesMin = Math.min(...allSeriesValues);

    // Determine the max value: use threshold if it's higher than data, otherwise add padding to data
    let maxValue: number;
    if (thresholdMaxValue && thresholdMaxValue >= seriesMax) {
      // Threshold is the limiting factor - use it as-is without padding
      maxValue = thresholdMaxValue;
    } else {
      // Data exceeds threshold - add padding to show data clearly above threshold
      const maxPadding = seriesMax * 0.1;
      maxValue = seriesMax + maxPadding;
    }

    // Add padding to min value
    const minPadding = seriesMin * 0.1;
    const minValue = Math.max(0, seriesMin - minPadding);

    return {
      maxValue,
      minValue,
    };
  }, [series, thresholdMaxValue]);
}
