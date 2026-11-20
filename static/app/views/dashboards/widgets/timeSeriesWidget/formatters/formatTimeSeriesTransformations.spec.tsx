import {formatTimeSeriesTransformations} from './formatTimeSeriesTransformations';

describe('formatTimeSeriesTransformations', () => {
  it.each([
    {transformations: undefined, expected: ''},
    {transformations: [], expected: ''},
    {transformations: ['fill(zero)'], expected: 'fill(zero)'},
    {transformations: ['fill(locf)'], expected: 'fill(locf)'},
    {transformations: ['fill(linear)'], expected: 'fill(linear)'},
    {transformations: ['smooth(sma,5)'], expected: 'smooth(sma,5)'},
    {transformations: ['smooth(ema,10)'], expected: 'smooth(ema,10)'},
    {transformations: ['smooth(ema,10,0.25)'], expected: 'smooth(ema,10,0.25)'},
    {transformations: ['smooth(asap)'], expected: 'smooth(asap)'},
    {transformations: ['smooth(asap,5)'], expected: 'smooth(asap,5)'},
    {
      transformations: ['fill(linear)', 'smooth(sma,5)'],
      expected: 'fill(linear) → smooth(sma,5)',
    },
    {
      transformations: ['smooth(sma,5)', 'fill(linear)'],
      expected: 'smooth(sma,5) → fill(linear)',
    },
    {
      transformations: ['smooth(future,5)', 'unsupported'],
      expected: 'smooth(future,5) → unsupported',
    },
  ])('formats $transformations as $expected', ({transformations, expected}) => {
    expect(formatTimeSeriesTransformations(transformations)).toBe(expected);
  });
});
