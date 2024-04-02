import {getFormat} from 'sentry/utils/dates';
import {getConfigFromTimeRange} from 'sentry/views/monitors/components/overviewTimeline/utils';

describe('Crons Timeline Utils', function () {
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
        markerInterval: 1,
        minimumMarkerInterval: 0.625,
        dateTimeProps: {timeOnly: true},
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
        markerInterval: 240,
        minimumMarkerInterval: 198.6875,
        dateTimeProps: {timeOnly: false},
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
        markerInterval: 120,
        minimumMarkerInterval: 112.5,
        dateTimeProps: {timeOnly: true},
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
        markerInterval: 5 * 24 * 60,
        minimumMarkerInterval: 6138,
        dateTimeProps: {dateOnly: true},
      });
    });
  });
});
