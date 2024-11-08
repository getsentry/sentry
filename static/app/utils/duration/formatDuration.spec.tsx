import formatDuration from 'sentry/utils/duration/formatDuration';
import type {Duration, Unit} from 'sentry/utils/duration/types';

describe('formatDuration', () => {
  describe('parsing', () => {
    it.each([
      {value: 60000, unit: 'ms' as const},
      {value: 60, unit: 'sec' as const},
      {value: 1, unit: 'min' as const},
    ])('should convert "$value $unit" and return the count of ms', ({value, unit}) => {
      expect(
        formatDuration({style: 'count', precision: 'ms', duration: [value, unit]})
      ).toBe('60000');
    });

    it.each([
      {value: 168, unit: 'hour' as const},
      {value: 7, unit: 'day' as const},
      {value: 1, unit: 'week' as const},
    ])('should convert "$value $unit" and return the count of ms', ({value, unit}) => {
      expect(
        formatDuration({style: 'count', precision: 'ms', duration: [value, unit]})
      ).toBe('604800000');
    });
  });

  describe('formatting', () => {
    it('should format the value into a locale specific number', () => {
      expect(
        formatDuration({
          style: 'count-locale',
          precision: 'ms',
          duration: [60, 'sec'],
        })
      ).toBe('60,000');
    });

    it('should format the value into a count, like statsPeriod', () => {
      expect(
        formatDuration({
          style: 'count',
          precision: 'ms',
          duration: [60, 'sec'],
        })
      ).toBe('60000');

      expect(
        formatDuration({
          style: 'count',
          precision: 'hour',
          duration: [45, 'min'],
        })
      ).toBe('0.75');
    });

    it('should format sec into hours, minutes, and seconds', () => {
      expect(
        formatDuration({
          style: 'h:mm:ss',
          precision: 'sec',
          duration: [500, 'sec'],
        })
      ).toBe('8:20');
    });

    it.each<{duration: Duration; expected: string; precision: Unit}>([
      {duration: [500_000, 'ms'], precision: 'ms', expected: '8:20.000'},
      {duration: [500_000, 'ms'], precision: 'sec', expected: '8:20.000'},
      {duration: [500_012, 'ms'], precision: 'ms', expected: '8:20.012'},
      {duration: [500_012, 'ms'], precision: 'sec', expected: '8:20.000'},
      {duration: [500, 'sec'], precision: 'ms', expected: '8:20.000'},
      {duration: [500, 'sec'], precision: 'sec', expected: '8:20.000'},
      {duration: [500, 'sec'], precision: 'ms', expected: '8:20.000'},
      {duration: [500, 'sec'], precision: 'sec', expected: '8:20.000'},
      {duration: [500.012, 'sec'], precision: 'ms', expected: '8:20.012'},
      {duration: [500.012, 'sec'], precision: 'sec', expected: '8:20.000'},
      {duration: [500.012, 'sec'], precision: 'ms', expected: '8:20.012'},
      {duration: [500.012, 'sec'], precision: 'sec', expected: '8:20.000'},
    ])(
      'should format $duration with precision $precision as h:mm:ss.sss',
      ({duration, precision, expected}) => {
        expect(
          formatDuration({
            style: 'h:mm:ss.sss',
            precision,
            duration,
          })
        ).toBe(expected);
      }
    );

    it.each<{duration: Duration; precision: Unit}>([
      {duration: [500_000, 'ms'], precision: 'ms'},
      {duration: [500_000, 'ms'], precision: 'sec'},
      {duration: [500_012, 'ms'], precision: 'ms'},
      {duration: [500_012, 'ms'], precision: 'sec'},
      {duration: [500, 'sec'], precision: 'ms'},
      {duration: [500, 'sec'], precision: 'sec'},
      {duration: [500, 'sec'], precision: 'ms'},
      {duration: [500, 'sec'], precision: 'sec'},
      {duration: [500.012, 'sec'], precision: 'ms'},
      {duration: [500.012, 'sec'], precision: 'sec'},
      {duration: [500.012, 'sec'], precision: 'ms'},
      {duration: [500.012, 'sec'], precision: 'sec'},
    ])(
      'should format $duration with precision $precision as h:mm:ss, never showing ms',
      ({duration, precision}) => {
        expect(
          formatDuration({
            style: 'h:mm:ss',
            precision,
            duration,
          })
        ).toBe('8:20');
      }
    );

    it('should format the value into an ISO8601 period with ms precision', () => {
      expect(
        formatDuration({
          style: 'ISO8601',
          precision: 'ms',
          duration: [500_012, 'ms'],
        })
      ).toBe('PT8M20.012S');
    });

    it('should format the value into an ISO8601 period with ms precision, but no sec or ms digits', () => {
      expect(
        formatDuration({
          style: 'ISO8601',
          precision: 'ms',
          duration: [480_000, 'ms'],
        })
      ).toBe('PT8M');
    });

    it('should format the value into an ISO8601 period with precision to the second', () => {
      expect(
        formatDuration({
          style: 'ISO8601',
          precision: 'sec',
          duration: [500_012, 'ms'],
        })
      ).toBe('PT8M20S');
    });

    it('should format the value into an ISO8601 period with precision to the minute', () => {
      expect(
        formatDuration({
          style: 'ISO8601',
          precision: 'min',
          duration: [500_012, 'ms'],
        })
      ).toBe('PT8M');
    });
  });
});
