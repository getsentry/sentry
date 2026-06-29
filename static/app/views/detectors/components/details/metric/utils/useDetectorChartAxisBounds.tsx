import {useMemo} from 'react';

import type {Series} from 'sentry/types/echarts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';

interface UseChartAxisBoundsProps {
  series: Series[];
  thresholdMaxValue: number | undefined;
  aggregate?: string;
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
  aggregate,
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

    const isPercentage = aggregate && aggregateOutputType(aggregate) === 'percentage';

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

    // Cap percentage metrics at 100% (1.0 in 0-1 scale)
    if (isPercentage && maxValue > 1) {
      maxValue = 1;
    }

    // For percentage metrics, zoom into the data range (e.g. 90% -> 100%) since
    // pinning to 0 hides small variations. For all other metrics, anchor the
    // axis at 0.
    let minValue = 0;
    if (isPercentage) {
      const minPadding = seriesMin * 0.1;
      minValue = Math.max(0, seriesMin - minPadding);
    }

    return {
      maxValue,
      minValue,
    };
  }, [series, thresholdMaxValue, aggregate]);
}
