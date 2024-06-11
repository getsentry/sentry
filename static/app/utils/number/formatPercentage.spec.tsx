import {formatPercentage} from 'sentry/utils/number/formatPercentage';

describe('formatPercentage()', function () {
  it('should format decimals', function () {
    expect(formatPercentage(0.0, 0)).toBe('0%');
    expect(formatPercentage(0.0, 2)).toBe('0%');
    expect(formatPercentage(0.10513434, 1)).toBe('10.5%');
    expect(formatPercentage(0.10513494, 3)).toBe('10.513%');
    expect(formatPercentage(0.10513494, 4)).toBe('10.5135%');
  });

  it('obeys a minimum value option', () => {
    expect(formatPercentage(0.0101, 0, {minimumValue: 0.01})).toBe('1%');
    expect(formatPercentage(0.01, 0, {minimumValue: 0.001})).toBe('1%');
    expect(formatPercentage(0.0001, 0, {minimumValue: 0.001})).toBe('<0.1%');
    expect(formatPercentage(-0.0001, 0, {minimumValue: 0.001})).toBe('<0.1%');
    expect(formatPercentage(0.00000234, 0, {minimumValue: 0.0001})).toBe('<0.01%');
  });
});
