import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {determineTimeSeriesConfidence} from 'sentry/views/alerts/rules/metric/utils/determineSeriesConfidence';

describe('determineTimeSeriesConfidence', () => {
  it('equal null if no data', () => {
    const confidence = determineTimeSeriesConfidence(
      TimeSeriesFixture({
        values: [],
      })
    );
    expect(confidence).toBeNull();
  });

  it('equal null if no confidence found', () => {
    const confidence = determineTimeSeriesConfidence(
      TimeSeriesFixture({
        values: [
          {timestamp: 100, value: 100},
          {timestamp: 200, value: 200},
        ],
      })
    );
    expect(confidence).toBeNull();
  });

  it('equal null if confidence is undefined', () => {
    const confidence = determineTimeSeriesConfidence(
      TimeSeriesFixture({
        values: [
          {timestamp: 100, value: 100, confidence: undefined},
          {timestamp: 200, value: 200, confidence: undefined},
        ],
      })
    );
    expect(confidence).toBeNull();
  });

  it('equal null if all confidence null', () => {
    const confidence = determineTimeSeriesConfidence(
      TimeSeriesFixture({
        values: [
          {timestamp: 100, value: 100, confidence: null},
          {timestamp: 200, value: 200, confidence: null},
        ],
      })
    );
    expect(confidence).toBeNull();
  });

  it('equal high if all confidence high', () => {
    const confidence = determineTimeSeriesConfidence(
      TimeSeriesFixture({
        values: [
          {timestamp: 100, value: 100, confidence: 'high'},
          {timestamp: 200, value: 200, confidence: 'high'},
        ],
      })
    );
    expect(confidence).toBe('high');
  });

  it('equal high if all confidence high or null', () => {
    const confidence = determineTimeSeriesConfidence(
      TimeSeriesFixture({
        values: [
          {timestamp: 100, value: 100, confidence: 'high'},
          {timestamp: 200, value: 200, confidence: null},
        ],
      })
    );
    expect(confidence).toBe('high');
  });

  it('equal high if <25% is low', () => {
    const confidence = determineTimeSeriesConfidence(
      TimeSeriesFixture({
        values: [
          {timestamp: 100, value: 100, confidence: 'high'},
          {timestamp: 200, value: 200, confidence: 'high'},
          {timestamp: 300, value: 300, confidence: 'high'},
          {timestamp: 400, value: 400, confidence: 'high'},
          {timestamp: 500, value: 500, confidence: 'low'},
          {timestamp: 600, value: 600, confidence: 'high'},
          {timestamp: 700, value: 700, confidence: null},
        ],
      })
    );
    expect(confidence).toBe('high');
  });

  it('equal low if >25% is low', () => {
    const confidence = determineTimeSeriesConfidence(
      TimeSeriesFixture({
        values: [
          {timestamp: 100, value: 100, confidence: 'high'},
          {timestamp: 200, value: 200, confidence: null},
          {timestamp: 300, value: 300, confidence: null},
          {timestamp: 400, value: 400, confidence: 'low'},
          {timestamp: 500, value: 500, confidence: 'low'},
        ],
      })
    );
    expect(confidence).toBe('low');
  });

  it('equal low if all low', () => {
    const confidence = determineTimeSeriesConfidence(
      TimeSeriesFixture({
        values: [
          {timestamp: 100, value: 100, confidence: 'low'},
          {timestamp: 200, value: 200, confidence: 'low'},
          {timestamp: 300, value: 300, confidence: 'low'},
          {timestamp: 400, value: 400, confidence: 'low'},
          {timestamp: 500, value: 500, confidence: 'low'},
        ],
      })
    );
    expect(confidence).toBe('low');
  });
});
