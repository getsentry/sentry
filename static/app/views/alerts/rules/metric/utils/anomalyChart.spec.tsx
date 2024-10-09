import {getAnomalyMarkerSeries} from 'sentry/views/alerts/rules/metric/utils/anomalyChart';
import type {Anomaly} from 'sentry/views/alerts/types';

describe('anomalyChart', () => {
  it('should return an empty array for empty anomalies', () => {
    const input: Anomaly[] = [];
    const output = [];
    expect(getAnomalyMarkerSeries(input)).toEqual(output);
  });

  it('should not create anomaly values', () => {
    const input: Anomaly[] = [
      {
        anomaly: {anomaly_type: 'none'},
        timestamp: d(-3).toISOString(),
        value: 1,
      },
      {
        anomaly: {anomaly_type: 'none'},
        timestamp: d(-2).toISOString(),
        value: 1,
      },
    ];

    expect(getAnomalyMarkerSeries(input)).toHaveLength(1);
  });

  it('should create two anomaly areas', () => {
    const input: Anomaly[] = [
      {
        anomaly: {anomaly_type: 'anomaly_higher_confidence'},
        timestamp: d(-3).toISOString(),
        value: 1,
      },
      {
        anomaly: {anomaly_type: 'anomaly_higher_confidence'},
        timestamp: d(-2).toISOString(),
        value: 1,
      },
      {
        anomaly: {anomaly_type: 'none'},
        timestamp: d(-1).toISOString(),
        value: 0,
      },
      {
        anomaly: {anomaly_type: 'none'},
        timestamp: d(-1).toISOString(),
        value: 0,
      },
    ];

    expect(getAnomalyMarkerSeries(input)).toHaveLength(2);
  });

  it('should create three anomaly areas', () => {
    const input: Anomaly[] = [
      {
        anomaly: {anomaly_type: 'anomaly_higher_confidence'},
        timestamp: d(-3).toISOString(),
        value: 1,
      },
      {
        anomaly: {anomaly_type: 'anomaly_higher_confidence'},
        timestamp: d(-2).toISOString(),
        value: 1,
      },
      {
        anomaly: {anomaly_type: 'none'},
        timestamp: d(-1).toISOString(),
        value: 0,
      },
      {
        anomaly: {anomaly_type: 'none'},
        timestamp: d(-1).toISOString(),
        value: 0,
      },
      {
        anomaly: {anomaly_type: 'anomaly_lower_confidence'},
        timestamp: d(1).toISOString(),
        value: 2,
      },
      {
        anomaly: {anomaly_type: 'anomaly_lower_confidence'},
        timestamp: d(2).toISOString(),
        value: 2,
      },
    ];

    expect(getAnomalyMarkerSeries(input)).toHaveLength(3);
  });

  it('should filter results based on startDate and endDate', () => {
    const today = new Date();

    const input: Anomaly[] = [-2, -1, 0, 1, 2].map(offset => ({
      anomaly: {},
      timestamp: new Date(today.getUTCDate() + offset).toUTCString(),
      value: 0,
    }));
    const opts = {
      startDate: new Date(today.getUTCDate() - 1),
      endDate: new Date(today.getUTCDate() + 1),
    };

    expect(getAnomalyMarkerSeries(input, opts)).toHaveLength(1);
  });
});

function d(offset: number) {
  const value = new Date();
  value.setHours(12);
  value.setDate(value.getDate() + offset);
  return value;
}
