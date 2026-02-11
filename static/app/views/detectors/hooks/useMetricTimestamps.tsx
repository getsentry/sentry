import {useMemo} from 'react';

import type {Series} from 'sentry/types/echarts';

interface MetricTimestamps {
  end: number | undefined;
  start: number | undefined;
}

export function useMetricTimestamps(series: Series[]): MetricTimestamps {
  return useMemo(() => {
    const firstSeries = series[0];
    if (!firstSeries?.data.length) {
      return {start: undefined, end: undefined};
    }
    const data = firstSeries.data;
    const firstPoint = data[0];
    const lastPoint = data[data.length - 1];

    if (!firstPoint || !lastPoint) {
      return {start: undefined, end: undefined};
    }

    const firstTimestamp =
      typeof firstPoint.name === 'number'
        ? firstPoint.name
        : new Date(firstPoint.name).getTime();
    const lastTimestamp =
      typeof lastPoint.name === 'number'
        ? lastPoint.name
        : new Date(lastPoint.name).getTime();

    return {
      start: Math.floor(firstTimestamp / 1000),
      end: Math.floor(lastTimestamp / 1000),
    };
  }, [series]);
}
