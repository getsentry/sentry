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

  it.each([
    {segmentBy: [], hatched: [false, false, false], faded: [false, false, false]},
    {
      segmentBy: ['completeness'],
      hatched: [false, false, false],
      faded: [false, false, true],
    },
    {
      segmentBy: ['confidence'],
      hatched: [false, true, false],
      faded: [false, false, false],
    },
    {
      segmentBy: ['completeness', 'confidence'],
      hatched: [false, true, false],
      faded: [false, false, true],
    },
  ] as const)('segments by $segmentBy', ({segmentBy, hatched, faded}) => {
    const [series] = new Bars(timeSeries, {segmentBy}).toSeries(plottingOptions);
    const getColor = series!.itemStyle!.color as (params: {dataIndex: number}) => string;

    expect(series!.data!.map(datum => !Array.isArray(datum))).toEqual(hatched);
    expect(
      timeSeries.values.map(
        (_, dataIndex) => getColor({dataIndex}) !== plottingOptions.color
      )
    ).toEqual(faded);
  });
});
