import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import type {LineSeriesOption} from 'echarts';

import LineSeries from 'sentry/components/charts/series/lineSeries';
import type {Series} from 'sentry/types/echarts';
import {useApiQuery} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';

// These are used as series names for chart lookup - do not translate
export const UPPER_THRESHOLD_SERIES_NAME = 'Upper Threshold';
export const LOWER_THRESHOLD_SERIES_NAME = 'Lower Threshold';

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
  isLegacyAlert?: boolean; // for Alerts, remove this once organizations:workflow-engine-ui is GAd
  series?: Series[];
  startTimestamp?: number;
}

interface UseMetricDetectorAnomalyThresholdsResult {
  anomalyThresholdSeries: LineSeriesOption[];
  error: RequestError | null;
  isLoading: boolean;
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
  isLegacyAlert = false,
}: UseMetricDetectorAnomalyThresholdsProps): UseMetricDetectorAnomalyThresholdsResult {
  const organization = useOrganization();
  const theme = useTheme();

  const hasAnomalyDataFlag = organization.features.includes(
    'anomaly-detection-threshold-data'
  );
  const isAnomalyDetection = detectionType === 'dynamic';

  const {
    data: anomalyData,
    isLoading,
    error,
  } = useApiQuery<AnomalyThresholdDataResponse>(
    [
      `/organizations/${organization.slug}/detectors/${detectorId}/anomaly-data/`,
      {
        query: {
          start: startTimestamp,
          end: endTimestamp,
          ...(isLegacyAlert && {legacy_alert: 'true'}),
        },
      },
    ],
    {
      staleTime: 0,
      enabled:
        hasAnomalyDataFlag &&
        isAnomalyDetection &&
        Boolean(detectorId && startTimestamp && endTimestamp),
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
        upperBoundData.push([timestamp, Math.round(anomalyPoint.yhat_upper)]);
        lowerBoundData.push([timestamp, Math.round(anomalyPoint.yhat_lower)]);
      }
    });

    const lineColor = theme.colors.red400;

    return [
      LineSeries({
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
      LineSeries({
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
