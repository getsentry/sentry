import {FractionUnit} from 'sentry/utils/discover/fields';

import {convertFraction} from './convertFraction';

describe('convertFraction', () => {
  it.each([
    [0, FractionUnit.RATIO, FractionUnit.RATIO, 0],
    [0.75, FractionUnit.RATIO, FractionUnit.PERCENT, 75],
    [1, FractionUnit.RATIO, FractionUnit.PERCENT, 100],
    [75, FractionUnit.PERCENT, FractionUnit.RATIO, 0.75],
    [12.5, FractionUnit.PERCENT, FractionUnit.PERCENT, 12.5],
  ])('Converts %s %s to %s', (value, fromUnit, toUnit, result) => {
    expect(convertFraction(value, fromUnit, toUnit)).toBeCloseTo(result, 5);
  });
});
