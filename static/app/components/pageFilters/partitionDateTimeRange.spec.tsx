import moment from 'moment-timezone';

import {partitionDateTimeRange} from 'sentry/components/pageFilters/partitionDateTimeRange';
import type {PageFilters} from 'sentry/types/core';

const HOUR = 60 * 60 * 1000;

type DateTimeFilter = PageFilters['datetime'];

function absolute(startMs: number, endMs: number): DateTimeFilter {
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    period: null,
    utc: true,
  };
}

function relative(period: string): DateTimeFilter {
  return {start: null, end: null, period, utc: null};
}

const ms = (value: DateTimeFilter['start']) => moment.utc(value ?? undefined).valueOf();
const spanHours = (window: DateTimeFilter) =>
  Math.round((ms(window.end) - ms(window.start)) / HOUR);

describe('partitionDateTimeRange', () => {
  it('returns the original datetime unchanged for an unparseable interval', () => {
    const datetime = absolute(0, 100 * HOUR);
    const result = partitionDateTimeRange(datetime, 'garbage', 'progressive');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(datetime);
  });

  it('returns the original datetime unchanged for ranges below the minimum', () => {
    // 23h < the 1-day minimum.
    const datetime = absolute(0, 23 * HOUR);
    const result = partitionDateTimeRange(datetime, '1h', 'progressive');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(datetime);
  });

  it('keeps a narrow relative range relative (single, unchanged window)', () => {
    // 30m < the 1-day minimum, regardless of where "now" lands.
    const datetime = relative('30m');
    const result = partitionDateTimeRange(datetime, '1m', 'progressive');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(datetime);
  });

  it('splits progressively into geometric, newest-first, growing absolute windows', () => {
    // 720 buckets (30d @ 1h), 5 windows, growth factor 3 → weights 1:3:9:27:81.
    const windows = partitionDateTimeRange(absolute(0, 720 * HOUR), '1h', 'progressive');

    // Newest (smallest) first; the oldest window absorbs the remainder.
    expect(windows.map(spanHours)).toEqual([6, 18, 54, 161, 481]);

    for (const window of windows) {
      expect(window.period).toBeNull();
      expect(window.start).toBeInstanceOf(Date);
    }
    expect(ms(windows[0]!.end)).toBe(720 * HOUR);
    expect(ms(windows.at(-1)!.start)).toBe(0);
  });

  it('splits equally into roughly equal windows', () => {
    const windows = partitionDateTimeRange(absolute(0, 720 * HOUR), '1h', 'equal');
    expect(windows.map(spanHours)).toEqual([144, 144, 144, 144, 144]);
  });

  it('produces contiguous, non-overlapping, epoch-aligned windows covering the range', () => {
    const windows = partitionDateTimeRange(absolute(0, 720 * HOUR), '1h', 'progressive');

    for (const window of windows) {
      expect(ms(window.start) % HOUR).toBe(0);
      expect(ms(window.end) % HOUR).toBe(0);
    }
    for (let i = 1; i < windows.length; i++) {
      expect(ms(windows[i]!.end)).toBe(ms(windows[i - 1]!.start));
    }
  });

  it('snaps unaligned outer bounds to the epoch grid', () => {
    const windows = partitionDateTimeRange(
      absolute(30 * 60 * 1000, 100 * HOUR + 15 * 60 * 1000),
      '1h',
      'progressive'
    );

    expect(ms(windows[0]!.end)).toBe(101 * HOUR); // ceil
    expect(ms(windows.at(-1)!.start)).toBe(0); // floor
  });

  it('splits a wide relative range into absolute windows anchored to now', () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-31T00:00:00.000Z'));
    try {
      // 30d @ 1h = 720 buckets, ending at "now".
      const windows = partitionDateTimeRange(relative('30d'), '1h', 'progressive');
      expect(windows.map(spanHours)).toEqual([6, 18, 54, 161, 481]);
      expect(windows[0]!.period).toBeNull();
      expect(ms(windows[0]!.end)).toBe(Date.parse('2024-01-31T00:00:00.000Z'));
    } finally {
      jest.useRealTimers();
    }
  });
});
