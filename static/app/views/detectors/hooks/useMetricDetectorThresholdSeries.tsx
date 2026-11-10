import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {
  getMetricDetectorThresholdSeries,
  type MetricDetectorThresholdSeries,
  type MetricDetectorThresholdSeriesOptions,
} from 'sentry/views/detectors/utils/metricDetectorThresholdSeries';

type UseMetricDetectorThresholdSeriesProps = Omit<
  MetricDetectorThresholdSeriesOptions,
  'theme'
>;

export function useMetricDetectorThresholdSeries({
  conditions,
  detectionType,
  aggregate,
  comparisonSeries,
}: UseMetricDetectorThresholdSeriesProps): MetricDetectorThresholdSeries {
  const theme = useTheme();

  return useMemo(
    () =>
      getMetricDetectorThresholdSeries({
        conditions,
        detectionType,
        aggregate,
        comparisonSeries,
        theme,
      }),
    [aggregate, comparisonSeries, conditions, detectionType, theme]
  );
}
