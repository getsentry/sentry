import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {alignTimeSeries} from './alignTimeSeries';

describe('alignTimeSeries', () => {
  it('fills buckets missing from either series with null', () => {
    const first = TimeSeriesFixture({
      values: [
        {timestamp: 1000, value: 1},
        {timestamp: 2000, value: 2},
      ],
    });
    const second = TimeSeriesFixture({
      values: [
        {timestamp: 2000, value: 5},
        {timestamp: 3000, value: 6, incomplete: true},
      ],
    });

    expect(alignTimeSeries([first, second])).toEqual([
      {
        ...first,
        values: [
          {timestamp: 1000, value: 1},
          {timestamp: 2000, value: 2},
          {timestamp: 3000, value: null},
        ],
      },
      {
        ...second,
        values: [
          {timestamp: 1000, value: null},
          {timestamp: 2000, value: 5},
          {timestamp: 3000, value: 6, incomplete: true},
        ],
      },
    ]);
  });

  it('keeps series that share buckets unchanged', () => {
    const first = TimeSeriesFixture();
    const second = TimeSeriesFixture();

    expect(alignTimeSeries([first, second])).toEqual([first, second]);
  });

  it('passes missing series through', () => {
    const series = TimeSeriesFixture();

    expect(alignTimeSeries([series, undefined])).toEqual([series, undefined]);
  });
});
