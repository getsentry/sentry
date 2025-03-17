import {SizeUnit} from '../discover/fields';

import {convertSize} from './convertSize';

describe('convertSize', () => {
  it.each([
    [0, SizeUnit.BYTE, SizeUnit.BYTE, 0],
    [1, SizeUnit.BYTE, SizeUnit.BYTE, 1],
    [1, SizeUnit.MEGABYTE, SizeUnit.KILOBYTE, 1000],
    [500, SizeUnit.KILOBYTE, SizeUnit.MEGABYTE, 0.5],
    [1, SizeUnit.MEBIBYTE, SizeUnit.MEGABYTE, 1.048576],
  ])('Converts %s %s to %s', (value, fromUnit, toUnit, result) => {
    expect(convertSize(value, fromUnit, toUnit)).toEqual(result);
  });
});
