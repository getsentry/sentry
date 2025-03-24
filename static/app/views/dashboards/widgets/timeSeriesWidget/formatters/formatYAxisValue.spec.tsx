import {formatYAxisValue} from './formatYAxisValue';

describe('formatYAxisValue', () => {
  describe('integer', () => {
    it.each([
      [0, '0'],
      [17, '17'],
      [171, '171'],
      [17111, '17k'],
      [17_000_110, '17m'],
      [1_000_110_000, '1b'],
    ])('Formats %s as %s', (value, formattedValue) => {
      expect(formatYAxisValue(value, 'integer')).toEqual(formattedValue);
    });
  });

  describe('number', () => {
    it.each([
      [17.1238, '17.124'],
      [1772313.1, '1,772,313.1'],
    ])('Formats %s as %s', (value, formattedValue) => {
      expect(formatYAxisValue(value, 'number')).toEqual(formattedValue);
    });
  });

  describe('percentage', () => {
    it.each([
      [0, '0'],
      [0.00005, '0.005%'],
      [0.712, '71.2%'],
      [17.123, '1,712.3%'],
      [1, '100%'],
    ])('Formats %s as %s', (value, formattedValue) => {
      expect(formatYAxisValue(value, 'percentage')).toEqual(formattedValue);
    });
  });

  describe('duration', () => {
    it.each([
      [0, 'millisecond', '0'],
      [0.712, 'second', '712ms'],
      [1230, 'second', '20.5min'],
    ])('Formats %s as %s', (value, unit, formattedValue) => {
      expect(formatYAxisValue(value, 'duration', unit)).toEqual(formattedValue);
    });
  });

  describe('size', () => {
    it.each([
      [0, 'byte', '0'],
      [0.712, 'megabyte', '712 KB'],
      [1231, 'kibibyte', '1.2 MiB'],
    ])('Formats %s as %s', (value, unit, formattedValue) => {
      expect(formatYAxisValue(value, 'size', unit)).toEqual(formattedValue);
    });
  });

  describe('rate', () => {
    it.each([
      [0, '1/second', '0'],
      [-3, '1/second', '-3/s'],
      [0.712, '1/second', '0.712/s'],
      [12700, '1/second', '12.7K/s'],
      [0.0003, '1/second', '0.0003/s'],
      [0.00000153, '1/second', '0.00000153/s'],
      [0.35, '1/second', '0.35/s'],
      [10, '1/second', '10/s'],
      [10.0, '1/second', '10/s'],
      [1231, '1/minute', '1.231K/min'],
      [110000, '1/second', '110K/s'],
      [110001, '1/second', '110.001K/s'],
      [123456789, '1/second', '123.457M/s'],
    ])('Formats %s as %s', (value, unit, formattedValue) => {
      expect(formatYAxisValue(value, 'rate', unit)).toEqual(formattedValue);
    });
  });
});
