import moment from 'moment';

import {zeroFillSeries} from './zeroFillSeries';

describe('zeroFillSeries', () => {
  test('Fills all missing entries with a zero object', () => {
    const series = {
      seriesName: 'p50',
      data: [
        {
          name: '2023-03-21T00:00:00',
          value: 5,
        },
        {
          name: '2023-03-24T00:00:00',
          value: 4,
        },
        {
          name: '2023-03-25T00:00:00',
          value: 6,
        },
      ],
    };

    const newSeries = zeroFillSeries(series, moment.duration(1, 'day'));

    expect(newSeries.data).toEqual([
      {
        name: '2023-03-21T00:00:00',
        value: 5,
      },
      {
        name: '2023-03-22T00:00:00',
        value: 0,
      },
      {
        name: '2023-03-23T00:00:00',
        value: 0,
      },
      {
        name: '2023-03-24T00:00:00',
        value: 4,
      },
      {
        name: '2023-03-25T00:00:00',
        value: 6,
      },
    ]);
  });
});
