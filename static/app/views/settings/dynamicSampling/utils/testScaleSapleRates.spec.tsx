import {scaleSampleRates} from 'sentry/views/settings/dynamicSampling/utils/scaleSampleRates';

function getAverageSampleRate(items: {count: number; sampleRate: number}[]) {
  const total = items.reduce((acc, item) => acc + item.count, 0);
  return items.reduce((acc, item) => acc + (item.count * item.sampleRate) / total, 0);
}

describe('scaleSampleRates', () => {
  it('scales the sample rate from 0', () => {
    const items = [
      {count: 2, sampleRate: 0},
      {count: 4, sampleRate: 0},
    ];

    const sampleRate = 0.4;

    const {scaledItems} = scaleSampleRates({items, sampleRate});
    expect(scaledItems[0]!.sampleRate).toBe(0.4);
    expect(scaledItems[1]!.sampleRate).toBe(0.4);
  });

  it('scales the sample rate from 100', () => {
    const items = [
      {count: 2, sampleRate: 0},
      {count: 4, sampleRate: 0},
    ];

    const sampleRate = 0.4;

    const {scaledItems} = scaleSampleRates({items, sampleRate});
    expect(scaledItems[0]!.sampleRate).toBe(0.4);
    expect(scaledItems[1]!.sampleRate).toBe(0.4);
  });

  it('scales the sample rate up', () => {
    const items = [
      {count: 500, sampleRate: 0.6},
      {count: 600, sampleRate: 0.2},
      {count: 500, sampleRate: 0.2},
    ];

    const sampleRate = 0.2;

    const {scaledItems} = scaleSampleRates({items, sampleRate});
    expect(getAverageSampleRate(scaledItems)).toBeCloseTo(sampleRate, 15);
  });

  it('handles reducing the sample rates', () => {
    const items = [
      {count: 100, sampleRate: 0.3},
      {count: 200, sampleRate: 0.6},
      {count: 200, sampleRate: 0.9},
    ];

    const sampleRate = 0.25;

    const {scaledItems} = scaleSampleRates({items, sampleRate});
    expect(getAverageSampleRate(scaledItems)).toBeCloseTo(sampleRate, 15);
  });

  it('does not decrease sample rates which are at 0', () => {
    const items = [
      {count: 200, sampleRate: 0.6},
      {count: 200, sampleRate: 0.9},
      {count: 100, sampleRate: 0},
    ];

    const sampleRate = 0.25;

    const {scaledItems} = scaleSampleRates({items, sampleRate});
    expect(items.every(item => item.sampleRate >= 0)).toBe(true);
    expect(getAverageSampleRate(scaledItems)).toBeCloseTo(sampleRate, 15);
  });

  it('does not increase sample rates which are at 1', () => {
    const items = [
      {count: 100, sampleRate: 1},
      {count: 200, sampleRate: 0.2},
      {count: 200, sampleRate: 0.1},
    ];

    const sampleRate = 0.8;

    const {scaledItems} = scaleSampleRates({items, sampleRate});
    expect(items.every(item => item.sampleRate <= 1)).toBe(true);
    expect(getAverageSampleRate(scaledItems)).toBeCloseTo(sampleRate, 15);
  });
});
