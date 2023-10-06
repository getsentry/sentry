import formatDuration from 'sentry/utils/duration/formatDuration';

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
    it.each([
      {style: 'h:mm:ss' as const, expected: '8:20'},
      {style: 'hh:mm:ss' as const, expected: '08:20'},
      {style: 'h:mm:ss.sss' as const, expected: '8:20.012'},
      {style: 'hh:mm:ss.sss' as const, expected: '08:20.012'},
    ])('should format according to the selected style', ({style, expected}) => {
      expect(
        formatDuration({
          style,
          precision: 'sec',
          duration: [500.012, 'sec'],
        })
      ).toBe(expected);
    });

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

    it('should truncate ms when formatting as hours & minutes', () => {
      expect(
        formatDuration({
          style: 'h:mm:ss',
          precision: 'sec',
          duration: [500012, 'ms'],
        })
      ).toBe('8:20');
    });

    it('should add ms when format demands it', () => {
      expect(
        formatDuration({
          style: 'h:mm:ss.sss',
          precision: 'sec',
          duration: [500, 'sec'],
        })
      ).toBe('8:20.000');
    });

    it('should include ms when precision includes it', () => {
      expect(
        formatDuration({
          style: 'h:mm:ss.sss',
          precision: 'sec',
          duration: [500012, 'ms'],
        })
      ).toBe('8:20.012');
    });
  });
});
