import moment from 'moment-timezone';

import {
  shiftSeriesData,
  shiftTimestampToFakeUtc,
  unshiftTimestampFromFakeUtc,
} from 'sentry/components/charts/timezoneShift';

describe('timezoneShift', () => {
  describe('shiftTimestampToFakeUtc', () => {
    it('shifts UTC timestamp so fake-UTC wall-clock matches target timezone', () => {
      // 2024-01-15 05:00:00 UTC = midnight EST (UTC-5)
      const realUtc = moment.utc('2024-01-15T05:00:00').valueOf();
      const shifted = shiftTimestampToFakeUtc(realUtc, 'America/New_York');

      // Shifted should be 2024-01-15 00:00:00 UTC (subtract 5h)
      const expected = moment.utc('2024-01-15T00:00:00').valueOf();
      expect(shifted).toBe(expected);
    });

    it('shifts for positive UTC offset timezone', () => {
      // 2024-01-15 00:00:00 UTC = 2024-01-15 09:00:00 Asia/Tokyo (UTC+9)
      const realUtc = moment.utc('2024-01-15T00:00:00').valueOf();
      const shifted = shiftTimestampToFakeUtc(realUtc, 'Asia/Tokyo');

      // Should shift forward by 9h to 09:00:00 UTC
      const expected = moment.utc('2024-01-15T09:00:00').valueOf();
      expect(shifted).toBe(expected);
    });

    it('handles DST transitions correctly', () => {
      // During US EDT (UTC-4): 2024-07-15 04:00:00 UTC = midnight EDT
      const summerUtc = moment.utc('2024-07-15T04:00:00').valueOf();
      const summerShifted = shiftTimestampToFakeUtc(summerUtc, 'America/New_York');
      const expectedSummer = moment.utc('2024-07-15T00:00:00').valueOf();
      expect(summerShifted).toBe(expectedSummer);

      // During US EST (UTC-5): 2024-01-15 05:00:00 UTC = midnight EST
      const winterUtc = moment.utc('2024-01-15T05:00:00').valueOf();
      const winterShifted = shiftTimestampToFakeUtc(winterUtc, 'America/New_York');
      const expectedWinter = moment.utc('2024-01-15T00:00:00').valueOf();
      expect(winterShifted).toBe(expectedWinter);
    });

    it('is identity for UTC timezone', () => {
      const timestamp = moment.utc('2024-01-15T12:00:00').valueOf();
      expect(shiftTimestampToFakeUtc(timestamp, 'UTC')).toBe(timestamp);
    });
  });

  describe('unshiftTimestampFromFakeUtc', () => {
    it('recovers real UTC from shifted fake-UTC timestamp', () => {
      // Fake UTC midnight = real 05:00 UTC for EST (UTC-5)
      const fakeUtc = moment.utc('2024-01-15T00:00:00').valueOf();
      const real = unshiftTimestampFromFakeUtc(fakeUtc, 'America/New_York');

      const expected = moment.utc('2024-01-15T05:00:00').valueOf();
      expect(real).toBe(expected);
    });

    it('round-trips with shiftTimestampToFakeUtc', () => {
      const original = moment.utc('2024-06-20T14:30:00').valueOf();
      const shifted = shiftTimestampToFakeUtc(original, 'Europe/Berlin');
      const recovered = unshiftTimestampFromFakeUtc(shifted, 'Europe/Berlin');
      expect(recovered).toBe(original);
    });
  });

  describe('shiftSeriesData', () => {
    it('shifts tuple format [timestamp, value] data', () => {
      const ts1 = moment.utc('2024-01-15T05:00:00').valueOf();
      const ts2 = moment.utc('2024-01-15T06:00:00').valueOf();

      const series = [
        {
          type: 'line' as const,
          data: [
            [ts1, 100],
            [ts2, 200],
          ],
        },
      ];

      const result = shiftSeriesData(series, 'America/New_York');
      const expected1 = moment.utc('2024-01-15T00:00:00').valueOf();
      const expected2 = moment.utc('2024-01-15T01:00:00').valueOf();

      expect((result[0] as any).data[0][0]).toBe(expected1);
      expect((result[0] as any).data[0][1]).toBe(100);
      expect((result[0] as any).data[1][0]).toBe(expected2);
      expect((result[0] as any).data[1][1]).toBe(200);
    });

    it('shifts object format {name, value} data', () => {
      const ts = moment.utc('2024-01-15T05:00:00').valueOf();

      const series = [
        {
          type: 'line' as const,
          data: [{name: ts, value: [ts, 100]}],
        },
      ];

      const result = shiftSeriesData(series, 'America/New_York');
      const expected = moment.utc('2024-01-15T00:00:00').valueOf();

      expect((result[0] as any).data[0].name).toBe(expected);
      expect((result[0] as any).data[0].value[0]).toBe(expected);
      expect((result[0] as any).data[0].value[1]).toBe(100);
    });

    it('passes through series without data', () => {
      const series = [{type: 'line' as const, markLine: {data: []}}];
      const result = shiftSeriesData(series, 'America/New_York');
      expect(result).toEqual(series);
    });
  });
});
