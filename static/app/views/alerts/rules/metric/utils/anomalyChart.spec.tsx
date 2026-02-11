import {ThemeFixture} from 'sentry-fixture/theme';

import {getAnomalyMarkerSeries} from 'sentry/views/alerts/rules/metric/utils/anomalyChart';
import {AnomalyType, type Anomaly} from 'sentry/views/alerts/types';

const theme = ThemeFixture();

const anomaly: Anomaly['anomaly'] = {anomaly_type: AnomalyType.NONE, anomaly_score: 0};
const anomaly_high: Anomaly['anomaly'] = {
  anomaly_type: AnomalyType.HIGH_CONFIDENCE,
  anomaly_score: 2,
};
const anomaly_low: Anomaly['anomaly'] = {
  anomaly_type: AnomalyType.LOW_CONFIDENCE,
  anomaly_score: 1,
};

describe('anomalyChart', () => {
  it('should return an empty array for empty anomalies', () => {
    expect(getAnomalyMarkerSeries([], {theme})).toEqual([]);
  });

  it('should not create anomaly values', () => {
    const input: Anomaly[] = [
      {
        anomaly,
        timestamp: d(-3),
        value: 1,
      },
      {
        anomaly,
        timestamp: d(-2),
        value: 1,
      },
    ];

    expect(getAnomalyMarkerSeries(input, {theme})).toHaveLength(1);
  });

  it('should create two anomaly areas', () => {
    const input: Anomaly[] = [
      {
        anomaly: anomaly_high,
        timestamp: d(-3),
        value: 1,
      },
      {
        anomaly: anomaly_high,
        timestamp: d(-2),
        value: 1,
      },
      {
        anomaly,
        timestamp: d(-1),
        value: 0,
      },
      {
        anomaly,
        timestamp: d(-1),
        value: 0,
      },
    ];

    expect(getAnomalyMarkerSeries(input, {theme})).toHaveLength(2);
  });

  it('should create three anomaly areas', () => {
    const input: Anomaly[] = [
      {
        anomaly: anomaly_high,
        timestamp: d(-3),
        value: 1,
      },
      {
        anomaly: anomaly_high,
        timestamp: d(-2),
        value: 1,
      },
      {
        anomaly,
        timestamp: d(-1),
        value: 0,
      },
      {
        anomaly,
        timestamp: d(-1),
        value: 0,
      },
      {
        anomaly: anomaly_low,
        timestamp: d(1),
        value: 2,
      },
      {
        anomaly: anomaly_low,
        timestamp: d(2),
        value: 2,
      },
    ];

    expect(getAnomalyMarkerSeries(input, {theme})).toHaveLength(3);
  });
});

function d(offset: number) {
  const value = new Date();
  value.setHours(12);
  value.setDate(value.getDate() + offset);
  return value.valueOf();
}
