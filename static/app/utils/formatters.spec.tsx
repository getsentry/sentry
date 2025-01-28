import {RateUnit} from 'sentry/utils/discover/fields';
import {
  formatAbbreviatedNumber,
  formatAbbreviatedNumberWithDynamicPrecision,
  formatRate,
  formatSpanOperation,
  userDisplayName,
} from 'sentry/utils/formatters';

describe('formatAbbreviatedNumber()', function () {
  it('should format numbers smaller than 1', function () {
    expect(formatAbbreviatedNumber(0.1)).toBe('0.1');
    expect(formatAbbreviatedNumber(0.01)).toBe('0.01');
    expect(formatAbbreviatedNumber(0.123)).toBe('0.123');
    expect(formatAbbreviatedNumber(0.99999)).toBe('1');
  });

  it('should abbreviate numbers', function () {
    expect(formatAbbreviatedNumber(0)).toBe('0');
    expect(formatAbbreviatedNumber(100)).toBe('100');
    expect(formatAbbreviatedNumber(1000)).toBe('1k');
    expect(formatAbbreviatedNumber(10000000)).toBe('10m');
    expect(formatAbbreviatedNumber(100000000000)).toBe('100b');
    expect(formatAbbreviatedNumber(1000000000000)).toBe('1000b');
  });

  it('should abbreviate numbers that are strings', function () {
    expect(formatAbbreviatedNumber('00')).toBe('0');
    expect(formatAbbreviatedNumber('100')).toBe('100');
    expect(formatAbbreviatedNumber('1000')).toBe('1k');
    expect(formatAbbreviatedNumber('10000000')).toBe('10m');
    expect(formatAbbreviatedNumber('100000000000')).toBe('100b');
    expect(formatAbbreviatedNumber('1000000000000')).toBe('1000b');
  });

  it('should round to 1 decimal place', function () {
    expect(formatAbbreviatedNumber(100.12)).toBe('100.12');
    expect(formatAbbreviatedNumber(1500)).toBe('1.5k');
    expect(formatAbbreviatedNumber(1213122)).toBe('1.2m');
    expect(formatAbbreviatedNumber(1011)).toBe('1k');
    expect(formatAbbreviatedNumber(10911)).toBe('10.9k');
    expect(formatAbbreviatedNumber(11911)).toBe('11k');
  });

  it('should round to set amount of significant digits', function () {
    expect(formatAbbreviatedNumber(100.12, 3)).toBe('100');
    expect(formatAbbreviatedNumber(199.99, 3)).toBe('200');
    expect(formatAbbreviatedNumber(1500, 3)).toBe('1.5k');
    expect(formatAbbreviatedNumber(1213122, 3)).toBe('1.21m');
    expect(formatAbbreviatedNumber(-1213122, 3)).toBe('-1.21m');
    expect(formatAbbreviatedNumber(1500000000000, 3)).toBe('1500b');

    expect(formatAbbreviatedNumber('1249.23421', 3)).toBe('1.25k');
    expect(formatAbbreviatedNumber('1239567891299', 3)).toBe('1240b');
    expect(formatAbbreviatedNumber('158.80421626984128', 3)).toBe('159');
  });

  it('should format negative numbers', function () {
    expect(formatAbbreviatedNumber(-100)).toBe('-100');
    expect(formatAbbreviatedNumber(-1095)).toBe('-1k');
    expect(formatAbbreviatedNumber(-10000000)).toBe('-10m');
    expect(formatAbbreviatedNumber(-1000000000000)).toBe('-1000b');
  });
});

describe('formatAbbreviatedNumberWithDynamicPrecision()', function () {
  it('should format numbers smaller than 1', function () {
    expect(formatAbbreviatedNumberWithDynamicPrecision(0.1)).toBe('0.1');
    expect(formatAbbreviatedNumberWithDynamicPrecision(0.01)).toBe('0.01');
    expect(formatAbbreviatedNumberWithDynamicPrecision(0.123)).toBe('0.123');
    expect(formatAbbreviatedNumberWithDynamicPrecision(0.0000046898378059268)).toBe(
      '0.00000469'
    );
  });

  it('should abbreviate numbers', function () {
    expect(formatAbbreviatedNumberWithDynamicPrecision(0)).toBe('0');
    expect(formatAbbreviatedNumberWithDynamicPrecision(100)).toBe('100');
    expect(formatAbbreviatedNumberWithDynamicPrecision(1000)).toBe('1k');
    expect(formatAbbreviatedNumberWithDynamicPrecision(10000000)).toBe('10m');
    expect(formatAbbreviatedNumberWithDynamicPrecision(100000000000)).toBe('100b');
  });

  it('should abbreviate numbers that are strings', function () {
    expect(formatAbbreviatedNumberWithDynamicPrecision('00')).toBe('0');
    expect(formatAbbreviatedNumberWithDynamicPrecision('100')).toBe('100');
    expect(formatAbbreviatedNumberWithDynamicPrecision('1000')).toBe('1k');
    expect(formatAbbreviatedNumberWithDynamicPrecision('10000000')).toBe('10m');
    expect(formatAbbreviatedNumberWithDynamicPrecision('100000000000')).toBe('100b');
  });

  it('should round to max two digits', () => {
    expect(formatAbbreviatedNumberWithDynamicPrecision(1.00001)).toBe('1');
    expect(formatAbbreviatedNumberWithDynamicPrecision(100.12)).toBe('100.12');
    expect(formatAbbreviatedNumberWithDynamicPrecision(199.99)).toBe('199.99');
    expect(formatAbbreviatedNumberWithDynamicPrecision(1500)).toBe('1.5k');
    expect(formatAbbreviatedNumberWithDynamicPrecision(146789)).toBe('146.79k');
    expect(formatAbbreviatedNumberWithDynamicPrecision(153789)).toBe('153.79k');
    expect(formatAbbreviatedNumberWithDynamicPrecision(1213122)).toBe('1.21m');
    expect(formatAbbreviatedNumberWithDynamicPrecision('1249.23421')).toBe('1.25k');
    expect(formatAbbreviatedNumberWithDynamicPrecision('123956789129')).toBe('124b');
    expect(formatAbbreviatedNumberWithDynamicPrecision('158.80421626984128')).toBe(
      '158.8'
    );
  });
});

describe('formatRate()', function () {
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

describe('userDisplayName', function () {
  it('should only show email, if name and email are the same', function () {
    expect(
      userDisplayName({
        name: 'foo@bar.com',
        email: 'foo@bar.com',
      })
    ).toBe('foo@bar.com');
  });

  it('should show name + email, if name and email differ', function () {
    expect(
      userDisplayName({
        name: 'user',
        email: 'foo@bar.com',
      })
    ).toBe('user (foo@bar.com)');
  });

  it('should show unknown author with email, if email is only provided', function () {
    expect(
      userDisplayName({
        email: 'foo@bar.com',
      })
    ).toBe('Unknown author (foo@bar.com)');
  });

  it('should show unknown author, if author or email is just whitespace', function () {
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

  it('should show unknown author, if user object is either not an object or incomplete', function () {
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
