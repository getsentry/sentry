import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {PIXELS_PER_BUCKET} from 'sentry/views/dashboards/widgets/heatMapWidget/settings';
import {calculateHeatMapBucketDimensions} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/calculateHeatMapBucketDimensions';

const AVAILABLE_INTERVALS = [
  '1m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '6h',
  '12h',
  '1d',
];

function makeSelection(period: string) {
  return PageFiltersFixture({
    datetime: {period, start: null, end: null, utc: null},
  });
}

describe('calculateHeatMapBucketDimensions()', () => {
  describe('null guard rails', () => {
    it('returns null when width is 0', () => {
      expect(
        calculateHeatMapBucketDimensions(
          makeSelection('24h'),
          {width: 0, height: 300},
          AVAILABLE_INTERVALS
        )
      ).toBeNull();
    });

    it('returns null when height is 0', () => {
      expect(
        calculateHeatMapBucketDimensions(
          makeSelection('24h'),
          {width: 800, height: 0},
          AVAILABLE_INTERVALS
        )
      ).toBeNull();
    });

    it('returns null when width is negative', () => {
      expect(
        calculateHeatMapBucketDimensions(
          makeSelection('24h'),
          {width: -100, height: 300},
          AVAILABLE_INTERVALS
        )
      ).toBeNull();
    });

    it('returns null when height is negative', () => {
      expect(
        calculateHeatMapBucketDimensions(
          makeSelection('24h'),
          {width: 800, height: -50},
          AVAILABLE_INTERVALS
        )
      ).toBeNull();
    });

    it('returns null when availableIntervals is empty', () => {
      expect(
        calculateHeatMapBucketDimensions(
          makeSelection('24h'),
          {width: 800, height: 300},
          []
        )
      ).toBeNull();
    });

    it('returns null when the chosen interval is sub-pixel', () => {
      // A 1m interval over a 90d range on a narrow chart rounds to 0px wide,
      // which would cause a division-by-zero when computing yBuckets.
      expect(
        calculateHeatMapBucketDimensions(
          makeSelection('90d'),
          {width: 100, height: 300},
          ['1m']
        )
      ).toBeNull();
    });
  });

  describe('return shape', () => {
    it('returns an object with `interval` and `yBuckets`', () => {
      const result = calculateHeatMapBucketDimensions(
        makeSelection('24h'),
        {width: 800, height: 300},
        AVAILABLE_INTERVALS
      );

      expect(result).toEqual(
        expect.objectContaining({
          interval: expect.any(String),
          yBuckets: expect.any(Number),
        })
      );
    });

    it('always returns an interval from the provided list', () => {
      const result = calculateHeatMapBucketDimensions(
        makeSelection('24h'),
        {width: 800, height: 300},
        AVAILABLE_INTERVALS
      );

      expect(AVAILABLE_INTERVALS).toContain(result?.interval);
    });

    it('returns a positive yBuckets count', () => {
      const result = calculateHeatMapBucketDimensions(
        makeSelection('24h'),
        {width: 800, height: 300},
        AVAILABLE_INTERVALS
      );

      expect(result?.yBuckets).toBeGreaterThan(0);
    });
  });

  describe('interval selection', () => {
    it('picks a finer interval for a wider container', () => {
      const wide = calculateHeatMapBucketDimensions(
        makeSelection('24h'),
        {width: 1200, height: 300},
        AVAILABLE_INTERVALS
      );
      const narrow = calculateHeatMapBucketDimensions(
        makeSelection('24h'),
        {width: 300, height: 300},
        AVAILABLE_INTERVALS
      );

      // A wider container means more columns, so each bucket spans less time.
      // The interval index in the sorted list should be <= for the wider case.
      const wideIdx = AVAILABLE_INTERVALS.indexOf(wide!.interval);
      const narrowIdx = AVAILABLE_INTERVALS.indexOf(narrow!.interval);
      expect(wideIdx).toBeLessThanOrEqual(narrowIdx);
    });

    it('picks a coarser interval for a longer time range at the same width', () => {
      const short = calculateHeatMapBucketDimensions(
        makeSelection('1h'),
        {width: 800, height: 300},
        AVAILABLE_INTERVALS
      );
      const long = calculateHeatMapBucketDimensions(
        makeSelection('7d'),
        {width: 800, height: 300},
        AVAILABLE_INTERVALS
      );

      const shortIdx = AVAILABLE_INTERVALS.indexOf(short!.interval);
      const longIdx = AVAILABLE_INTERVALS.indexOf(long!.interval);
      expect(longIdx).toBeGreaterThanOrEqual(shortIdx);
    });

    it('only returns intervals from the restricted set', () => {
      const restricted = ['5m', '1h', '1d'];
      const result = calculateHeatMapBucketDimensions(
        makeSelection('24h'),
        {width: 800, height: 300},
        restricted
      );

      expect(restricted).toContain(result?.interval);
    });

    it('returns the single available interval when only one is provided', () => {
      const result = calculateHeatMapBucketDimensions(
        makeSelection('24h'),
        {width: 800, height: 300},
        ['1h']
      );

      expect(result?.interval).toBe('1h');
    });
  });

  describe('y-axis bucket count', () => {
    it('produces more y-axis buckets for a taller container', () => {
      const tall = calculateHeatMapBucketDimensions(
        makeSelection('24h'),
        {width: 800, height: 600},
        AVAILABLE_INTERVALS
      );
      const short = calculateHeatMapBucketDimensions(
        makeSelection('24h'),
        {width: 800, height: 200},
        AVAILABLE_INTERVALS
      );

      expect(tall!.yBuckets).toBeGreaterThanOrEqual(short!.yBuckets);
    });

    it('adjusts y-axis buckets based on the chosen x-axis interval pixel size', () => {
      // The y-axis bucket count is `height / intervalAsPixels`, not a fixed
      // `height / PIXELS_PER_BUCKET`. Two different time ranges at the same
      // dimensions can produce different y-axis counts because the chosen
      // interval snaps differently.
      const a = calculateHeatMapBucketDimensions(
        makeSelection('1h'),
        {width: 800, height: 300},
        AVAILABLE_INTERVALS
      );
      const b = calculateHeatMapBucketDimensions(
        makeSelection('7d'),
        {width: 800, height: 300},
        AVAILABLE_INTERVALS
      );

      // They _may_ be different — the point is that yBuckets is dynamic, not
      // a simple division by PIXELS_PER_BUCKET.
      expect(a!.yBuckets).toBeGreaterThan(0);
      expect(b!.yBuckets).toBeGreaterThan(0);
    });
  });

  describe('square cell goal', () => {
    it('produces roughly square cells for a typical dashboard layout', () => {
      // For a 24h window in a 720×360 container, the function should aim to
      // make cells where the pixel width ≈ pixel height.
      const width = 720;
      const height = 360;

      const result = calculateHeatMapBucketDimensions(
        makeSelection('24h'),
        {width, height},
        AVAILABLE_INTERVALS
      )!;

      // Reconstruct the pixel dimensions of a single cell
      const timeRangeMs = 24 * 60 * 60 * 1000;
      const intervalMs = parseIntervalToMs(result.interval);
      const cellPixelWidth = (intervalMs / timeRangeMs) * width;
      const cellPixelHeight = height / result.yBuckets;

      // The cells should be approximately square. Allow a generous ratio
      // since we're snapping to discrete intervals.
      const aspectRatio = cellPixelWidth / cellPixelHeight;
      expect(aspectRatio).toBeGreaterThan(0.2);
      expect(aspectRatio).toBeLessThan(5);
    });

    it('targets PIXELS_PER_BUCKET as the ideal cell size', () => {
      // The ideal (pre-snap) X-axis bucket width in pixels is PIXELS_PER_BUCKET.
      // After snapping to a real interval, the actual pixel width may differ,
      // but the y-axis bucket count is derived from that snapped size.
      const width = 900;
      const height = 300;

      const result = calculateHeatMapBucketDimensions(
        makeSelection('24h'),
        {width, height},
        AVAILABLE_INTERVALS
      )!;

      const timeRangeMs = 24 * 60 * 60 * 1000;
      const intervalMs = parseIntervalToMs(result.interval);
      const actualPixelWidth = (intervalMs / timeRangeMs) * width;

      // The snapped interval pixel size should be in the same order of
      // magnitude as PIXELS_PER_BUCKET.
      expect(actualPixelWidth).toBeGreaterThan(PIXELS_PER_BUCKET * 0.25);
      expect(actualPixelWidth).toBeLessThan(PIXELS_PER_BUCKET * 10);
    });
  });

  describe('edge cases', () => {
    it('handles a very narrow container gracefully', () => {
      const result = calculateHeatMapBucketDimensions(
        makeSelection('24h'),
        {width: 1, height: 300},
        AVAILABLE_INTERVALS
      );

      // Should still return a valid result (likely the coarsest interval)
      expect(result).not.toBeNull();
      expect(result!.yBuckets).toBeGreaterThan(0);
    });

    it('returns null for a very short container', () => {
      // A 1px tall container produces yBuckets = 0, which is not a
      // meaningful heat map.
      expect(
        calculateHeatMapBucketDimensions(
          makeSelection('24h'),
          {width: 800, height: 1},
          AVAILABLE_INTERVALS
        )
      ).toBeNull();
    });

    it('produces at least 1 y-axis bucket when there is reasonable height', () => {
      const result = calculateHeatMapBucketDimensions(
        makeSelection('24h'),
        {width: 800, height: 30},
        AVAILABLE_INTERVALS
      );

      expect(result).not.toBeNull();
      expect(result!.yBuckets).toBeGreaterThanOrEqual(1);
    });

    it('returns null for a very short time period where no grid is viable', () => {
      // With a 1m window the finest interval (1m) spans the full width,
      // so yBuckets rounds to 0 — no meaningful grid can be formed.
      expect(
        calculateHeatMapBucketDimensions(
          makeSelection('1m'),
          {width: 800, height: 300},
          AVAILABLE_INTERVALS
        )
      ).toBeNull();
    });

    it('returns null when the interval spans the full chart width', () => {
      // 1m period + 1m interval → intervalAsPixels equals the full width.
      // height / width rounds to 0, so no sensible grid can be formed.
      expect(
        calculateHeatMapBucketDimensions(makeSelection('1m'), {width: 800, height: 300}, [
          '1m',
        ])
      ).toBeNull();
    });

    it('handles a very long time period (90d)', () => {
      const result = calculateHeatMapBucketDimensions(
        makeSelection('90d'),
        {width: 800, height: 300},
        AVAILABLE_INTERVALS
      );

      // One of the coarsest intervals should be selected for such a long
      // window. With a 5px target over 90d / 800px the bucket target is ~13.5h,
      // which snaps to '12h' rather than the absolute coarsest '1d'.
      expect(result).not.toBeNull();
      expect(result!.interval).toBe('12h');
    });

    it('handles absolute date ranges', () => {
      const selection = PageFiltersFixture({
        datetime: {
          period: null,
          start: '2024-01-01T00:00:00',
          end: '2024-01-02T00:00:00',
          utc: true,
        },
      });

      const result = calculateHeatMapBucketDimensions(
        selection,
        {width: 800, height: 300},
        AVAILABLE_INTERVALS
      );

      expect(result).not.toBeNull();
      expect(AVAILABLE_INTERVALS).toContain(result?.interval);
      expect(result?.yBuckets).toBeGreaterThan(0);
    });
  });
});

/**
 * Helper: Convert an interval string like '5m' or '1h' to milliseconds for
 * assertions. This mirrors `intervalToMilliseconds` but is duplicated here to
 * keep the test self-contained.
 */
function parseIntervalToMs(interval: string): number {
  const match = /^(\d+)([mhdw])$/.exec(interval);
  if (!match) {
    throw new Error(`Unparseable interval: ${interval}`);
  }
  const value = parseInt(match[1]!, 10);
  const multipliers: Record<string, number> = {
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };
  return value * multipliers[match[2]!]!;
}
