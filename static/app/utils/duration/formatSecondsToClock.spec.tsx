import {formatSecondsToClock} from 'sentry/utils/duration/formatSecondsToClock';

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
