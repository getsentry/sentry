import {formatChartValue} from './formatChartValue';

describe('formatChartValue', () => {
  describe('integer', () => {
    it.each([
      [0, '0'],
      [17, '17'],
      [1772313, '1,772,313'],
    ])('Formats %s as %s', (value, formattedValue) => {
      expect(formatChartValue(value, 'integer')).toEqual(formattedValue);
    });
  });

  describe('number', () => {
    it.each([
      [0, '0'],
      [17.1238, '17.124'],
      [1772313.1, '1,772,313.1'],
    ])('Formats %s as %s', (value, formattedValue) => {
      expect(formatChartValue(value, 'number')).toEqual(formattedValue);
    });
  });

  describe('percentage', () => {
    it.each([
      [0, '0%'],
      [0.712, '71.2%'],
      [17.123, '1,712.3%'],
      [1, '100%'],
    ])('Formats %s as %s', (value, formattedValue) => {
      expect(formatChartValue(value, 'percentage')).toEqual(formattedValue);
    });
  });

  describe('duration', () => {
    it.each([
      [0, 'millisecond', '0.00ms'],
      [0.712, 'second', '712.00ms'],
      [1231, 'second', '20.52min'],
    ])('Formats %s as %s', (value, unit, formattedValue) => {
      expect(formatChartValue(value, 'duration', unit)).toEqual(formattedValue);
    });
  });

  describe('size', () => {
    it.each([
      [0, 'byte', '0.0 B'],
      [0.712, 'megabyte', '712 KB'],
      [1231, 'kibibyte', '1.2 MiB'],
    ])('Formats %s as %s', (value, unit, formattedValue) => {
      expect(formatChartValue(value, 'size', unit)).toEqual(formattedValue);
    });
  });

  describe('rate', () => {
    it.each([
      [0, '1/second', '0/s'],
      [0.712, '1/second', '0.712/s'],
      [12712, '1/second', '12.7K/s'],
      [1231, '1/minute', '1.23K/min'],
    ])('Formats %s as %s', (value, unit, formattedValue) => {
      expect(formatChartValue(value, 'rate', unit)).toEqual(formattedValue);
    });
  });
});
