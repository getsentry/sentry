import {formatTooltipYAxisValue} from './formatTooltipYAxisValue';

describe('formatTooltipYAxisValue', () => {
  it('formats a single value when bucketSize is 0', () => {
    expect(formatTooltipYAxisValue(100, 0, 'number')).toBe('100');
  });

  it('formats a range when bucketSize is non-zero', () => {
    expect(formatTooltipYAxisValue(100, 50, 'number')).toBe('100 – 150');
  });

  it('applies the value type and unit to both bounds (size)', () => {
    expect(formatTooltipYAxisValue(1024, 1024, 'size', 'byte')).toBe('1.02 KB – 2.05 KB');
  });

  it('formats duration ranges with units', () => {
    expect(formatTooltipYAxisValue(500, 500, 'duration', 'millisecond')).toBe(
      '500.00ms – 1.00s'
    );
  });
});
