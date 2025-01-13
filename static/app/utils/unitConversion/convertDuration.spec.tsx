import {DurationUnit} from '../discover/fields';

import {convertDuration} from './convertDuration';

describe('convertDuration', () => {
  it.each([
    [0, DurationUnit.MILLISECOND, DurationUnit.MILLISECOND, 0],
    [1700, DurationUnit.MILLISECOND, DurationUnit.SECOND, 1.7],
    [12, DurationUnit.MINUTE, DurationUnit.SECOND, 720],
    [720, DurationUnit.SECOND, DurationUnit.MINUTE, 12],
    [72, DurationUnit.MINUTE, DurationUnit.HOUR, 1.2],
  ])('Converts %s %s to %s', (value, fromUnit, toUnit, result) => {
    expect(convertDuration(value, fromUnit, toUnit)).toEqual(result);
  });
});
