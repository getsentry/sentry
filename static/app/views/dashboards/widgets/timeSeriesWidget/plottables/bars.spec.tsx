// eslint-disable-next-line no-restricted-imports
import color from 'color';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {Bars} from './bars';

describe('Bars', () => {
  const timeSeries = TimeSeriesFixture({
    values: [
      {timestamp: 1729796400000, value: 10},
      {timestamp: 1729798200000, value: 20, confidence: 'low'},
      {timestamp: 1729800000000, value: 30, incomplete: true},
    ],
  });

  const plottingOptions = {
    color: '#7553FF',
    unit: timeSeries.meta.valueUnit,
    yAxisPosition: 'left' as const,
  };

  it('dims incomplete bars', () => {
    const [series] = new Bars(timeSeries).toSeries(plottingOptions);
    const getColor = series!.itemStyle!.color as (params: {dataIndex: number}) => string;

    expect(
      timeSeries.values.map((_, dataIndex) => color(getColor({dataIndex})).alpha())
    ).toEqual([1, 1, 0.5]);
  });
});
