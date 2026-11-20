import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {defined} from 'sentry/utils/defined';

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
    const [series] = new Bars(timeSeries).toSeries({...plottingOptions, segmentBy});
    const getColor = series!.itemStyle!.color as (params: {dataIndex: number}) => string;

    expect(
      series!.data!.map(datum =>
        defined((datum as {itemStyle?: {decal?: unknown}}).itemStyle?.decal)
      )
    ).toEqual(hatched);
    expect(
      timeSeries.values.map(
        (_, dataIndex) => getColor({dataIndex}) !== plottingOptions.color
      )
    ).toEqual(faded);
  });

  it('hatches extrapolated bars with null confidence', () => {
    const nullConfidenceTimeSeries = TimeSeriesFixture({
      values: [
        {timestamp: 1729796400000, value: 10, sampleRate: 1, confidence: null},
        {timestamp: 1729798200000, value: 20, sampleRate: 0.01, confidence: null},
      ],
    });

    const [series] = new Bars(nullConfidenceTimeSeries).toSeries({
      ...plottingOptions,
      segmentBy: ['confidence'],
    });

    expect(
      series!.data!.map(datum => {
        const dataPoint = datum as {
          confidence?: string | null;
          itemStyle?: {decal?: unknown};
        };
        return [dataPoint.confidence, defined(dataPoint.itemStyle?.decal)];
      })
    ).toEqual([
      [null, false],
      ['low', true],
    ]);
  });
});
