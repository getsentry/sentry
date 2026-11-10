/**
 * A data point in the format the `/events/anomalies/` endpoint expects
 */
export type AnomalyDataPoint = [timestamp: number, {count: number}];

export interface AnomalyDetectionConfig {
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
  /**
   * Lets Seer apply a static threshold to count metrics. Passed through to Seer
   * unchanged.
   */
  aggregate?: 'count' | 'other';
}

// A type alias (not an interface) so it can be sent as a request body
export type EventAnomalyPayload = {
  config: AnomalyDetectionConfig;
  current_data: AnomalyDataPoint[];
  historical_data: AnomalyDataPoint[];
  organization_id: string;
  project_id: string;
};

/**
 * Drops historical points that overlap the current data, so Seer only sees
 * each timestamp once.
 */
export function removeOverlappingHistoricalData(
  currentData: AnomalyDataPoint[],
  historicalData: AnomalyDataPoint[]
): AnomalyDataPoint[] {
  const startOfCurrentTimeframe = currentData.reduce(
    (value, [timestamp]) => (value < timestamp ? value : timestamp),
    Infinity
  );
  return historicalData.filter(([timestamp]) => timestamp < startOfCurrentTimeframe);
}
