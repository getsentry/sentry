import moment from 'moment-timezone';

import type {PageFilters} from 'sentry/types/core';
import {partitionHeatmapWindows} from 'sentry/views/explore/metrics/hooks/partitionHeatmapWindows';

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

describe('partitionHeatmapWindows', () => {
  it('returns a single selection window for an unparseable interval', () => {
    const {windows} = partitionHeatmapWindows(
      absolute(0, 100 * HOUR),
      'garbage',
      'progressive'
    );
    expect(windows).toEqual([
      {start: '1970-01-01T00:00:00.000', end: '1970-01-05T04:00:00.000'},
    ]);
  });

  it('returns a single selection window for ranges below the minimum', () => {
    // 23h < the 1-day minimum → the original selection, unpartitioned.
    const {windows} = partitionHeatmapWindows(
      absolute(0, 23 * HOUR),
      '1h',
      'progressive'
    );
    expect(windows).toEqual([
      {start: '1970-01-01T00:00:00.000', end: '1970-01-01T23:00:00.000'},
    ]);
  });

  it('keeps a narrow relative range as a single statsPeriod window', () => {
    const {windows} = partitionHeatmapWindows(relative('30m'), '1m', 'progressive');
    expect(windows).toEqual([{statsPeriod: '30m'}]);
  });

  describe('absolute ranges', () => {
    it('partitions into aligned, non-overlapping, progressive windows', () => {
      // 720 buckets (30d @ 1h), progressive → widths [6, 18, 54, 161, 481].
      const {windows, fullRange, intervalMs} = partitionHeatmapWindows(
        absolute(0, 720 * HOUR),
        '1h',
        'progressive'
      );

      expect(intervalMs).toBe(HOUR);
      expect(fullRange).toEqual({start: 0, end: 720 * HOUR});
      const absoluteWindows = windows as Array<{end: string; start: string}>;
      expect(absoluteWindows.map(spanHours)).toEqual([6, 18, 54, 161, 481]);

      // Newest-first, contiguous (no overlap), covering the whole range.
      expect(moment.utc(absoluteWindows[0]!.end).valueOf()).toBe(720 * HOUR);
      expect(moment.utc(absoluteWindows.at(-1)!.start).valueOf()).toBe(0);
      for (let i = 1; i < absoluteWindows.length; i++) {
        expect(absoluteWindows[i]!.end).toBe(absoluteWindows[i - 1]!.start);
      }
    });

    it('partitions equally when asked', () => {
      const {windows} = partitionHeatmapWindows(absolute(0, 720 * HOUR), '1h', 'equal');
      expect((windows as Array<{end: string; start: string}>).map(spanHours)).toEqual([
        144, 144, 144, 144, 144,
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
      // 720 buckets (30d @ 1h), progressive → widths [6, 18, 54, 161, 481].
      const {windows} = partitionHeatmapWindows(relative('30d'), '1h', 'progressive');

      // Newest runs to now; the rest end 2 buckets (2h = 7200s) past their
      // boundary toward now, so they overlap their newer neighbor.
      expect(windows).toEqual([
        {statsPeriod: '21600s'}, //             [6h ago, now]
        {statsPeriodStart: '86400s', statsPeriodEnd: '14400s'}, //   [24h, 4h]
        {statsPeriodStart: '280800s', statsPeriodEnd: '79200s'}, //  [78h, 22h]
        {statsPeriodStart: '860400s', statsPeriodEnd: '273600s'}, // [239h, 76h]
        {statsPeriodStart: '2592000s', statsPeriodEnd: '853200s'}, // [720h, 237h]
      ]);
    });
  });
});
