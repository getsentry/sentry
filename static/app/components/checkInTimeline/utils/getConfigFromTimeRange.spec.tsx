import {getFormat} from 'sentry/utils/dates';

import {getConfigFromTimeRange} from './getConfigFromTimeRange';

describe('getConfigFromTimeRange', function () {
  const timelineWidth = 800;

  it('divides into minutes for small intervals', function () {
    const start = new Date('2023-06-15T11:00:00Z');
    const end = new Date('2023-06-15T11:05:00Z');
    const config = getConfigFromTimeRange(start, end, timelineWidth);
    expect(config).toEqual({
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
        underscanPeriod: 0,
      },
      showUnderscanHelp: false,
      intervals: {
        normalMarkerInterval: 1,
        minimumMarkerInterval: 0.625,
        referenceMarkerInterval: 0.71875,
      },
      dateTimeProps: {timeOnly: true},
      timelineWidth,
    });
  });

  it('displays dates when more than 1 day window size', function () {
    const start = new Date('2023-06-15T11:00:00Z');
    const end = new Date('2023-06-16T11:05:00Z');
    const config = getConfigFromTimeRange(start, end, timelineWidth);
    expect(config).toEqual({
      start,
      end,
      dateLabelFormat: getFormat(),
      elapsedMinutes: 1445,
      rollupConfig: {
        bucketPixels: 0.5,
        interval: 60,
        timelineUnderscanWidth: 77,
        totalBuckets: 1446,
        underscanBuckets: 154,
        underscanPeriod: 9240,
      },
      showUnderscanHelp: false,
      intervals: {
        normalMarkerInterval: 240,
        minimumMarkerInterval: 219.8478561549101,
        referenceMarkerInterval: 229.84094052558783,
      },
      dateTimeProps: {timeOnly: false},
      timelineWidth: 723,
    });
  });

  it('divides into minutes without showing seconds for medium intervals', function () {
    const start = new Date('2023-06-15T08:00:00Z');
    const end = new Date('2023-06-15T23:00:00Z');
    const config = getConfigFromTimeRange(start, end, timelineWidth);
    expect(config).toEqual({
      start,
      end,
      dateLabelFormat: getFormat({timeOnly: true}),
      elapsedMinutes: 900,
      rollupConfig: {
        bucketPixels: 13,
        interval: 900,
        timelineUnderscanWidth: 20,
        totalBuckets: 60,
        underscanBuckets: 1,
        underscanPeriod: 900,
      },
      intervals: {
        normalMarkerInterval: 120,
        minimumMarkerInterval: 115.38461538461537,
        referenceMarkerInterval: 132.69230769230768,
      },
      showUnderscanHelp: false,
      dateTimeProps: {timeOnly: true},
      timelineWidth: 780,
    });
  });

  it('divides into days for larger intervals', function () {
    const start = new Date('2023-05-15T11:00:00Z');
    const end = new Date('2023-06-15T11:00:00Z');
    const config = getConfigFromTimeRange(start, end, timelineWidth);
    expect(config).toEqual({
      start,
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
        underscanPeriod: 201600,
      },
      // 5 days in between each time label
      intervals: {
        normalMarkerInterval: 5 * 24 * 60,
        minimumMarkerInterval: 6000,
        referenceMarkerInterval: 6900,
      },
      showUnderscanHelp: false,
      dateTimeProps: {dateOnly: true},
      timelineWidth: 744,
    });
  });

  it('Includes dates when the window spans days', function () {
    const start = new Date('2023-05-14T20:00:00Z');
    const end = new Date('2023-05-15T10:00:00Z');
    const config = getConfigFromTimeRange(start, end, timelineWidth);
    expect(config).toEqual({
      start,
      end,
      dateLabelFormat: getFormat(),
      // 14 hours
      elapsedMinutes: 14 * 60,
      rollupConfig: {
        bucketPixels: 14,
        interval: 900,
        timelineUnderscanWidth: 16,
        totalBuckets: 56,
        underscanBuckets: 1,
        underscanPeriod: 900,
      },
      showUnderscanHelp: false,
      intervals: {
        normalMarkerInterval: 120,
        minimumMarkerInterval: 117.85714285714285,
        referenceMarkerInterval: 123.21428571428571,
      },
      dateTimeProps: {timeOnly: false},
      timelineWidth: 784,
    });
  });
});
