import type {Series} from 'sentry/types/echarts';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
} from 'sentry/views/alerts/rules/metric/types';
import type {Anomaly} from 'sentry/views/alerts/types';

const ANOMALY_DETECTION_THRESHOLD_TYPE_MAP = {
  [AlertRuleThresholdType.ABOVE]: 'up',
  [AlertRuleThresholdType.BELOW]: 'down',
  [AlertRuleThresholdType.ABOVE_AND_BELOW]: 'both',
} as const;

interface EventAnomalyPayload {
  config: {
    direction: 'up' | 'down' | 'both';
    /**
     * So far expected_seasonality is not used
     */
    expected_seasonality: 'auto';
    sensitivity: 'low' | 'medium' | 'high';
    /**
     * Time period in minutes (why)
     */
    time_period: number;
  };
  current_data: Array<[timestamp: number, {count: number}]>;
  historical_data: Array<[timestamp: number, {count: number}]>;
  organization_id: string;
  project_id: string;
}

interface UseMetricDetectorAnomaliesProps {
  historicalSeries: Series[];
  projectId: string;
  sensitivity: AlertRuleSensitivity | undefined;
  series: Series[];
  thresholdType: AlertRuleThresholdType | undefined;
  timePeriod: number;
  enabled?: boolean;
}

function transformSeriesToDataPoints(series: Series[]): Array<[number, {count: number}]> {
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
  thresholdType,
  sensitivity,
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
  const filteredHistoricalData = historicalData.filter(
    ([timestamp]) => timestamp < startOfCurrentTimeframe
  );

  const payload: EventAnomalyPayload = {
    organization_id: organization.id,
    project_id: projectId,
    config: {
      direction: thresholdType
        ? ANOMALY_DETECTION_THRESHOLD_TYPE_MAP[thresholdType]
        : 'both',
      expected_seasonality: 'auto',
      sensitivity: sensitivity || 'medium',
      time_period: timePeriod / 60,
    },
    current_data: currentData,
    historical_data: filteredHistoricalData,
  };

  const {data, isLoading, error, refetch} = useApiQuery<Anomaly[]>(
    [
      `/organizations/${organization.slug}/events/anomalies/`,
      {
        method: 'POST',
        data: payload,
      },
    ],
    {
      staleTime: Infinity,
      enabled: filteredHistoricalData.length > 0 && currentData.length > 0 && enabled,
    }
  );

  return {
    data,
    isLoading,
    error,
    refetch,
  };
}
