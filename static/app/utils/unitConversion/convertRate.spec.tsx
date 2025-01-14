import {RateUnit} from '../discover/fields';

import {convertRate} from './convertRate';

describe('convertRate', () => {
  it.each([
    [0, RateUnit.PER_MINUTE, RateUnit.PER_MINUTE, 0],
    [17, RateUnit.PER_MINUTE, RateUnit.PER_SECOND, 1020],
    [17, RateUnit.PER_MINUTE, RateUnit.PER_HOUR, 0.28333333],
    [0.2, RateUnit.PER_HOUR, RateUnit.PER_MINUTE, 12],
    [0.2, RateUnit.PER_HOUR, RateUnit.PER_SECOND, 720],
  ])('Converts %s %s to %s', (value, fromUnit, toUnit, result) => {
    expect(convertRate(value, fromUnit, toUnit)).toBeCloseTo(result, 5);
  });
});
