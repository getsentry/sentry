import moment from 'moment-timezone';

import type {PageFilters} from 'sentry/types/core';
import {partitionDateTimeIntoHeatMapWindows} from 'sentry/views/explore/metrics/hooks/partitionHeatMapWindows';

const HOUR = 60 * 60 * 1000;

// A fixed, recent, hour-aligned anchor so window strings read as real dates.
const BASE_MS = Date.UTC(2024, 0, 1); // 2024-01-01T00:00:00Z

type DateTimeFilter = PageFilters['datetime'];

describe('partitionDateTimeIntoHeatMapWindows', () => {
  it('Returns an empty plan when the interval is unusable', () => {
    const empty = {windows: [], timeDomain: {start: 0, end: 0}};

    expect(
      partitionDateTimeIntoHeatMapWindows(
        absolute(BASE_MS, BASE_MS + 100 * HOUR),
        'garbage',
        'progressive'
      )
    ).toMatchObject(empty);
    expect(
      partitionDateTimeIntoHeatMapWindows(
        absolute(BASE_MS, BASE_MS + 100 * HOUR),
        null,
        'progressive'
      )
    ).toMatchObject(empty);
  });

  it('Returns a single selection window for ranges below the minimum', () => {
    const {windows} = partitionDateTimeIntoHeatMapWindows(
      absolute(BASE_MS, BASE_MS + 23 * HOUR),
      '1h',
      'progressive'
    );
    expect(windows).toEqual([
      {start: '2024-01-01T00:00:00.000', end: '2024-01-01T23:00:00.000'},
    ]);
  });

  it('Keeps a narrow relative range as a single statsPeriod window', () => {
    const {windows} = partitionDateTimeIntoHeatMapWindows(
      relative('30m'),
      '1m',
      'progressive'
    );
    expect(windows).toEqual([{statsPeriod: '30m'}]);
  });

  describe('Absolute ranges', () => {
    it('Partitions into aligned, non-overlapping, progressive windows', () => {
      // 720 buckets (30d @ 1h). Asserts the invariants of a progressive
      // partition rather than the exact widths, so the sizing constants can be
      // retuned without rewriting the test.
      const totalHours = 720;
      const {windows, timeDomain} = partitionDateTimeIntoHeatMapWindows(
        absolute(BASE_MS, BASE_MS + totalHours * HOUR),
        '1h',
        'progressive'
      );

      expect(timeDomain).toEqual({start: BASE_MS, end: BASE_MS + totalHours * HOUR});
      const absoluteWindows = windows as Array<{end: string; start: string}>;
      const spans = absoluteWindows.map(spanHours);

      // Split into multiple windows.
      expect(absoluteWindows.length).toBeGreaterThan(1);

      // Contiguous (no overlap), covering the whole range.
      expect(moment.utc(absoluteWindows[0]!.start).valueOf()).toBe(BASE_MS);
      expect(moment.utc(absoluteWindows.at(-1)!.end).valueOf()).toBe(
        BASE_MS + totalHours * HOUR
      );
      for (let i = 1; i < absoluteWindows.length; i++) {
        expect(absoluteWindows[i]!.start).toBe(absoluteWindows[i - 1]!.end);
      }

      // Progressive: windows shrink toward the present (oldest first, so spans
      // are non-increasing).
      for (let i = 1; i < spans.length; i++) {
        expect(spans[i]!).toBeLessThanOrEqual(spans[i - 1]!);
      }

      // The rebalance goal: no single chunk is more than half the grid.
      expect(Math.max(...spans)).toBeLessThan(totalHours / 2);
    });

    it('Partitions equally when asked', () => {
      const {windows} = partitionDateTimeIntoHeatMapWindows(
        absolute(BASE_MS, BASE_MS + 720 * HOUR),
        '1h',
        'equal'
      );
      expect((windows as Array<{end: string; start: string}>).map(spanHours)).toEqual([
        240, 240, 240,
      ]);
    });
  });

  describe('Relative ranges', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2024-01-31T00:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('Partitions into statsPeriod offsets that overlap the newer neighbor', () => {
      // Asserts the structure of a relative partition (newest-first, bounded
      // older windows that overlap their newer neighbor) rather than the exact
      // offsets, so the sizing constants can be retuned freely.
      const {windows} = partitionDateTimeIntoHeatMapWindows(
        relative('30d'),
        '1h',
        'progressive'
      );

      const parsed = windows as Array<{
        statsPeriod?: string;
        statsPeriodEnd?: string;
        statsPeriodStart?: string;
      }>;
      const secondsAgo = (value: string) => parseInt(value, 10);

      expect(parsed.length).toBeGreaterThan(1);

      // The newest window runs to now: a bare statsPeriod with no explicit end.
      expect(parsed[0]).toEqual({statsPeriod: expect.any(String)});

      // Older windows are bounded ranges.
      for (const window of parsed.slice(1)) {
        expect(window.statsPeriodStart).toEqual(expect.any(String));
        expect(window.statsPeriodEnd).toEqual(expect.any(String));
      }

      // Each window's older edge ("seconds ago"), and its newer edge (0 for the
      // live window that runs to now).
      const olderEdge = parsed.map(w => secondsAgo((w.statsPeriodStart ?? w.statsPeriod)!));
      const newerEdge = parsed.map(w => (w.statsPeriodEnd ? secondsAgo(w.statsPeriodEnd) : 0));

      for (let i = 1; i < parsed.length; i++) {
        // Newest-first: each window reaches further into the past.
        expect(olderEdge[i]!).toBeGreaterThan(olderEdge[i - 1]!);
        // ...and overlaps its newer neighbor (its newer edge sits inside it).
        expect(newerEdge[i]!).toBeLessThan(olderEdge[i - 1]!);
      }
    });
  });
});

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
