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
      intervals: {
        normalMarkerInterval: 240,
        minimumMarkerInterval: 198.6875,
        referenceMarkerInterval: 207.71875,
      },
      dateTimeProps: {timeOnly: false},
      timelineWidth,
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
      intervals: {
        normalMarkerInterval: 120,
        minimumMarkerInterval: 112.5,
        referenceMarkerInterval: 129.375,
      },
      dateTimeProps: {timeOnly: true},
      timelineWidth,
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
      // 5 days in between each time label
      intervals: {
        normalMarkerInterval: 5 * 24 * 60,
        minimumMarkerInterval: 6138,
        referenceMarkerInterval: 6417,
      },
      dateTimeProps: {dateOnly: true},
      timelineWidth,
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
      intervals: {
        normalMarkerInterval: 120,
        minimumMarkerInterval: 115.5,
        referenceMarkerInterval: 120.75,
      },
      dateTimeProps: {timeOnly: false},
      timelineWidth,
    });
  });
});
