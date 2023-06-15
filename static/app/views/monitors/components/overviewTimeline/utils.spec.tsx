import {getStartFromTimeWindow} from 'sentry/views/monitors/components/overviewTimeline/utils';

describe('Crons Timeline Utils', function () {
  const end = new Date('2023-06-15T12:00:00Z');

  describe('getStartFromTimeWindow', function () {
    it('correctly computes for 1h', function () {
      const expectedStart = new Date('2023-06-15T11:00:00Z');
      const start = getStartFromTimeWindow(end, '1h');

      expect(start).toEqual(expectedStart);
    });

    it('correctly computes for 24h', function () {
      const expectedStart = new Date('2023-06-14T12:00:00Z');
      const start = getStartFromTimeWindow(end, '24h');

      expect(start).toEqual(expectedStart);
    });

    it('correctly computes for 7d', function () {
      const expectedStart = new Date('2023-06-08T12:00:00Z');
      const start = getStartFromTimeWindow(end, '7d');

      expect(start).toEqual(expectedStart);
    });

    it('correctly computes for 30d', function () {
      const expectedStart = new Date('2023-05-16T12:00:00Z');
      const start = getStartFromTimeWindow(end, '30d');

      expect(start).toEqual(expectedStart);
    });
  });
});
