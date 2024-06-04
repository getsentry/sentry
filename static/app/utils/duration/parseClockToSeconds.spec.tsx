import {parseClockToSeconds} from 'sentry/utils/duration/parseClockToSeconds';
import {
  DAY, // ms in day
  MONTH, // ms in month
  WEEK, // ms in week
} from 'sentry/utils/formatters';

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
