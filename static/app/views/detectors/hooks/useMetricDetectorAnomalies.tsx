import type {Series} from 'sentry/types/echarts';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {AnomalyType} from 'sentry/views/alerts/types';

interface EventAnomalyPayload extends Record<string, unknown> {
  config: {
    direction: 'up' | 'down' | 'both';
    expected_seasonality: string;
    sensitivity: string;
    /**
     * Time period in minutes (why)
     */
    time_period: number;
  };
  current_data: Array<[number, {count: number}]>;
  historical_data: Array<[number, {count: number}]>;
  organization_id: string;
  project_id: string;
}

interface UseMetricDetectorAnomaliesProps {
  direction: 'up' | 'down' | 'both';
  expectedSeasonality: string;
  historicalSeries: Series[];
  projectId: string;
  sensitivity: string;
  series: Series[];
  timePeriod: number;
  enabled?: boolean;
}

type AnomalyResponse = Array<{
  anomaly: {anomaly_score: number; anomaly_type: AnomalyType};
  timestamp: number;
  value: number;
}>;

function transformSeriesToDataPoints(series: Series[]): Array<[number, {count: number}]> {
  // Handle the case where there's only one series (which is typical)
  if (series.length === 0 || !series[0]?.data?.length) {
    return [];
  }

  const seriesData = series[0].data;
  const dataPoints: Array<[number, {count: number}]> = seriesData.map(({name, value}) => [
    Number(name) / 1000,
    {count: Number(value) || 0},
  ]);

  // Sort by timestamp
  return dataPoints.sort(([a], [b]) => a - b);
}

export function useMetricDetectorAnomalies({
  series,
  historicalSeries,
  direction,
  sensitivity,
  expectedSeasonality,
  timePeriod,
  projectId,
  enabled = true,
}: UseMetricDetectorAnomaliesProps) {
  const organization = useOrganization();

  const currentData = transformSeriesToDataPoints(series);
  const historicalData = transformSeriesToDataPoints(historicalSeries);

  // Filter out historical data that overlaps with current data
  const startOfCurrentTimeframe = currentData.reduce(
    (value, [timestamp]) => (value < timestamp ? value : timestamp),
    Infinity
  );

  // Remove historical data that overlaps with current dataset to avoid duplication
  const filteredHistoricalData = historicalData.filter(
    ([timestamp]) => timestamp < startOfCurrentTimeframe
  );

  const payload: EventAnomalyPayload = {
    organization_id: organization.id,
    project_id: projectId,
    config: {
      direction,
      expected_seasonality: expectedSeasonality,
      sensitivity,
      time_period: timePeriod / 60,
    },
    current_data: currentData,
    historical_data: filteredHistoricalData,
  };

  const {data, isLoading, error, refetch} = useApiQuery<AnomalyResponse>(
    [
      `/organizations/${organization.slug}/events/anomalies/`,
      {
        method: 'POST',
        data: payload,
      },
    ],
    {
      staleTime: 30_000,
      enabled: currentData.length > 0 && enabled,
    }
  );

  return {
    data,
    isLoading,
    error,
    refetch,
  };
}
