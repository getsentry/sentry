import {getMetricsConversionFunction} from 'sentry/utils/metrics/convertMetricsValue';

describe('getMetricConversionFunction', () => {
  it('converts time values', () => {
    expect(getMetricsConversionFunction('seconds', 'nanosecond')(1)).toBe(1e9);
    expect(getMetricsConversionFunction('millisecond', 'seconds')(1)).toBe(0.001);
    expect(getMetricsConversionFunction('second', 'milliseconds')(1)).toBe(1000);
    expect(getMetricsConversionFunction('minute', 'seconds')(1)).toBe(60);
    expect(getMetricsConversionFunction('hour', 'minutes')(1)).toBe(60);
    expect(getMetricsConversionFunction('day', 'hours')(1)).toBe(24);
    expect(getMetricsConversionFunction('week', 'days')(1)).toBe(7);
    expect(getMetricsConversionFunction('week', 'seconds')(2)).toBe(1209600);
  });

  it('converts information values', () => {
    expect(getMetricsConversionFunction('bytes', 'kibibytes')(1024)).toBe(1);
    expect(getMetricsConversionFunction('kibibytes', 'bytes')(1)).toBe(1024);
    expect(getMetricsConversionFunction('bytes', 'megabytes')(1000000)).toBe(1);
    expect(getMetricsConversionFunction('megabytes', 'bytes')(1)).toBe(1000000);
    expect(getMetricsConversionFunction('bytes', 'gibibytes')(1073741824)).toBe(1);
    expect(getMetricsConversionFunction('gibibytes', 'bytes')(1)).toBe(1073741824);
  });
});
