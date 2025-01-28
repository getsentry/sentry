import {determineSeriesConfidence} from 'sentry/views/alerts/rules/metric/utils/determineSeriesConfidence';

describe('determineSeriesConfidence', () => {
  it('equal null if no data', () => {
    const confidence = determineSeriesConfidence({
      data: [],
    });
    expect(confidence).toBeNull();
  });

  it('equal null if no confidence found', () => {
    const confidence = determineSeriesConfidence({
      data: [
        [100, [{count: 100}]],
        [200, [{count: 200}]],
      ],
    });
    expect(confidence).toBeNull();
  });

  it('equal null if confidence is empty', () => {
    const confidence = determineSeriesConfidence({
      data: [
        [100, [{count: 100}]],
        [200, [{count: 200}]],
      ],
      confidence: [],
    });
    expect(confidence).toBeNull();
  });

  it('equal null if all confidence null', () => {
    const confidence = determineSeriesConfidence({
      data: [
        [100, [{count: 100}]],
        [200, [{count: 200}]],
      ],
      confidence: [
        [100, [{count: null}]],
        [200, [{count: null}]],
      ],
    });
    expect(confidence).toBeNull();
  });

  it('equal high if all confidence high', () => {
    const confidence = determineSeriesConfidence({
      data: [
        [100, [{count: 100}]],
        [200, [{count: 200}]],
      ],
      confidence: [
        [100, [{count: 'high'}]],
        [200, [{count: 'high'}]],
      ],
    });
    expect(confidence).toBe('high');
  });

  it('equal high if all confidence high or null', () => {
    const confidence = determineSeriesConfidence({
      data: [
        [100, [{count: 100}]],
        [200, [{count: 200}]],
      ],
      confidence: [
        [100, [{count: 'high'}]],
        [200, [{count: null}]],
      ],
    });
    expect(confidence).toBe('high');
  });

  it('equal high if <25% is low', () => {
    const confidence = determineSeriesConfidence({
      data: [
        [100, [{count: 100}]],
        [200, [{count: 200}]],
        [300, [{count: 300}]],
        [400, [{count: 400}]],
        [500, [{count: 500}]],
        [600, [{count: 600}]],
        [700, [{count: 700}]],
      ],
      confidence: [
        [100, [{count: 'high'}]],
        [200, [{count: 'high'}]],
        [300, [{count: 'high'}]],
        [400, [{count: 'high'}]],
        [500, [{count: 'low'}]],
        [600, [{count: 'high'}]],
        [700, [{count: null}]],
      ],
    });
    expect(confidence).toBe('high');
  });

  it('equal low if >25% is low', () => {
    const confidence = determineSeriesConfidence({
      data: [
        [100, [{count: 100}]],
        [200, [{count: 200}]],
        [300, [{count: 300}]],
        [400, [{count: 400}]],
        [500, [{count: 500}]],
      ],
      confidence: [
        [100, [{count: 'high'}]],
        [200, [{count: null}]],
        [300, [{count: null}]],
        [400, [{count: 'low'}]],
        [500, [{count: 'low'}]],
      ],
    });
    expect(confidence).toBe('low');
  });

  it('equal low if all low', () => {
    const confidence = determineSeriesConfidence({
      data: [
        [100, [{count: 100}]],
        [200, [{count: 200}]],
        [300, [{count: 300}]],
        [400, [{count: 400}]],
        [500, [{count: 500}]],
      ],
      confidence: [
        [100, [{count: 'low'}]],
        [200, [{count: 'low'}]],
        [300, [{count: 'low'}]],
        [400, [{count: 'low'}]],
        [500, [{count: 'low'}]],
      ],
    });
    expect(confidence).toBe('low');
  });

  it('equals low if any in bucket is low', () => {
    const confidence = determineSeriesConfidence({
      data: [[200, [{count: 100}]]],
      confidence: [
        [100, [{count: 'high'}, {count: 'low'}, {count: null}]],
        [200, [{count: null}, {count: 'low'}, {count: 'high'}]],
      ],
    });
    expect(confidence).toBe('low');
  });

  it('equals high if no lows in bucket', () => {
    const confidence = determineSeriesConfidence({
      data: [[200, [{count: 100}]]],
      confidence: [
        [100, [{count: 'high'}, {count: 'high'}, {count: null}]],
        [200, [{count: null}, {count: null}, {count: 'high'}]],
      ],
    });
    expect(confidence).toBe('high');
  });
});
