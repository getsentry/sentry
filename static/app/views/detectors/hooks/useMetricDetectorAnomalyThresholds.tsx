import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import type {LineSeriesOption} from 'echarts';

import {lineSeries} from 'sentry/components/charts/series/lineSeries';
import type {Series} from 'sentry/types/echarts';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';

// These are used as series names for chart lookup - do not translate
const UPPER_THRESHOLD_SERIES_NAME = 'Upper Threshold';
const LOWER_THRESHOLD_SERIES_NAME = 'Lower Threshold';

interface AnomalyThresholdDataPoint {
  external_alert_id: number;
  timestamp: number;
  value: number;
  yhat_lower: number;
  yhat_upper: number;
}

interface AnomalyThresholdDataResponse {
  data: AnomalyThresholdDataPoint[];
}

interface UseMetricDetectorAnomalyThresholdsProps {
  detectorId: string;
  detectionType?: string;
  endTimestamp?: number;
  series?: Series[];
  startTimestamp?: number;
}

interface UseMetricDetectorAnomalyThresholdsResult {
  anomalyThresholdSeries: LineSeriesOption[];
  error: RequestError | null;
  isLoading: boolean;
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

/**
 * Fetches anomaly detection threshold data and transforms it into chart series
 */
export function useMetricDetectorAnomalyThresholds({
  detectorId,
  detectionType,
  startTimestamp,
  endTimestamp,
  series = [],
}: UseMetricDetectorAnomalyThresholdsProps): UseMetricDetectorAnomalyThresholdsResult {
  const organization = useOrganization();
  const theme = useTheme();

  const isAnomalyDetection = detectionType === 'dynamic';

  const {
    data: anomalyData,
    isLoading,
    error,
  } = useApiQuery<AnomalyThresholdDataResponse>(
    [
      getApiUrl(
        '/organizations/$organizationIdOrSlug/detectors/$detectorId/anomaly-data/',
        {
          path: {organizationIdOrSlug: organization.slug, detectorId},
        }
      ),
      {
        query: {
          start: startTimestamp,
          end: endTimestamp,
        },
      },
    ],
    {
      staleTime: 0,
      enabled:
        isAnomalyDetection && Boolean(detectorId && startTimestamp && endTimestamp),
    }
  );

  const anomalyThresholdSeries = useMemo(() => {
    if (!anomalyData?.data || anomalyData.data.length === 0 || series.length === 0) {
      return [];
    }

    const data = anomalyData.data;
    const metricData = series[0]?.data;

    if (!metricData || metricData.length === 0) {
      return [];
    }

    const anomalyMap = new Map(data.map(point => [point.timestamp * 1000, point]));

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
      lineSeries({
        name: UPPER_THRESHOLD_SERIES_NAME,
        data: upperBoundData,
        lineStyle: {
          color: lineColor,
          type: 'dashed',
          width: 1,
          dashOffset: 0,
        },
        areaStyle: {
          color: lineColor,
          opacity: 0.05,
          origin: 'end',
        },
        itemStyle: {color: lineColor},
        animation: false,
        animationThreshold: 1,
        animationDuration: 0,
        symbol: 'none',
        connectNulls: true,
        step: false,
      }),
      lineSeries({
        name: LOWER_THRESHOLD_SERIES_NAME,
        data: lowerBoundData,
        lineStyle: {
          color: lineColor,
          type: 'dashed',
          width: 1,
          dashOffset: 0,
        },
        areaStyle: {
          color: lineColor,
          opacity: 0.05,
          origin: 'start',
        },
        itemStyle: {color: lineColor},
        animation: false,
        animationThreshold: 1,
        animationDuration: 0,
        symbol: 'none',
        connectNulls: true,
        step: false,
      }),
    ];
  }, [anomalyData, series, theme]);

  return {anomalyThresholdSeries, isLoading, error};
}
