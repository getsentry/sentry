import moment from 'moment-timezone';

import {progressivelySplitDateTimeRange} from 'sentry/components/pageFilters/progressivelySplitDateTimeRange';
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

describe('progressivelySplitDateTimeRange', () => {
  it('returns the original datetime unchanged for an unparseable interval', () => {
    const datetime = absolute(0, 100 * HOUR);
    const result = progressivelySplitDateTimeRange(datetime, 'garbage');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(datetime);
  });

  it('returns the original datetime unchanged for narrow ranges', () => {
    // 10 buckets < the default minimum.
    const datetime = absolute(0, 10 * HOUR);
    const result = progressivelySplitDateTimeRange(datetime, '1h');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(datetime);
  });

  it('does not split right below the minimum', () => {
    expect(progressivelySplitDateTimeRange(absolute(0, 59 * HOUR), '1h')).toHaveLength(1);
  });

  it('keeps a narrow relative range relative (single, unchanged window)', () => {
    // 30 buckets @ 1m < minimum, regardless of where "now" lands.
    const datetime = relative('30m');
    const result = progressivelySplitDateTimeRange(datetime, '1m');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(datetime);
  });

  it('splits wide ranges into geometric, newest-first, growing absolute windows', () => {
    // 720 buckets (30d @ 1h), 5 chunks, growth factor 3 → weights 1:3:9:27:81.
    const windows = progressivelySplitDateTimeRange(absolute(0, 720 * HOUR), '1h');

    // Newest (smallest) first; the oldest chunk absorbs the remainder.
    expect(windows.map(spanHours)).toEqual([6, 18, 54, 161, 481]);

    for (const window of windows) {
      expect(window.period).toBeNull();
      expect(window.start).toBeInstanceOf(Date);
    }
    expect(ms(windows[0]!.end)).toBe(720 * HOUR);
    expect(ms(windows.at(-1)!.start)).toBe(0);
  });

  it('produces contiguous, non-overlapping, epoch-aligned windows covering the range', () => {
    const windows = progressivelySplitDateTimeRange(absolute(0, 720 * HOUR), '1h');

    for (const window of windows) {
      expect(ms(window.start) % HOUR).toBe(0);
      expect(ms(window.end) % HOUR).toBe(0);
    }
    for (let i = 1; i < windows.length; i++) {
      expect(ms(windows[i]!.end)).toBe(ms(windows[i - 1]!.start));
    }
  });

  it('snaps unaligned outer bounds to the epoch grid', () => {
    const windows = progressivelySplitDateTimeRange(
      absolute(30 * 60 * 1000, 100 * HOUR + 15 * 60 * 1000),
      '1h'
    );

    expect(ms(windows[0]!.end)).toBe(101 * HOUR); // ceil
    expect(ms(windows.at(-1)!.start)).toBe(0); // floor
  });

  it('honors custom chunkCount and minimumBuckets', () => {
    // 100 buckets, 3 chunks, growth factor 3 → weights 1:3:9 (sum 13).
    const windows = progressivelySplitDateTimeRange(absolute(0, 100 * HOUR), '1h', {
      chunkCount: 3,
      minimumBuckets: 20,
    });

    // round(100/13)=8, round(300/13)=23, oldest absorbs remainder (69).
    expect(windows.map(spanHours)).toEqual([8, 23, 69]);
  });

  it('splits a wide relative range into absolute windows anchored to now', () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-31T00:00:00.000Z'));
    try {
      // 30d @ 1h = 720 buckets, ending at "now".
      const windows = progressivelySplitDateTimeRange(relative('30d'), '1h');
      expect(windows.map(spanHours)).toEqual([6, 18, 54, 161, 481]);
      expect(windows[0]!.period).toBeNull();
      expect(ms(windows[0]!.end)).toBe(Date.parse('2024-01-31T00:00:00.000Z'));
    } finally {
      jest.useRealTimers();
    }
  });
});
