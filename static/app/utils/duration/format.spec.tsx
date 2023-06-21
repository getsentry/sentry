import format from 'sentry/utils/duration/format';

describe('format', () => {
  describe('parsing', () => {
    it.each([
      {value: 60000, unit: 'ms' as const},
      {value: 60, unit: 'sec' as const},
    ])('should convert "$value $unit" and return the count of ms', ({value, unit}) => {
      expect(format({style: 'count', precision: 'ms', timespan: [value, unit]})).toBe(
        '60000'
      );
    });
  });

  describe('formatting', () => {
    it.each([
      {value: 500.012, unit: 'sec', style: 'h:mm:ss', expected: '8:20'},
      {value: 500.012, unit: 'sec', style: 'hh:mm:ss', expected: '08:20'},
      {value: 500.012, unit: 'sec', style: 'h:mm:ss.sss', expected: '8:20.012'},
      {value: 500.012, unit: 'sec', style: 'hh:mm:ss.sss', expected: '08:20.012'},
    ])('should format according to the selected style', () => {});

    it('should format the value into a locale specific number', () => {
      expect(
        format({
          style: 'count-locale',
          precision: 'ms',
          timespan: [60, 'sec'],
        })
      ).toBe('60,000');
    });

    it('should format sec into hours, minutes, and seconds', () => {
      expect(
        format({
          style: 'h:mm:ss',
          precision: 'sec',
          timespan: [500, 'sec'],
        })
      ).toBe('8:20');
    });

    it('should truncate ms when formatting as hours & minutes', () => {
      expect(
        format({
          style: 'h:mm:ss',
          precision: 'sec',
          timespan: [500012, 'ms'],
        })
      ).toBe('8:20');
    });

    it('should add ms when format demands it', () => {
      expect(
        format({
          style: 'h:mm:ss.sss',
          precision: 'sec',
          timespan: [500, 'sec'],
        })
      ).toBe('8:20.000');
    });

    it('should include ms when precision includes it', () => {
      expect(
        format({
          style: 'h:mm:ss.sss',
          precision: 'sec',
          timespan: [500012, 'ms'],
        })
      ).toBe('8:20.012');
    });
  });
});
