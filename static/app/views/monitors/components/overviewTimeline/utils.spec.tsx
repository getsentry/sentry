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
        dateLabelFormat: getFormat({timeOnly: true, seconds: true}),
        elapsedMinutes: 5,
        timeMarkerInterval: 1,
        dateTimeProps: {timeOnly: true},
      });
    });

    it('divides into minutes without showing seconds for medium intervals', function () {
      const start = new Date('2023-06-15T08:00:00Z');
      const end = new Date('2023-06-15T23:00:00Z');
      const config = getConfigFromTimeRange(start, end, timelineWidth);
      expect(config).toEqual({
        dateLabelFormat: getFormat({timeOnly: true}),
        elapsedMinutes: 900,
        timeMarkerInterval: 240,
        dateTimeProps: {timeOnly: true},
      });
    });

    it('divides into days for larger intervals', function () {
      const start = new Date('2023-05-15T11:00:00Z');
      const end = new Date('2023-06-15T11:00:00Z');
      const config = getConfigFromTimeRange(start, end, timelineWidth);
      expect(config).toEqual({
        dateLabelFormat: getFormat(),
        // 31 elapsed days
        elapsedMinutes: 31 * 24 * 60,
        // 4 days in between each time label
        timeMarkerInterval: 4 * 24 * 60,
        dateTimeProps: {dateOnly: true},
      });
    });
  });
});
