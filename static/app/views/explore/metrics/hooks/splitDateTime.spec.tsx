import moment from 'moment-timezone';

import type {PageFilters} from 'sentry/types/core';
import {splitDateTime} from 'sentry/views/explore/metrics/hooks/splitDateTime';

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

describe('splitDateTime', () => {
  it('returns the original datetime unchanged for an unparseable interval', () => {
    const datetime = absolute(0, 100 * HOUR);
    const result = splitDateTime(datetime, 'garbage');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(datetime);
  });

  it('returns the original datetime unchanged for narrow ranges', () => {
    // 10 buckets < the chunking threshold.
    const datetime = absolute(0, 10 * HOUR);
    const result = splitDateTime(datetime, '1h');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(datetime);
  });

  it('does not split right below the threshold', () => {
    expect(splitDateTime(absolute(0, 59 * HOUR), '1h')).toHaveLength(1);
  });

  it('keeps a narrow relative range relative (single, unchanged window)', () => {
    // 30 buckets @ 1m < threshold, regardless of where "now" lands.
    const datetime = relative('30m');
    const result = splitDateTime(datetime, '1m');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(datetime);
  });

  it('splits wide ranges into uneven, newest-first, growing absolute windows', () => {
    // 720 buckets (30d @ 1h).
    const windows = splitDateTime(absolute(0, 720 * HOUR), '1h');

    // Sizes grow older-ward: 15, 45, 135, 405, then the remainder (120).
    expect(windows.map(spanHours)).toEqual([15, 45, 135, 405, 120]);

    // Every split window is absolute (no period), newest-first.
    for (const window of windows) {
      expect(window.period).toBeNull();
      expect(window.start).toBeInstanceOf(Date);
    }
    expect(ms(windows[0]!.end)).toBe(720 * HOUR);
    expect(ms(windows.at(-1)!.start)).toBe(0);
  });

  it('produces contiguous, non-overlapping, epoch-aligned windows covering the range', () => {
    const windows = splitDateTime(absolute(0, 720 * HOUR), '1h');

    for (const window of windows) {
      expect(ms(window.start) % HOUR).toBe(0);
      expect(ms(window.end) % HOUR).toBe(0);
    }
    for (let i = 1; i < windows.length; i++) {
      expect(ms(windows[i]!.end)).toBe(ms(windows[i - 1]!.start));
    }
  });

  it('snaps unaligned outer bounds to the epoch grid', () => {
    const windows = splitDateTime(
      absolute(30 * 60 * 1000, 100 * HOUR + 15 * 60 * 1000),
      '1h'
    );

    expect(ms(windows[0]!.end)).toBe(101 * HOUR); // ceil
    expect(ms(windows.at(-1)!.start)).toBe(0); // floor
  });

  it('honors a custom chunk policy', () => {
    const windows = splitDateTime(absolute(0, 100 * HOUR), '1h', {
      initialBuckets: 10,
      growthFactor: 2,
      maxChunks: 3,
      minBucketsToChunk: 20,
    });

    // Newest-first: 10, 20, then the oldest window absorbs the remainder (70).
    expect(windows.map(spanHours)).toEqual([10, 20, 70]);
  });

  it('splits a wide relative range into absolute windows anchored to now', () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-31T00:00:00.000Z'));
    try {
      // 30d @ 1h = 720 buckets, ending at "now".
      const windows = splitDateTime(relative('30d'), '1h');
      expect(windows.map(spanHours)).toEqual([15, 45, 135, 405, 120]);
      expect(windows[0]!.period).toBeNull();
      expect(ms(windows[0]!.end)).toBe(Date.parse('2024-01-31T00:00:00.000Z'));
    } finally {
      jest.useRealTimers();
    }
  });
});
