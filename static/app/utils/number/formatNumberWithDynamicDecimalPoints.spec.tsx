import {formatNumberWithDynamicDecimalPoints} from 'sentry/utils/number/formatNumberWithDynamicDecimalPoints';

describe('formatNumberWithDynamicDecimals', () => {
  it('rounds to two decimal points without forcing them', () => {
    expect(formatNumberWithDynamicDecimalPoints(1)).toEqual('1');
    expect(formatNumberWithDynamicDecimalPoints(1.0)).toEqual('1');
    expect(formatNumberWithDynamicDecimalPoints(1.5)).toEqual('1.5');
    expect(formatNumberWithDynamicDecimalPoints(1.05)).toEqual('1.05');
    expect(formatNumberWithDynamicDecimalPoints(1.004)).toEqual('1');
    expect(formatNumberWithDynamicDecimalPoints(1.005)).toEqual('1.01');
    expect(formatNumberWithDynamicDecimalPoints(1.1009)).toEqual('1.1');
    expect(formatNumberWithDynamicDecimalPoints(2.236)).toEqual('2.24');
  });

  it('rounds up to the maximum fraction digits passed', () => {
    expect(formatNumberWithDynamicDecimalPoints(1, 2)).toEqual('1');
    expect(formatNumberWithDynamicDecimalPoints(1.0, 2)).toEqual('1');
    expect(formatNumberWithDynamicDecimalPoints(1.2345, 1)).toEqual('1.2');
    expect(formatNumberWithDynamicDecimalPoints(1.2345, 2)).toEqual('1.23');
    expect(formatNumberWithDynamicDecimalPoints(1.2345, 3)).toEqual('1.235');
    expect(formatNumberWithDynamicDecimalPoints(1.2345, 4)).toEqual('1.2345');
    expect(formatNumberWithDynamicDecimalPoints(1.2345, 5)).toEqual('1.2345');
  });

  it('preserves significant decimal places', () => {
    expect(formatNumberWithDynamicDecimalPoints(0.001234)).toEqual('0.0012');
    expect(formatNumberWithDynamicDecimalPoints(0.000125)).toEqual('0.00013');
    expect(formatNumberWithDynamicDecimalPoints(0.0000123)).toEqual('0.000012');
  });

  it('handles zero, NaN and Infinity', () => {
    expect(formatNumberWithDynamicDecimalPoints(0)).toEqual('0');
    expect(formatNumberWithDynamicDecimalPoints(NaN)).toEqual('NaN');
    expect(formatNumberWithDynamicDecimalPoints(Infinity)).toEqual('∞');
    expect(formatNumberWithDynamicDecimalPoints(-Infinity)).toEqual('-∞');
  });

  it('handles negative numbers', () => {
    expect(formatNumberWithDynamicDecimalPoints(-1)).toEqual('-1');
    expect(formatNumberWithDynamicDecimalPoints(-1.0)).toEqual('-1');
    expect(formatNumberWithDynamicDecimalPoints(-1.5)).toEqual('-1.5');
    expect(formatNumberWithDynamicDecimalPoints(-1.05)).toEqual('-1.05');
    expect(formatNumberWithDynamicDecimalPoints(-1.004)).toEqual('-1');
    expect(formatNumberWithDynamicDecimalPoints(-1.005)).toEqual('-1.01');
    expect(formatNumberWithDynamicDecimalPoints(-1.1009)).toEqual('-1.1');
    expect(formatNumberWithDynamicDecimalPoints(-2.236)).toEqual('-2.24');
  });
});
