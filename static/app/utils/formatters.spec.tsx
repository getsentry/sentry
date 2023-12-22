import {RateUnits} from 'sentry/utils/discover/fields';
import {
  DAY, // ms in day
  formatAbbreviatedNumber,
  formatFloat,
  formatNumberWithDynamicDecimalPoints,
  formatPercentage,
  formatRate,
  formatSecondsToClock,
  getDuration,
  getExactDuration,
  MONTH, // ms in month
  parseClockToSeconds,
  parseLargestSuffix,
  SEC_IN_DAY,
  SEC_IN_HR,
  SEC_IN_MIN,
  SEC_IN_WK,
  userDisplayName,
  WEEK, // ms in week
} from 'sentry/utils/formatters';

describe('getDuration()', function () {
  it('should format durations', function () {
    expect(formatSecondsToClock(0)).toBe('00:00');
    expect(formatSecondsToClock(0.001)).toBe('00:00.001');
    expect(formatSecondsToClock(0.01)).toBe('00:00.010');
    expect(getDuration(0.1)).toBe('100 milliseconds');
    expect(getDuration(0.1, 2)).toBe('100.00 milliseconds');
    expect(getDuration(1)).toBe('1 second');
    expect(getDuration(2)).toBe('2 seconds');
    expect(getDuration(65)).toBe('1 minute');
    expect(getDuration(122)).toBe('2 minutes');
    expect(getDuration(3720)).toBe('1 hour');
    expect(getDuration(36000)).toBe('10 hours');
    expect(getDuration(86400)).toBe('1 day');
    expect(getDuration(86400 * 2)).toBe('2 days');
    expect(getDuration(604800)).toBe('1 week');
    expect(getDuration(604800 * 4)).toBe('4 weeks');
    expect(getDuration(2629800)).toBe('1 month');
    expect(getDuration(604800 * 12)).toBe('3 months');
  });

  it('should format negative durations', function () {
    expect(formatSecondsToClock(0)).toBe('00:00');
    expect(formatSecondsToClock(-0.001)).toBe('00:00.001');
    expect(formatSecondsToClock(-0.01)).toBe('00:00.010');
    expect(getDuration(-0.1)).toBe('-100 milliseconds');
    expect(getDuration(-0.1, 2)).toBe('-100.00 milliseconds');
    expect(getDuration(-1)).toBe('-1 second');
    expect(getDuration(-2)).toBe('-2 seconds');
    expect(getDuration(-65)).toBe('-1 minute');
    expect(getDuration(-122)).toBe('-2 minutes');
    expect(getDuration(-3720)).toBe('-1 hour');
    expect(getDuration(-36000)).toBe('-10 hours');
    expect(getDuration(-86400)).toBe('-1 day');
    expect(getDuration(-86400 * 2)).toBe('-2 days');
    expect(getDuration(-604800)).toBe('-1 week');
    expect(getDuration(-604800 * 4)).toBe('-4 weeks');
    expect(getDuration(-2629800)).toBe('-1 month');
    expect(getDuration(-604800 * 12)).toBe('-3 months');
  });

  it('should format numbers and abbreviate units', function () {
    expect(getDuration(0, 2, true)).toBe('0.00ms');
    expect(getDuration(0, 0, true)).toBe('0ms');
    expect(getDuration(0.1, 0, true)).toBe('100ms');
    expect(getDuration(0.1, 2, true)).toBe('100.00ms');
    expect(getDuration(1, 2, true)).toBe('1.00s');
    expect(getDuration(122, 0, true)).toBe('2min');
    expect(getDuration(3600, 0, true)).toBe('1hr');
    expect(getDuration(86400, 0, true)).toBe('1d');
    expect(getDuration(86400 * 2, 0, true)).toBe('2d');
    expect(getDuration(604800, 0, true)).toBe('1wk');
    expect(getDuration(604800 * 2, 0, true)).toBe('2wk');
    expect(getDuration(2629800, 0, true)).toBe('1mo');
    expect(getDuration(604800 * 12, 0, true)).toBe('3mo');
  });

  it('should format numbers and abbreviate units with one letter', function () {
    expect(getDuration(0, 2, false, true)).toBe('0.00ms');
    expect(getDuration(0, 0, false, true)).toBe('0ms');
    expect(getDuration(0.1, 0, false, true)).toBe('100ms');
    expect(getDuration(0.1, 2, false, true)).toBe('100.00ms');
    expect(getDuration(1, 2, false, true)).toBe('1.00s');
    expect(getDuration(122, 0, false, true)).toBe('2m');
    expect(getDuration(3600, 0, false, true)).toBe('1h');
    expect(getDuration(86400, 0, false, true)).toBe('1d');
    expect(getDuration(86400 * 2, 0, false, true)).toBe('2d');
    expect(getDuration(604800, 0, false, true)).toBe('1w');
    expect(getDuration(604800 * 2, 0, false, true)).toBe('2w');
    expect(getDuration(2629800, 0, false, true)).toBe('4w');
    expect(getDuration(604800 * 12, 0, false, true)).toBe('12w');
  });

  it('should format negative durations with absolute', function () {
    expect(formatSecondsToClock(0)).toBe('00:00');
    expect(formatSecondsToClock(-0.001)).toBe('00:00.001');
    expect(formatSecondsToClock(-0.01)).toBe('00:00.010');
    expect(getDuration(-0.1, 0, false, false, true)).toBe('100 milliseconds');
    expect(getDuration(-0.1, 2, false, false, true)).toBe('100.00 milliseconds');
    expect(getDuration(-1, 0, false, false, true)).toBe('1 second');
    expect(getDuration(-2, 0, false, false, true)).toBe('2 seconds');
    expect(getDuration(-65, 0, false, false, true)).toBe('1 minute');
    expect(getDuration(-122, 0, false, false, true)).toBe('2 minutes');
    expect(getDuration(-3720, 0, false, false, true)).toBe('1 hour');
    expect(getDuration(-36000, 0, false, false, true)).toBe('10 hours');
    expect(getDuration(-86400, 0, false, false, true)).toBe('1 day');
    expect(getDuration(-86400 * 2, 0, false, false, true)).toBe('2 days');
    expect(getDuration(-604800, 0, false, false, true)).toBe('1 week');
    expect(getDuration(-604800 * 4, 0, false, false, true)).toBe('4 weeks');
    expect(getDuration(-2629800, 0, false, false, true)).toBe('1 month');
    expect(getDuration(-604800 * 12, 0, false, false, true)).toBe('3 months');
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

describe('getExactDuration', () => {
  it('should provide default value', () => {
    expect(getExactDuration(0)).toEqual('0 milliseconds');
  });

  it('should format durations without extra suffixes', () => {
    expect(getExactDuration(2.030043848568126)).toEqual('2 seconds 30 milliseconds');
    expect(getExactDuration(0.2)).toEqual('200 milliseconds');
    expect(getExactDuration(13)).toEqual('13 seconds');
    expect(getExactDuration(60)).toEqual('1 minute');
    expect(getExactDuration(121)).toEqual('2 minutes 1 second');
    expect(getExactDuration(234235435)).toEqual(
      '387 weeks 2 days 1 hour 23 minutes 55 seconds'
    );
  });

  it('should format negative durations', () => {
    expect(getExactDuration(-2.030043848568126)).toEqual('-2 seconds -30 milliseconds');
    expect(getExactDuration(-0.2)).toEqual('-200 milliseconds');
    expect(getExactDuration(-13)).toEqual('-13 seconds');
    expect(getExactDuration(-60)).toEqual('-1 minute');
    expect(getExactDuration(-121)).toEqual('-2 minutes -1 second');
    expect(getExactDuration(-234235435)).toEqual(
      '-387 weeks -2 days -1 hour -23 minutes -55 seconds'
    );
  });

  it('should abbreviate label', () => {
    expect(getExactDuration(234235435, true)).toEqual('387wk 2d 1hr 23min 55s');
  });

  it('should pin/truncate to the min suffix precision if provided', () => {
    expect(getExactDuration(0, false, 'seconds')).toEqual('0 seconds');
    expect(getExactDuration(0.2, false, 'seconds')).toEqual('0 seconds');
    expect(getExactDuration(2.030043848568126, false, 'seconds')).toEqual('2 seconds');
    expect(getExactDuration(13, false, 'seconds')).toEqual('13 seconds');
    expect(getExactDuration(60, false, 'seconds')).toEqual('1 minute');
    expect(getExactDuration(121, false, 'seconds')).toEqual('2 minutes 1 second');
    expect(getExactDuration(234235435.2, false, 'seconds')).toEqual(
      '387 weeks 2 days 1 hour 23 minutes 55 seconds'
    );
  });
});

describe('parseLargestSuffix', () => {
  it('parses exact values', () => {
    expect(parseLargestSuffix(0)).toEqual([0, 'seconds']);
    expect(parseLargestSuffix(SEC_IN_MIN)).toEqual([1, 'minutes']);
    expect(parseLargestSuffix(SEC_IN_MIN * 2)).toEqual([2, 'minutes']);
    expect(parseLargestSuffix(SEC_IN_HR)).toEqual([1, 'hours']);
    expect(parseLargestSuffix(SEC_IN_DAY)).toEqual([1, 'days']);
    expect(parseLargestSuffix(SEC_IN_WK, 'weeks')).toEqual([1, 'weeks']);
  });

  it('parses non-exact values', () => {
    expect(parseLargestSuffix(SEC_IN_MIN + 1)).toEqual([61, 'seconds']);
    expect(parseLargestSuffix(SEC_IN_HR + SEC_IN_MIN)).toEqual([61, 'minutes']);
    expect(parseLargestSuffix(SEC_IN_DAY + SEC_IN_HR)).toEqual([25, 'hours']);
    expect(parseLargestSuffix(SEC_IN_DAY + SEC_IN_MIN)).toEqual([1441, 'minutes']);
  });

  it('pins to max suffix', () => {
    expect(parseLargestSuffix(10, 'minutes')).toEqual([10, 'seconds']);
    expect(parseLargestSuffix(SEC_IN_WK, 'minutes')).toEqual([10080, 'minutes']);
    expect(parseLargestSuffix(SEC_IN_WK, 'hours')).toEqual([168, 'hours']);
    expect(parseLargestSuffix(SEC_IN_WK, 'days')).toEqual([7, 'days']);
  });
});

describe('formatNumberWithDynamicDecimals', () => {
  it('rounds to two decimal points without forcing them', () => {
    expect(formatNumberWithDynamicDecimalPoints(1)).toEqual('1');
    expect(formatNumberWithDynamicDecimalPoints(1.0)).toEqual('1');
    expect(formatNumberWithDynamicDecimalPoints(1.5)).toEqual('1.5');
    expect(formatNumberWithDynamicDecimalPoints(1.05)).toEqual('1.05');
    expect(formatNumberWithDynamicDecimalPoints(1.004)).toEqual('1');
    expect(formatNumberWithDynamicDecimalPoints(1.005)).toEqual('1.01');
    expect(formatNumberWithDynamicDecimalPoints(1.1009)).toEqual('1.1');
    expect(formatNumberWithDynamicDecimalPoints(2.236)).toEqual('2.24');
  });

  it('preserves significant decimal places', () => {
    expect(formatNumberWithDynamicDecimalPoints(0.001234)).toEqual('0.0012');
    expect(formatNumberWithDynamicDecimalPoints(0.000125)).toEqual('0.00013');
    expect(formatNumberWithDynamicDecimalPoints(0.0000123)).toEqual('0.000012');
  });

  it('handles zero, NaN and Infinity', () => {
    expect(formatNumberWithDynamicDecimalPoints(0)).toEqual('0');
    expect(formatNumberWithDynamicDecimalPoints(NaN)).toEqual('NaN');
    expect(formatNumberWithDynamicDecimalPoints(Infinity)).toEqual('∞');
    expect(formatNumberWithDynamicDecimalPoints(-Infinity)).toEqual('-∞');
  });
});
