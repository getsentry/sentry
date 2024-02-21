import {
  getMetricValueNormalizer,
  getNormalizedMetricUnit,
} from 'sentry/utils/metrics/normalizeMetricValue';

describe('getNormalizedMetricUnit', () => {
  it('returns "millisecond" when unit is in timeConversionFactors', () => {
    expect(getNormalizedMetricUnit('second')).toBe('millisecond');
    expect(getNormalizedMetricUnit('hour')).toBe('millisecond');
    expect(getNormalizedMetricUnit('hours')).toBe('millisecond');
    expect(getNormalizedMetricUnit('minute')).toBe('millisecond');
    expect(getNormalizedMetricUnit('nanoseconds')).toBe('millisecond');
  });

  it('returns "byte" when unit is in byte10ConversionFactors', () => {
    expect(getNormalizedMetricUnit('kilobyte')).toBe('byte');
    expect(getNormalizedMetricUnit('petabyte')).toBe('byte');
    expect(getNormalizedMetricUnit('petabytes')).toBe('byte');
  });

  it('returns "byte2" when unit is in byte2ConversionFactors', () => {
    expect(getNormalizedMetricUnit('bit')).toBe('byte2');
    expect(getNormalizedMetricUnit('kibibyte')).toBe('byte2');
    expect(getNormalizedMetricUnit('kibibytes')).toBe('byte2');
  });

  it('returns the unit when it is not in any of the conversion factors', () => {
    expect(getNormalizedMetricUnit('foo')).toBe('foo');
  });

  it('returns none for count operations', () => {
    expect(getMetricValueNormalizer('second', 'count')).toBe('none');
    expect(getMetricValueNormalizer('seconds', 'count_unique')).toBe('none');
  });
});

describe('getMetricValueNormalizer', () => {
  it('returns a function that normalizes the value to milliseconds when the unit is in timeConversionFactors', () => {
    expect(getMetricValueNormalizer('second')(1)).toBe(1000);
    expect(getMetricValueNormalizer('seconds')(2)).toBe(2000);

    expect(getMetricValueNormalizer('hour')(1)).toBe(3600000);
    expect(getMetricValueNormalizer('hours')(2)).toBe(7200000);
  });

  it('returns a function that normalizes the value to bytes when the unit is in byte10ConversionFactors', () => {
    expect(getMetricValueNormalizer('byte')(1)).toBe(1);
    expect(getMetricValueNormalizer('bytes')(2)).toBe(2);

    expect(getMetricValueNormalizer('terabyte')(1)).toBe(1000 ** 4);
    expect(getMetricValueNormalizer('terabytes')(2)).toBe(2 * 1000 ** 4);
  });

  it('returns a function that normalizes the value to bytes when the unit is in byte2ConversionFactors', () => {
    expect(getMetricValueNormalizer('bit')(1)).toBe(1 / 8);
    expect(getMetricValueNormalizer('bits')(1)).toBe(1 / 8);

    expect(getMetricValueNormalizer('tebibyte')(1)).toBe(1024 ** 4);
    expect(getMetricValueNormalizer('tebibytes')(2)).toBe(2 * 1024 ** 4);
  });

  it('skips nomalization for count operations', () => {
    expect(getMetricValueNormalizer('second', 'count')(1)).toBe(1);
    expect(getMetricValueNormalizer('seconds', 'count_unique')(2)).toBe(2);
  });
});
