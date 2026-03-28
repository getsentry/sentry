import {getChartQueryInterval} from './getChartQueryInterval';

describe('getChartQueryInterval', () => {
  it('returns 60s interval for short time ranges with 1h window', () => {
    const result = getChartQueryInterval({
      timeWindow: 3600,
      statsPeriod: '6h',
    });
    // 6h = 21600s, 21600/60 = 360 data points
    expect(result.queryInterval).toBe(60);
    expect(result.windowSize).toBe(60);
  });

  it('returns 60s interval for 1d range with 1h window', () => {
    const result = getChartQueryInterval({
      timeWindow: 3600,
      statsPeriod: '1d',
    });
    // 1d = 86400s, 86400/60 = 1440 data points
    expect(result.queryInterval).toBe(60);
    expect(result.windowSize).toBe(60);
  });

  it('steps up interval for longer time ranges to stay under data point limit', () => {
    const result = getChartQueryInterval({
      timeWindow: 3600,
      statsPeriod: '90d',
    });
    // 90d = 7776000s, need interval such that 7776000/interval <= 10000
    // 7776000/10000 = 777.6, so need interval >= 778
    // Divisors of 3600 >= 778: 900, 1200, 1800, 3600
    expect(result.queryInterval).toBe(900);
    expect(result.windowSize).toBe(4);
  });

  it('returns windowSize 1 when timeWindow equals minimum interval', () => {
    const result = getChartQueryInterval({
      timeWindow: 60,
      statsPeriod: '1d',
    });
    // 60s window, only divisor >= 60 is 60 itself
    // 86400/60 = 1440 <= 10000
    expect(result.queryInterval).toBe(60);
    expect(result.windowSize).toBe(1);
  });

  it('handles absolute start/end dates', () => {
    const result = getChartQueryInterval({
      timeWindow: 3600,
      start: '2024-01-01T00:00:00',
      end: '2024-01-02T00:00:00',
    });
    // 1 day = 86400s, 86400/60 = 1440
    expect(result.queryInterval).toBe(60);
    expect(result.windowSize).toBe(60);
  });

  it('defaults to 24h when no time range is provided', () => {
    const result = getChartQueryInterval({
      timeWindow: 3600,
    });
    // 86400/60 = 1440
    expect(result.queryInterval).toBe(60);
    expect(result.windowSize).toBe(60);
  });

  it('handles 5 minute time window', () => {
    const result = getChartQueryInterval({
      timeWindow: 300,
      statsPeriod: '1d',
    });
    // 300s window, divisors >= 60: [60, 75, 100, 150, 300]
    // 86400/60 = 1440 <= 10000
    expect(result.queryInterval).toBe(60);
    expect(result.windowSize).toBe(5);
  });

  it('handles very large time windows', () => {
    const result = getChartQueryInterval({
      timeWindow: 86400, // 1 day
      statsPeriod: '7d',
    });
    // 7d = 604800s
    // Divisors of 86400 starting from 1...
    // 604800/60 = 10080 > 10000
    // 604800/64 = 9450 <= 10000
    // We need the smallest divisor of 86400 where 604800/divisor <= 10000
    expect(result.queryInterval).toBeLessThanOrEqual(86400);
    expect(result.windowSize).toBeGreaterThanOrEqual(1);
    expect(result.queryInterval * result.windowSize).toBe(86400);
  });
});
