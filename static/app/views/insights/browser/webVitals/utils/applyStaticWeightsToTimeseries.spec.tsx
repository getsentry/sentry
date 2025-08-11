import {applyStaticWeightsToTimeseries} from 'sentry/views/insights/browser/webVitals/utils/applyStaticWeightsToTimeseries';

describe('applyStaticWeightsToTimeseries', function () {
  it('updates timeseries scores with static weighing', function () {
    const timeseriesData = {
      lcp: [
        {name: '2024-07-01T00:00:00.000Z', value: 90},
        {name: '2024-07-02T00:00:00.000Z', value: 40},
      ],
      fcp: [
        {name: '2024-07-01T00:00:00.000Z', value: 30},
        {name: '2024-07-02T00:00:00.000Z', value: 20},
      ],
      cls: [
        {name: '2024-07-01T00:00:00.000Z', value: 10},
        {name: '2024-07-02T00:00:00.000Z', value: 90},
      ],
      ttfb: [
        {name: '2024-07-01T00:00:00.000Z', value: 22},
        {name: '2024-07-02T00:00:00.000Z', value: 43},
      ],
      inp: [
        {name: '2024-07-01T00:00:00.000Z', value: 100},
        {name: '2024-07-02T00:00:00.000Z', value: 0},
      ],
      total: [
        {name: '2024-07-01T00:00:00.000Z', value: 50},
        {name: '2024-07-02T00:00:00.000Z', value: 50},
      ],
    };
    const result = applyStaticWeightsToTimeseries(timeseriesData);
    expect(result).toEqual({
      lcp: [
        {name: '2024-07-01T00:00:00.000Z', value: 90 * 0.3},
        {name: '2024-07-02T00:00:00.000Z', value: 40 * 0.3},
      ],
      fcp: [
        {name: '2024-07-01T00:00:00.000Z', value: 30 * 0.15},
        {name: '2024-07-02T00:00:00.000Z', value: 20 * 0.15},
      ],
      cls: [
        {name: '2024-07-01T00:00:00.000Z', value: 10 * 0.15},
        {name: '2024-07-02T00:00:00.000Z', value: 90 * 0.15},
      ],
      ttfb: [
        {name: '2024-07-01T00:00:00.000Z', value: 22 * 0.1},
        {name: '2024-07-02T00:00:00.000Z', value: 43 * 0.1},
      ],
      inp: [
        {name: '2024-07-01T00:00:00.000Z', value: 100 * 0.3},
        {name: '2024-07-02T00:00:00.000Z', value: 0 * 0.3},
      ],
      total: [
        {name: '2024-07-01T00:00:00.000Z', value: 50},
        {name: '2024-07-02T00:00:00.000Z', value: 50},
      ],
    });
  });
});
