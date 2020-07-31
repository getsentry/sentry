import {
  formatFloat,
  formatAbbreviatedNumber,
  formatPercentage,
  getDuration,
} from 'app/utils/formatters';

describe('getDuration()', function() {
  it('should format durations', function() {
    expect(getDuration(0, 2)).toBe('0.00ms');
    expect(getDuration(0.1)).toBe('100ms');
    expect(getDuration(0.1, 2)).toBe('100.00ms');
    expect(getDuration(1)).toBe('1 second');
    expect(getDuration(2)).toBe('2 seconds');
    expect(getDuration(65)).toBe('65 seconds');
    expect(getDuration(122)).toBe('2 minutes');
    expect(getDuration(3720)).toBe('62 minutes');
    expect(getDuration(36000)).toBe('10 hours');
    expect(getDuration(86400)).toBe('24 hours');
    expect(getDuration(86400 * 2)).toBe('2 days');
    expect(getDuration(604800)).toBe('1 week');
  });

  it('should format numbers and abbreviate units', function() {
    expect(getDuration(0, 2, true)).toBe('0.00ms');
    expect(getDuration(0, 0, true)).toBe('0ms');
    expect(getDuration(0.1, 0, true)).toBe('100ms');
    expect(getDuration(0.1, 2, true)).toBe('100.00ms');
    expect(getDuration(1, 2, true)).toBe('1.00s');
    expect(getDuration(122, 0, true)).toBe('2min');
    expect(getDuration(3600, 0, true)).toBe('60min');
    expect(getDuration(86400, 0, true)).toBe('24hr');
    expect(getDuration(86400 * 2, 0, true)).toBe('2d');
    expect(getDuration(604800, 0, true)).toBe('1wk');
  });
});

describe('formatAbbreviatedNumber()', function() {
  it('should abbreviate numbers', function() {
    expect(formatAbbreviatedNumber(0)).toBe('0');
    expect(formatAbbreviatedNumber(100)).toBe('100');
    expect(formatAbbreviatedNumber(1000)).toBe('1k');
    expect(formatAbbreviatedNumber(10000000)).toBe('10m');
    expect(formatAbbreviatedNumber(100000000000)).toBe('100b');
    expect(formatAbbreviatedNumber(1000000000000)).toBe('1000b');
  });

  it('should abbreviate numbers that are strings', function() {
    expect(formatAbbreviatedNumber('00')).toBe('0');
    expect(formatAbbreviatedNumber('100')).toBe('100');
    expect(formatAbbreviatedNumber('1000')).toBe('1k');
    expect(formatAbbreviatedNumber('10000000')).toBe('10m');
    expect(formatAbbreviatedNumber('100000000000')).toBe('100b');
    expect(formatAbbreviatedNumber('1000000000000')).toBe('1000b');
  });
});

describe('formatFloat()', function() {
  it('should format decimals', function() {
    expect(formatFloat(0, 0)).toBe(0);
    expect(formatFloat(10.513434, 1)).toBe(10.5);
    expect(formatFloat(10.513494, 3)).toBe(10.513);
  });
  it('should not round', function() {
    expect(formatFloat(10.513494, 4)).toBe(10.5134);
  });
});

describe('formatPercentage()', function() {
  it('should format decimals', function() {
    expect(formatPercentage(0.0, 0)).toBe('0%');
    expect(formatPercentage(0.0, 2)).toBe('0%');
    expect(formatPercentage(0.10513434, 1)).toBe('10.5%');
    expect(formatPercentage(0.10513494, 3)).toBe('10.513%');
    expect(formatPercentage(0.10513494, 4)).toBe('10.5135%');
  });
});
