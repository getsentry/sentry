import {RateUnits} from 'sentry/utils/discover/fields';
import {
  DAY,
  formatAbbreviatedNumber,
  formatFloat,
  formatPercentage,
  formatRate,
  formatSecondsToClock,
  MONTH,
  parseClockToSeconds,
  userDisplayName,
  WEEK,
} from 'sentry/utils/formatters';

describe('getDuration()', function () {
  it('should format durations', function () {
    expect(formatSecondsToClock(0)).toBe('00:00');
    expect(formatSecondsToClock(0.001)).toBe('00:00.001');
    expect(formatSecondsToClock(0.01)).toBe('00:00.010');
  });

  it('should format negative durations', function () {
    expect(formatSecondsToClock(0)).toBe('00:00');
    expect(formatSecondsToClock(-0.001)).toBe('00:00.001');
    expect(formatSecondsToClock(-0.01)).toBe('00:00.010');
  });

  it('should format negative durations with absolute', function () {
    expect(formatSecondsToClock(0)).toBe('00:00');
    expect(formatSecondsToClock(-0.001)).toBe('00:00.001');
    expect(formatSecondsToClock(-0.01)).toBe('00:00.010');
  });
});

describe('formatSecondsToClock', function () {
  it('should format durations', function () {
    expect(formatSecondsToClock(0)).toBe('00:00');
    expect(formatSecondsToClock(0.1)).toBe('00:00.100');
    expect(formatSecondsToClock(1)).toBe('00:01');
    expect(formatSecondsToClock(2)).toBe('00:02');
    expect(formatSecondsToClock(65)).toBe('01:05');
    expect(formatSecondsToClock(65.123)).toBe('01:05.123');
    expect(formatSecondsToClock(122)).toBe('02:02');
    expect(formatSecondsToClock(3720)).toBe('01:02:00');
    expect(formatSecondsToClock(36000)).toBe('10:00:00');
    expect(formatSecondsToClock(86400)).toBe('24:00:00');
    expect(formatSecondsToClock(86400 * 2)).toBe('48:00:00');
  });

  it('should format negative durations', function () {
    expect(formatSecondsToClock(-0)).toBe('00:00');
    expect(formatSecondsToClock(-0.1)).toBe('00:00.100');
    expect(formatSecondsToClock(-1)).toBe('00:01');
    expect(formatSecondsToClock(-2)).toBe('00:02');
    expect(formatSecondsToClock(-65)).toBe('01:05');
    expect(formatSecondsToClock(-65.123)).toBe('01:05.123');
    expect(formatSecondsToClock(-122)).toBe('02:02');
    expect(formatSecondsToClock(-3720)).toBe('01:02:00');
    expect(formatSecondsToClock(-36000)).toBe('10:00:00');
    expect(formatSecondsToClock(-86400)).toBe('24:00:00');
    expect(formatSecondsToClock(-86400 * 2)).toBe('48:00:00');
  });

  it('should not pad when padAll:false is set', function () {
    const padAll = false;
    expect(formatSecondsToClock(0, {padAll})).toBe('0:00');
    expect(formatSecondsToClock(0.1, {padAll})).toBe('0:00.100');
    expect(formatSecondsToClock(1, {padAll})).toBe('0:01');
    expect(formatSecondsToClock(65, {padAll})).toBe('1:05');
    expect(formatSecondsToClock(3720, {padAll})).toBe('1:02:00');
  });
});

describe('parseClockToSeconds', function () {
  it('should format durations', function () {
    expect(parseClockToSeconds('0:00')).toBe(0);
    expect(parseClockToSeconds('0:00.100')).toBe(0.1);
    expect(parseClockToSeconds('0:01')).toBe(1);
    expect(parseClockToSeconds('0:02')).toBe(2);
    expect(parseClockToSeconds('1:05')).toBe(65);
    expect(parseClockToSeconds('1:05.123')).toBe(65.123);
    expect(parseClockToSeconds('2:02')).toBe(122);
    expect(parseClockToSeconds('1:02:00')).toBe(3720);
    expect(parseClockToSeconds('10:00:00')).toBe(36000);
    expect(parseClockToSeconds('24:00:00')).toBe(DAY / 1000);
    expect(parseClockToSeconds('48:00:00')).toBe((DAY * 2) / 1000);
    expect(parseClockToSeconds('2:00:00:00')).toBe((DAY * 2) / 1000);
    expect(parseClockToSeconds('1:00:00:00:00')).toBe(WEEK / 1000);
    expect(parseClockToSeconds('1:00:00:00:00:00')).toBe(MONTH / 1000);
  });

  it('should ignore non-numeric input', function () {
    expect(parseClockToSeconds('hello world')).toBe(0);
    expect(parseClockToSeconds('a:b:c')).toBe(0);
    expect(parseClockToSeconds('a:b:c.d')).toBe(0);
    expect(parseClockToSeconds('a:b:10.d')).toBe(10);
    expect(parseClockToSeconds('a:10:c.d')).toBe(600);
  });

  it('should handle as much invalid input as possible', function () {
    expect(parseClockToSeconds('a:b:c.123')).toBe(0.123);
    expect(parseClockToSeconds('a:b:10.d')).toBe(10);
    expect(parseClockToSeconds('a:10:c.d')).toBe(600);
  });
});

describe('formatAbbreviatedNumber()', function () {
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
  });

  it('should round to set amount of significant digits', () => {
    expect(formatAbbreviatedNumber(100.12, 3)).toBe('100');
    expect(formatAbbreviatedNumber(199.99, 3)).toBe('200');
    expect(formatAbbreviatedNumber(1500, 3)).toBe('1.5k');
    expect(formatAbbreviatedNumber(1213122, 3)).toBe('1.21m');
    expect(formatAbbreviatedNumber(1500000000000, 3)).toBe('1500b');

    expect(formatAbbreviatedNumber('1249.23421', 3)).toBe('1.25k');
    expect(formatAbbreviatedNumber('1239567891299', 3)).toBe('1240b');
    expect(formatAbbreviatedNumber('158.80421626984128', 3)).toBe('159');
  });
});

describe('formatRate()', function () {
  it('Formats 0 as "0"', () => {
    expect(formatRate(0)).toBe('0/s');
  });

  it('Accepts a unit', () => {
    expect(formatRate(0.3142, RateUnits.PER_MINUTE)).toBe('0.314/min');
    expect(formatRate(0.3142, RateUnits.PER_HOUR)).toBe('0.314/hr');
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

describe('formatFloat()', function () {
  it('should format decimals', function () {
    expect(formatFloat(0, 0)).toBe(0);
    expect(formatFloat(10.513434, 1)).toBe(10.5);
    expect(formatFloat(10.513494, 3)).toBe(10.513);
  });
  it('should not round', function () {
    expect(formatFloat(10.513494, 4)).toBe(10.5134);
  });
});

describe('formatPercentage()', function () {
  it('should format decimals', function () {
    expect(formatPercentage(0.0, 0)).toBe('0%');
    expect(formatPercentage(0.0, 2)).toBe('0%');
    expect(formatPercentage(0.10513434, 1)).toBe('10.5%');
    expect(formatPercentage(0.10513494, 3)).toBe('10.513%');
    expect(formatPercentage(0.10513494, 4)).toBe('10.5135%');
  });
});

describe('userDisplayName', function () {
  it('should only show email, if name and email are the same', function () {
    expect(
      userDisplayName({
        name: 'foo@bar.com',
        email: 'foo@bar.com',
      })
    ).toEqual('foo@bar.com');
  });

  it('should show name + email, if name and email differ', function () {
    expect(
      userDisplayName({
        name: 'user',
        email: 'foo@bar.com',
      })
    ).toEqual('user (foo@bar.com)');
  });

  it('should show unknown author with email, if email is only provided', function () {
    expect(
      userDisplayName({
        email: 'foo@bar.com',
      })
    ).toEqual('Unknown author (foo@bar.com)');
  });

  it('should show unknown author, if author or email is just whitespace', function () {
    expect(
      userDisplayName({
        // eslint-disable-next-line quotes
        name: `\t\n `,
      })
    ).toEqual('Unknown author');

    expect(
      userDisplayName({
        // eslint-disable-next-line quotes
        email: `\t\n `,
      })
    ).toEqual('Unknown author');
  });

  it('should show unknown author, if user object is either not an object or incomplete', function () {
    // @ts-expect-error
    expect(userDisplayName()).toEqual('Unknown author');
    expect(userDisplayName({})).toEqual('Unknown author');
  });
});
