import {formatBreakdownLegendValue} from './formatBreakdownLegendValue';

describe('formatBreakdownLegendValue', () => {
  it('returns em dash for null', () => {
    expect(formatBreakdownLegendValue(null, 'number')).toBe('—');
  });

  it.each([
    [0.000033452, '3.35E-5'],
    [0.00003, '3E-5'],
    [0.00000001, '1E-8'],
    [5e-35, '5E-35'],
  ])('formats small number %s as scientific notation %s', (value, expected) => {
    expect(formatBreakdownLegendValue(value, 'number')).toBe(expected);
  });

  it('does not use scientific notation for numbers >= 0.0001', () => {
    expect(formatBreakdownLegendValue(0.001234, 'number')).toBe('0.0012');
    expect(formatBreakdownLegendValue(17.1238, 'number')).toBe('17.1238');
    expect(formatBreakdownLegendValue(170, 'number')).toBe('170');
  });

  it('does not use scientific notation for 0', () => {
    expect(formatBreakdownLegendValue(0, 'number')).toBe('0');
  });

  it('delegates non-number types to formatTooltipValue', () => {
    expect(formatBreakdownLegendValue(1000, 'integer')).toBe('1,000');
  });
});
