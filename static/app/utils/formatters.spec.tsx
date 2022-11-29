import {
  DAY,
  formatAbbreviatedNumber,
  formatFloat,
  formatPercentage,
  formatSecondsToClock,
  getDuration,
  MONTH,
  parseClockToSeconds,
  WEEK,
} from 'sentry/utils/formatters';

describe('getDuration()', function () {
  it('should format durations', function () {
    expect(getDuration(0, 2)).toBe('0.00ms');
    expect(getDuration(0.1)).toBe('100ms');
    expect(getDuration(0.1, 2)).toBe('100.00ms');
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
    expect(getDuration(-0, 2)).toBe('0.00ms');
    expect(getDuration(-0.1)).toBe('-100ms');
    expect(getDuration(-0.1, 2)).toBe('-100.00ms');
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
