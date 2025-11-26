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

    // Combine with threshold max and round to nearest whole number
    const combinedMax = thresholdMaxValue
      ? Math.max(seriesMax, thresholdMaxValue)
      : seriesMax;

    const roundedMax = Math.round(combinedMax);

    // Add padding to the bounds
    const maxPadding = roundedMax * 0.1;
    const minPadding = seriesMin * 0.1;

    return {
      maxValue: roundedMax + maxPadding,
      minValue: Math.max(0, seriesMin - minPadding),
    };
  }, [series, thresholdMaxValue]);
}
