import {RateUnit} from '../discover/fields';

import {convertRate} from './convertRate';

describe('convertRate', () => {
  it.each([
    [0, RateUnit.PER_MINUTE, RateUnit.PER_MINUTE, 0],
    [17, RateUnit.PER_MINUTE, RateUnit.PER_SECOND, 0.28333333],
    [17, RateUnit.PER_MINUTE, RateUnit.PER_HOUR, 1020],
    [0.2, RateUnit.PER_HOUR, RateUnit.PER_MINUTE, 0.00333333],
    [0.2, RateUnit.PER_HOUR, RateUnit.PER_SECOND, 0.00005555],
    [35, RateUnit.PER_SECOND, RateUnit.PER_MINUTE, 2100],
  ])('Converts %s %s to %s', (value, fromUnit, toUnit, result) => {
    expect(convertRate(value, fromUnit, toUnit)).toBeCloseTo(result, 5);
  });
});
