import {formatTimeSeriesTransformations} from './formatTimeSeriesTransformations';

describe('formatTimeSeriesTransformations', () => {
  it.each([
    {transformations: undefined, expected: ''},
    {transformations: [], expected: ''},
    {transformations: ['fill(zero)'], expected: 'fill(zero)'},
    {transformations: ['fill(locf)'], expected: 'fill(locf)'},
    {transformations: ['fill(linear)'], expected: 'fill(linear)'},
    {transformations: ['smooth(sma,5)'], expected: 'SMA(5)'},
    {transformations: ['smooth(ema,10)'], expected: 'EMA(10)'},
    {transformations: ['smooth(ema,10,0.25)'], expected: 'EMA(10,0.25)'},
    {transformations: ['smooth(asap)'], expected: 'ASAP'},
    {transformations: ['smooth(asap,5)'], expected: 'ASAP(5)'},
    {
      transformations: ['fill(linear)', 'smooth(sma,5)'],
      expected: 'fill(linear) → SMA(5)',
    },
    {
      transformations: ['smooth(sma,5)', 'fill(linear)'],
      expected: 'SMA(5) → fill(linear)',
    },
    {
      transformations: ['smooth(future,5)', 'unsupported'],
      expected: 'smooth(future,5) → unsupported',
    },
  ])('formats $transformations as $expected', ({transformations, expected}) => {
    expect(formatTimeSeriesTransformations(transformations)).toBe(expected);
  });
});
