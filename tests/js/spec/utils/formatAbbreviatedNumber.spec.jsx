import formatAbbreviatedNumber from 'app/utils/formatAbbreviatedNumber';

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
