import {expectTypeOf} from 'expect-type';

import {defined} from '@sentry/scraps/defined';

describe('defined', () => {
  it.each([
    {value: undefined, expected: false},
    {value: null, expected: false},
    {value: false, expected: true},
    {value: 0, expected: true},
    {value: '', expected: true},
    {value: NaN, expected: true},
    {value: 'value', expected: true},
    {value: {}, expected: true},
  ])('returns $expected for $value', ({value, expected}) => {
    expect(defined(value)).toBe(expected);
  });

  it('filters nullish values and narrows the remaining type', () => {
    const values: Array<string | number | false | null | undefined> = [
      '',
      0,
      false,
      null,
      undefined,
    ];
    const result = values.filter(defined);

    expect(result).toEqual(['', 0, false]);
    expectTypeOf(result).toEqualTypeOf<Array<string | number | false>>();
  });
});
