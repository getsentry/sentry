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
      // 720 buckets (30d @ 1h), progressive → widths [55, 166, 499].
      const {windows, timeDomain} = partitionDateTimeIntoHeatMapWindows(
        absolute(BASE_MS, BASE_MS + 720 * HOUR),
        '1h',
        'progressive'
      );

      expect(timeDomain).toEqual({start: BASE_MS, end: BASE_MS + 720 * HOUR});
      const absoluteWindows = windows as Array<{end: string; start: string}>;

      expect(absoluteWindows.map(spanHours)).toEqual([499, 166, 55]);

      // Contiguous (no overlap), covering the whole range.
      expect(moment.utc(absoluteWindows[0]!.start).valueOf()).toBe(BASE_MS);
      expect(moment.utc(absoluteWindows.at(-1)!.end).valueOf()).toBe(
        BASE_MS + 720 * HOUR
      );
      for (let i = 1; i < absoluteWindows.length; i++) {
        expect(absoluteWindows[i]!.start).toBe(absoluteWindows[i - 1]!.end);
      }
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
      const {windows} = partitionDateTimeIntoHeatMapWindows(
        relative('30d'),
        '1h',
        'progressive'
      );

      expect(windows).toEqual([
        {statsPeriod: '198000s'}, //                                 [55h ago, now]
        {statsPeriodStart: '795600s', statsPeriodEnd: '190800s'}, //  [221h, 53h]
        {statsPeriodStart: '2592000s', statsPeriodEnd: '788400s'}, // [720h, 219h]
      ]);
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
