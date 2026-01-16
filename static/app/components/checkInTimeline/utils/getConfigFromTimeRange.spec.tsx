import moment from 'moment-timezone';

import {getFormat} from 'sentry/utils/dates';

import {getConfigFromTimeRange} from './getConfigFromTimeRange';

describe('getConfigFromTimeRange', () => {
  const timelineWidth = 800;
  const timezone = 'UTC';

  it('divides into minutes for small intervals', () => {
    const start = new Date('2023-06-15T11:00:00Z');
    const end = new Date('2023-06-15T11:05:00Z');
    const config = getConfigFromTimeRange(start, end, timelineWidth, timezone);
    expect(config).toEqual({
      periodStart: start,
      start,
      end,
      dateLabelFormat: getFormat({timeOnly: true, seconds: true}),
      elapsedMinutes: 5,
      rollupConfig: {
        bucketPixels: 40,
        interval: 15,
        timelineUnderscanWidth: 0,
        totalBuckets: 20,
        underscanBuckets: 0,
        underscanStartOffset: 0,
      },
      intervals: {
        normalMarkerInterval: 1,
        minimumMarkerInterval: 0.625,
        referenceMarkerInterval: 0.71875,
      },
      dateTimeProps: {timeOnly: true},
      timelineWidth,
      timezone,
    });
  });

  it('displays dates when more than 1 day window size', () => {
    const start = new Date('2023-06-15T11:00:00Z');
    const end = new Date('2023-06-16T11:05:00Z');
    const config = getConfigFromTimeRange(start, end, timelineWidth, timezone);
    expect(config).toEqual({
      periodStart: start,
      start: moment(start)
        .subtract(60 * 154, 'seconds')
        .toDate(),
      end,
      dateLabelFormat: getFormat(),
      elapsedMinutes: 1445,
      rollupConfig: {
        bucketPixels: 0.5,
        interval: 60,
        timelineUnderscanWidth: 77,
        totalBuckets: 1446,
        underscanBuckets: 154,
        underscanStartOffset: 0,
      },
      intervals: {
        normalMarkerInterval: 240,
        minimumMarkerInterval: 219.8478561549101,
        referenceMarkerInterval: 229.84094052558783,
      },
      dateTimeProps: {timeOnly: false},
      timelineWidth: 723,
      timezone,
    });
  });

  it('divides into minutes without showing seconds for medium intervals', () => {
    const start = new Date('2023-06-15T08:00:00Z');
    const end = new Date('2023-06-15T23:00:00Z');
    const config = getConfigFromTimeRange(start, end, timelineWidth, timezone);
    expect(config).toEqual({
      periodStart: start,
      start: moment(start)
        .subtract(900 * 2, 'seconds')
        .toDate(),
      end,
      dateLabelFormat: getFormat({timeOnly: true}),
      elapsedMinutes: 900,
      rollupConfig: {
        bucketPixels: 13,
        interval: 900,
        timelineUnderscanWidth: 20,
        totalBuckets: 60,
        underscanBuckets: 2,
        underscanStartOffset: 6,
      },
      intervals: {
        normalMarkerInterval: 120,
        minimumMarkerInterval: 115.38461538461537,
        referenceMarkerInterval: 132.69230769230768,
      },
      dateTimeProps: {timeOnly: true},
      timelineWidth: 780,
      timezone,
    });
  });

  it('divides into days for larger intervals', () => {
    const start = new Date('2023-05-15T11:00:00Z');
    const end = new Date('2023-06-15T11:00:00Z');
    const config = getConfigFromTimeRange(start, end, timelineWidth, timezone);
    expect(config).toEqual({
      periodStart: start,
      start: moment(start)
        .subtract(1800 * 112, 'seconds')
        .toDate(),
      end,
      dateLabelFormat: getFormat(),
      // 31 elapsed days
      elapsedMinutes: 31 * 24 * 60,
      rollupConfig: {
        bucketPixels: 0.5,
        interval: 1800,
        timelineUnderscanWidth: 56,
        totalBuckets: 1488,
        underscanBuckets: 112,
        underscanStartOffset: 0,
      },
      // 5 days in between each time label
      intervals: {
        normalMarkerInterval: 5 * 24 * 60,
        minimumMarkerInterval: 6000,
        referenceMarkerInterval: 6900,
      },
      dateTimeProps: {dateOnly: true},
      timelineWidth: 744,
      timezone,
    });
  });

  it('Includes dates when the window spans days', () => {
    const start = new Date('2023-05-14T20:00:00Z');
    const end = new Date('2023-05-15T10:00:00Z');
    const config = getConfigFromTimeRange(start, end, timelineWidth, timezone);
    expect(config).toEqual({
      periodStart: start,
      start: moment(start)
        .subtract(900 * 2, 'seconds')
        .toDate(),
      end,
      dateLabelFormat: getFormat(),
      // 14 hours
      elapsedMinutes: 14 * 60,
      rollupConfig: {
        bucketPixels: 14,
        interval: 900,
        timelineUnderscanWidth: 16,
        totalBuckets: 56,
        underscanBuckets: 2,
        underscanStartOffset: 12,
      },
      intervals: {
        normalMarkerInterval: 120,
        minimumMarkerInterval: 117.85714285714285,
        referenceMarkerInterval: 123.21428571428571,
      },
      dateTimeProps: {timeOnly: false},
      timelineWidth: 784,
      timezone,
    });
  });

  it('shifts the time window forward when underscan would fall before epoch', () => {
    // Start at the Unix epoch so that any underscan pushes the start < 0.
    const start = new Date(0);
    const end = new Date(60_000);
    const config = getConfigFromTimeRange(start, end, 101, timezone);

    // Underscan start is clamped to "one second after epoch" (1000ms).
    expect(config.start.getTime()).toBe(1000);

    // The entire window is shifted forward by a constant delta, preserving duration.
    const shiftMs = config.periodStart.getTime() - start.getTime();
    expect(shiftMs).toBeGreaterThan(0);
    expect(config.periodStart.getTime()).toBe(start.getTime() + shiftMs);
    expect(config.end.getTime()).toBe(end.getTime() + shiftMs);

    // The duration of the window is preserved.
    expect(config.end.getTime() - config.periodStart.getTime()).toBe(
      end.getTime() - start.getTime()
    );
  });
});
