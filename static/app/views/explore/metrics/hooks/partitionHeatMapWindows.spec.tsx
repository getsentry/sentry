import moment from 'moment-timezone';

import type {PageFilters} from 'sentry/types/core';
import {partitionDateTimeIntoHeatMapWindows} from 'sentry/views/explore/metrics/hooks/partitionHeatMapWindows';

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

const spanHours = (window: {end: string; start: string}) =>
  Math.round(
    (moment.utc(window.end).valueOf() - moment.utc(window.start).valueOf()) / HOUR
  );

describe('partitionDateTimeIntoHeatMapWindows', () => {
  it('returns an empty plan when the interval is unusable', () => {
    // No usable interval — unparseable or missing — means nothing to fetch.
    const empty = {windows: [], timeDomain: {start: 0, end: 0}};
    expect(
      partitionDateTimeIntoHeatMapWindows(
        absolute(0, 100 * HOUR),
        'garbage',
        'progressive'
      )
    ).toMatchObject(empty);
    expect(
      partitionDateTimeIntoHeatMapWindows(absolute(0, 100 * HOUR), null, 'progressive')
    ).toMatchObject(empty);
  });

  it('exposes the whole selection as a fallback window even when chunked', () => {
    // The fast-path / empty-bounds fallback fires this single window over the
    // entire range, distinct from the partitioned chunk windows.
    const {fullWindow, windows} = partitionDateTimeIntoHeatMapWindows(
      absolute(0, 720 * HOUR),
      '1h',
      'progressive'
    );
    expect(windows.length).toBeGreaterThan(1);
    expect(fullWindow).toEqual({
      start: '1970-01-01T00:00:00.000',
      end: '1970-01-31T00:00:00.000',
    });
  });

  it('returns a single selection window for ranges below the minimum', () => {
    // 23h < the 1-day minimum → the original selection, unpartitioned.
    const {windows} = partitionDateTimeIntoHeatMapWindows(
      absolute(0, 23 * HOUR),
      '1h',
      'progressive'
    );
    expect(windows).toEqual([
      {start: '1970-01-01T00:00:00.000', end: '1970-01-01T23:00:00.000'},
    ]);
  });

  it('keeps a narrow relative range as a single statsPeriod window', () => {
    const {windows} = partitionDateTimeIntoHeatMapWindows(
      relative('30m'),
      '1m',
      'progressive'
    );
    expect(windows).toEqual([{statsPeriod: '30m'}]);
  });

  describe('absolute ranges', () => {
    it('partitions into aligned, non-overlapping, progressive windows', () => {
      // 720 buckets (30d @ 1h), progressive → widths [55, 166, 499].
      const {windows, timeDomain} = partitionDateTimeIntoHeatMapWindows(
        absolute(0, 720 * HOUR),
        '1h',
        'progressive'
      );

      expect(timeDomain).toEqual({start: 0, end: 720 * HOUR});
      const absoluteWindows = windows as Array<{end: string; start: string}>;
      // Oldest→newest (largest first); the newest window is the smallest.
      expect(absoluteWindows.map(spanHours)).toEqual([499, 166, 55]);

      // Contiguous (no overlap), covering the whole range.
      expect(moment.utc(absoluteWindows[0]!.start).valueOf()).toBe(0);
      expect(moment.utc(absoluteWindows.at(-1)!.end).valueOf()).toBe(720 * HOUR);
      for (let i = 1; i < absoluteWindows.length; i++) {
        expect(absoluteWindows[i]!.start).toBe(absoluteWindows[i - 1]!.end);
      }
    });

    it('partitions equally when asked', () => {
      const {windows} = partitionDateTimeIntoHeatMapWindows(
        absolute(0, 720 * HOUR),
        '1h',
        'equal'
      );
      expect((windows as Array<{end: string; start: string}>).map(spanHours)).toEqual([
        240, 240, 240,
      ]);
    });
  });

  describe('relative ranges', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2024-01-31T00:00:00.000Z'));
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('partitions into statsPeriod offsets that overlap the newer neighbor', () => {
      // 720 buckets (30d @ 1h), progressive → widths [55, 166, 499].
      const {windows} = partitionDateTimeIntoHeatMapWindows(
        relative('30d'),
        '1h',
        'progressive'
      );

      // Newest runs to now; the rest end 2 buckets (2h = 7200s) past their
      // boundary toward now, so they overlap their newer neighbor.
      expect(windows).toEqual([
        {statsPeriod: '198000s'}, //                                 [55h ago, now]
        {statsPeriodStart: '795600s', statsPeriodEnd: '190800s'}, //  [221h, 53h]
        {statsPeriodStart: '2592000s', statsPeriodEnd: '788400s'}, // [720h, 219h]
      ]);
    });
  });
});
