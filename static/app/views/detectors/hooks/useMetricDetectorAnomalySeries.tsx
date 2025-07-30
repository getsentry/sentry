import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import type {AreaChartSeries} from 'sentry/components/charts/areaChart';
import type {Series} from 'sentry/types/echarts';
import {TimePeriod} from 'sentry/views/alerts/rules/metric/types';
import {getAnomalyMarkerSeries} from 'sentry/views/alerts/rules/metric/utils/anomalyChart';
import type {Anomaly} from 'sentry/views/alerts/types';
import {
  HISTORICAL_TIME_PERIOD_MAP,
  HISTORICAL_TIME_PERIOD_MAP_FIVE_MINS,
} from 'sentry/views/alerts/utils/timePeriods';
import type {DetectorDataset} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {useMetricDetectorSeries} from 'sentry/views/detectors/hooks/useMetricDetectorSeries';

import {useMetricDetectorAnomalies} from './useMetricDetectorAnomalies';

interface UseMetricDetectorAnomalySeriesProps {
  aggregate: string;
  dataset: DetectorDataset;
  direction: 'up' | 'down' | 'both';
  enabled: boolean;
  environment: string | undefined;
  expectedSeasonality: string;
  projectId: string;
  query: string;
  sensitivity: string;
  series: Series[];
  statsPeriod: TimePeriod;
  timePeriod: number;
}

interface AnomalySeries {
  anomalySeries: AreaChartSeries[];
  error: Error | null;
  formattedAnomalies: Anomaly[];
  isLoading: boolean;
  refetch: () => void;
}

export function useMetricDetectorAnomalySeries({
  series,
  dataset,
  aggregate,
  query,
  environment,
  projectId,
  statsPeriod,
  timePeriod,
  direction,
  sensitivity,
  expectedSeasonality,
  enabled,
}: UseMetricDetectorAnomalySeriesProps): AnomalySeries {
  const theme = useTheme();

  // Fetch historical data with extended time period for anomaly detection baseline comparison
  const historicalPeriod =
    timePeriod === 5
      ? HISTORICAL_TIME_PERIOD_MAP_FIVE_MINS[
          statsPeriod as keyof typeof HISTORICAL_TIME_PERIOD_MAP_FIVE_MINS
        ]
      : HISTORICAL_TIME_PERIOD_MAP[
          statsPeriod as keyof typeof HISTORICAL_TIME_PERIOD_MAP
        ];

  const {series: historicalSeries} = useMetricDetectorSeries({
    dataset,
    aggregate,
    interval: timePeriod,
    query,
    environment,
    projectId,
    statsPeriod: historicalPeriod as TimePeriod,
  });

  const {
    data: anomalies,
    isLoading,
    error,
    refetch,
  } = useMetricDetectorAnomalies({
    series,
    historicalSeries,
    projectId,
    direction,
    sensitivity,
    expectedSeasonality,
    timePeriod,
    enabled,
  });
  const {anomalySeries, formattedAnomalies} = useMemo(() => {
    if (!anomalies || anomalies.length === 0) {
      return {
        anomalySeries: [],
        formattedAnomalies: [],
      };
    }

    // Transform API response to Anomaly type format
    const formatted: Anomaly[] = anomalies.map(item => ({
      anomaly: item.anomaly,
      timestamp: item.timestamp,
      value: item.value,
    }));

    // Use the proper anomaly marker series function that creates highlighted areas and marker lines
    const markerSeries = getAnomalyMarkerSeries(formatted, {theme});

    return {
      anomalySeries: markerSeries,
      formattedAnomalies: formatted,
    };
  }, [anomalies, theme]);

  return {
    anomalySeries,
    formattedAnomalies,
    isLoading,
    error,
    refetch,
  };
}
