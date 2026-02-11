import {RateUnit} from 'sentry/utils/discover/fields';
import {
  formatAbbreviatedNumber,
  formatAbbreviatedNumberWithDynamicPrecision,
  formatDollars,
  formatPercentRate,
  formatRate,
  formatSpanOperation,
  formatTimeDuration,
  userDisplayName,
} from 'sentry/utils/formatters';

describe('formatAbbreviatedNumber()', () => {
  it('should format numbers smaller than 1', () => {
    expect(formatAbbreviatedNumber(0.1)).toBe('0.1');
    expect(formatAbbreviatedNumber(0.01)).toBe('0.01');
    expect(formatAbbreviatedNumber(0.123)).toBe('0.123');
    expect(formatAbbreviatedNumber(0.99999)).toBe('1');
  });

  it('should abbreviate numbers', () => {
    expect(formatAbbreviatedNumber(0)).toBe('0');
    expect(formatAbbreviatedNumber(100)).toBe('100');
    expect(formatAbbreviatedNumber(1000)).toBe('1K');
    expect(formatAbbreviatedNumber(10000000)).toBe('10M');
    expect(formatAbbreviatedNumber(100000000000)).toBe('100B');
    expect(formatAbbreviatedNumber(1000000000000)).toBe('1000B');
  });

  it('should abbreviate numbers that are strings', () => {
    expect(formatAbbreviatedNumber('00')).toBe('0');
    expect(formatAbbreviatedNumber('100')).toBe('100');
    expect(formatAbbreviatedNumber('1000')).toBe('1K');
    expect(formatAbbreviatedNumber('10000000')).toBe('10M');
    expect(formatAbbreviatedNumber('100000000000')).toBe('100B');
    expect(formatAbbreviatedNumber('1000000000000')).toBe('1000B');
  });

  it('should round to 1 decimal place', () => {
    expect(formatAbbreviatedNumber(100.12)).toBe('100.12');
    expect(formatAbbreviatedNumber(1500)).toBe('1.5K');
    expect(formatAbbreviatedNumber(1213122)).toBe('1.2M');
    expect(formatAbbreviatedNumber(1011)).toBe('1K');
    expect(formatAbbreviatedNumber(10911)).toBe('10.9K');
    expect(formatAbbreviatedNumber(11911)).toBe('11K');
  });

  it('should round to set amount of significant digits', () => {
    expect(formatAbbreviatedNumber(100.12, 3)).toBe('100');
    expect(formatAbbreviatedNumber(199.99, 3)).toBe('200');
    expect(formatAbbreviatedNumber(1500, 3)).toBe('1.5K');
    expect(formatAbbreviatedNumber(1213122, 3)).toBe('1.21M');
    expect(formatAbbreviatedNumber(-1213122, 3)).toBe('-1.21M');
    expect(formatAbbreviatedNumber(1500000000000, 3)).toBe('1500B');

    expect(formatAbbreviatedNumber('1249.23421', 3)).toBe('1.25K');
    expect(formatAbbreviatedNumber('1239567891299', 3)).toBe('1240B');
    expect(formatAbbreviatedNumber('158.80421626984128', 3)).toBe('159');
  });

  it('should format negative numbers', () => {
    expect(formatAbbreviatedNumber(-100)).toBe('-100');
    expect(formatAbbreviatedNumber(-1095)).toBe('-1K');
    expect(formatAbbreviatedNumber(-10000000)).toBe('-10M');
    expect(formatAbbreviatedNumber(-1000000000000)).toBe('-1000B');
  });
});

describe('formatAbbreviatedNumberWithDynamicPrecision()', () => {
  it('should format numbers smaller than 1', () => {
    expect(formatAbbreviatedNumberWithDynamicPrecision(0.1)).toBe('0.1');
    expect(formatAbbreviatedNumberWithDynamicPrecision(0.01)).toBe('0.01');
    expect(formatAbbreviatedNumberWithDynamicPrecision(0.123)).toBe('0.123');
    expect(formatAbbreviatedNumberWithDynamicPrecision(0.0000046898378059268)).toBe(
      '0.00000469'
    );
  });

  it('should abbreviate numbers', () => {
    expect(formatAbbreviatedNumberWithDynamicPrecision(0)).toBe('0');
    expect(formatAbbreviatedNumberWithDynamicPrecision(100)).toBe('100');
    expect(formatAbbreviatedNumberWithDynamicPrecision(1000)).toBe('1K');
    expect(formatAbbreviatedNumberWithDynamicPrecision(10000000)).toBe('10M');
    expect(formatAbbreviatedNumberWithDynamicPrecision(100000000000)).toBe('100B');
  });

  it('should abbreviate numbers that are strings', () => {
    expect(formatAbbreviatedNumberWithDynamicPrecision('00')).toBe('0');
    expect(formatAbbreviatedNumberWithDynamicPrecision('100')).toBe('100');
    expect(formatAbbreviatedNumberWithDynamicPrecision('1000')).toBe('1K');
    expect(formatAbbreviatedNumberWithDynamicPrecision('10000000')).toBe('10M');
    expect(formatAbbreviatedNumberWithDynamicPrecision('100000000000')).toBe('100B');
  });

  it('should round to max two digits', () => {
    expect(formatAbbreviatedNumberWithDynamicPrecision(1.00001)).toBe('1');
    expect(formatAbbreviatedNumberWithDynamicPrecision(100.12)).toBe('100.12');
    expect(formatAbbreviatedNumberWithDynamicPrecision(199.99)).toBe('199.99');
    expect(formatAbbreviatedNumberWithDynamicPrecision(1500)).toBe('1.5K');
    expect(formatAbbreviatedNumberWithDynamicPrecision(146789)).toBe('146.79K');
    expect(formatAbbreviatedNumberWithDynamicPrecision(153789)).toBe('153.79K');
    expect(formatAbbreviatedNumberWithDynamicPrecision(1213122)).toBe('1.21M');
    expect(formatAbbreviatedNumberWithDynamicPrecision('1249.23421')).toBe('1.25K');
    expect(formatAbbreviatedNumberWithDynamicPrecision('123956789129')).toBe('124B');
    expect(formatAbbreviatedNumberWithDynamicPrecision('158.80421626984128')).toBe(
      '158.8'
    );
  });
});

describe('formatRate()', () => {
  it('Formats 0 as "0"', () => {
    expect(formatRate(0)).toBe('0/s');
  });

  it('Accepts a unit', () => {
    expect(formatRate(0.3142, RateUnit.PER_MINUTE)).toBe('0.314/min');
    expect(formatRate(0.3142, RateUnit.PER_HOUR)).toBe('0.314/hr');
  });

  it('Formats to 3 significant digits for numbers > minimum', () => {
    expect(formatRate(0.3142)).toBe('0.314/s');
    expect(formatRate(17)).toBe('17.0/s');
    expect(formatRate(1023.142)).toBe('1.02K/s');
  });

  it('Obeys a minimum value option', () => {
    expect(formatRate(0.000003142, undefined, {minimumValue: 0.01})).toBe('<0.01/s');
    expect(formatRate(0.0023, undefined, {minimumValue: 0.01})).toBe('<0.01/s');
    expect(formatRate(0.02, undefined, {minimumValue: 0.01})).toBe('0.0200/s');
    expect(formatRate(0.271, undefined, {minimumValue: 0.01})).toBe('0.271/s');
  });

  it('Obeys a significant digits option', () => {
    expect(formatRate(7.1, undefined, {significantDigits: 4})).toBe('7.100/s');
  });

  it('Abbreviates large numbers using SI prefixes', () => {
    expect(formatRate(1023.142)).toBe('1.02K/s');
    expect(formatRate(1523142)).toBe('1.52M/s');
    expect(formatRate(1020314200.132)).toBe('1.02B/s');
    expect(formatRate(1023140200132.789)).toBe('1.02T/s');
  });
});

describe('userDisplayName', () => {
  it('should only show email, if name and email are the same', () => {
    expect(
      userDisplayName({
        name: 'foo@bar.com',
        email: 'foo@bar.com',
      })
    ).toBe('foo@bar.com');
  });

  it('should show name + email, if name and email differ', () => {
    expect(
      userDisplayName({
        name: 'user',
        email: 'foo@bar.com',
      })
    ).toBe('user (foo@bar.com)');
  });

  it('should show unknown author with email, if email is only provided', () => {
    expect(
      userDisplayName({
        email: 'foo@bar.com',
      })
    ).toBe('Unknown author (foo@bar.com)');
  });

  it('should show unknown author, if author or email is just whitespace', () => {
    expect(
      userDisplayName({
        name: `\t\n `,
      })
    ).toBe('Unknown author');

    expect(
      userDisplayName({
        email: `\t\n `,
      })
    ).toBe('Unknown author');
  });

  it('should show unknown author, if user object is either not an object or incomplete', () => {
    // @ts-expect-error TS2554: Expected 1-2 arguments, but got 0
    expect(userDisplayName()).toBe('Unknown author');
    expect(userDisplayName({})).toBe('Unknown author');
  });
});

describe('formatSpanOperation', () => {
  it('falls back to "span"', () => {
    expect(formatSpanOperation()).toBe('span');
  });

  it.each([
    ['db', 'query'],
    ['db.redis', 'query'],
    ['task.run', 'task'],
    ['http.get', 'request'],
    ['resource.js', 'resource'],
  ])('formats short description for %s span operation', (operation, description) => {
    expect(formatSpanOperation(operation)).toEqual(description);
  });

  it.each([
    ['db', 'database query'],
    ['db.redis', 'cache query'],
    ['task.run', 'application task'],
    ['http.get', 'URL request'],
    ['resource.script', 'JavaScript file'],
    ['resource.img', 'image'],
  ])('formats long description for %s span operation', (operation, description) => {
    expect(formatSpanOperation(operation, 'long')).toEqual(description);
  });
});

describe('formatPercentRate', () => {
  it('formats positive rates with + sign', () => {
    expect(formatPercentRate(0.1)).toBe('+0.10%');
    expect(formatPercentRate(1)).toBe('+1.00%');
    expect(formatPercentRate(10)).toBe('+10.00%');
  });

  it('formats negative rates', () => {
    expect(formatPercentRate(-0.1)).toBe('-0.10%');
    expect(formatPercentRate(-1)).toBe('-1.00%');
    expect(formatPercentRate(-10)).toBe('-10.00%');
  });

  it('formats zero', () => {
    expect(formatPercentRate(0)).toBe('0.00%');
  });

  it('shows "<+{minimumValue}%" for small positive values when minimumValue is provided', () => {
    expect(formatPercentRate(0.001, {minimumValue: 0.01})).toBe('<+0.01%');
    expect(formatPercentRate(0.009, {minimumValue: 0.01})).toBe('<+0.01%');
  });

  it('shows "<-{minimumValue}%" for small negative values when minimumValue is provided', () => {
    expect(formatPercentRate(-0.001, {minimumValue: 0.01})).toBe('<-0.01%');
    expect(formatPercentRate(-0.009, {minimumValue: 0.01})).toBe('<-0.01%');
  });

  it('does not show "<{minimumValue}%" for values >= minimumValue', () => {
    expect(formatPercentRate(0.01, {minimumValue: 0.01})).toBe('+0.01%');
    expect(formatPercentRate(-0.01, {minimumValue: 0.01})).toBe('-0.01%');
    expect(formatPercentRate(0.1, {minimumValue: 0.01})).toBe('+0.10%');
  });

  it('handles edge case of exactly zero with minimumValue', () => {
    expect(formatPercentRate(0, {minimumValue: 0.01})).toBe('0.00%');
  });

  it('uses custom minimumValue', () => {
    expect(formatPercentRate(0.001, {minimumValue: 0.05})).toBe('<+0.05%');
    expect(formatPercentRate(-0.03, {minimumValue: 0.05})).toBe('<-0.05%');
    expect(formatPercentRate(0.05, {minimumValue: 0.05})).toBe('+0.05%');
  });
});

describe('formatTimeDuration', () => {
  describe('numbers less than 1 second', () => {
    it('formats 0', () => {
      expect(formatTimeDuration(0)).toBe('0s');
    });
  });

  describe('numbers greater than 1 second', () => {
    it('formats 1 second', () => {
      expect(formatTimeDuration(1000)).toBe('1s');
    });
  });

  describe('numbers greater than 1 minute', () => {
    it('formats 1 minute', () => {
      expect(formatTimeDuration(60000)).toBe('1m 0s');
    });
  });

  describe('numbers greater than 1 hour', () => {
    it('formats 1 hour', () => {
      expect(formatTimeDuration(3600000)).toBe('1h 0m 0s');
    });
  });

  describe('numbers greater than 1 day', () => {
    it('formats 1 day', () => {
      expect(formatTimeDuration(86400000)).toBe('1d 0h 0m 0s');
    });
  });
});

describe('formatDollars', () => {
  it.each([
    [0, '$0'],
    [1, '$1'],
    [0.01, '$0.01'],
    [17.1238, '$17.12'],
    [1249.99, '$1.25K'],
    [999999, '$1,000K'],
    [1000000, '$1M'],
    [1772313.1, '$1.77M'],
    [1000000000, '$1B'],
    [1000000000000, '$1,000B'],
    [-100, '$-100'],
    [-1500, '$-1.5K'],
    [-1000000, '$-1M'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatDollars(value)).toBe(expected);
  });
});
