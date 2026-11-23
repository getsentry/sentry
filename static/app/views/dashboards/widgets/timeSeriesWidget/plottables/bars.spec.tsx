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

  it.each([
    {segmentBy: [], opacities: [1, 1, 1]},
    {segmentBy: ['completeness'], opacities: [1, 1, 0.5]},
    {segmentBy: ['confidence'], opacities: [1, 0.45, 1]},
    {segmentBy: ['completeness', 'confidence'], opacities: [1, 0.45, 0.5]},
  ] as const)('segments by $segmentBy', ({segmentBy, opacities}) => {
    const [series] = new Bars(timeSeries).toSeries({...plottingOptions, segmentBy});
    const getColor = series!.itemStyle!.color as (params: {dataIndex: number}) => string;

    expect(
      timeSeries.values.map((_, dataIndex) => color(getColor({dataIndex})).alpha())
    ).toEqual(opacities);
  });
});
