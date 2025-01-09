import type {Series} from 'sentry/types/echarts';
import {getAxisMaxForPercentageSeries} from 'sentry/views/insights/common/utils/getAxisMaxForPercentageSeries';

describe('getAxisMaxForPercentageSeries', function () {
  it('Returns nearest significant digit for small series', function () {
    expect(getAxisMaxForPercentageSeries([HTTP_5XX_SERIES])).toBeCloseTo(0.0001);
  });

  it('Returns 1 for larger series', function () {
    expect(getAxisMaxForPercentageSeries([HTTP_2XX_SERIES])).toBeCloseTo(1);
  });

  it('Takes all series into account', function () {
    expect(getAxisMaxForPercentageSeries([HTTP_2XX_SERIES, HTTP_5XX_SERIES])).toBeCloseTo(
      1
    );
  });
});

const HTTP_2XX_SERIES: Series = {
  seriesName: '5XX',
  data: [
    {
      value: 0.9812,
      name: '2024-03-12T13:30:00-04:00',
    },
    {
      value: 0.9992,
      name: '2024-03-12T14:00:00-04:00',
    },
  ],
};

const HTTP_5XX_SERIES: Series = {
  seriesName: '5XX',
  data: [
    {
      value: 0.00006713689346852019,
      name: '2024-03-12T13:30:00-04:00',
    },
    {
      value: 0.000041208717375685543,
      name: '2024-03-12T14:00:00-04:00',
    },
  ],
};
