import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {Bars} from './bars';

describe('Bars', () => {
  const timeSeries = TimeSeriesFixture({
    values: [
      {timestamp: 1729796400000, value: 10},
      {timestamp: 1729798200000, value: 20, confidence: 'low'},
    ],
  });

  const plottingOptions = {
    color: '#7553FF',
    unit: timeSeries.meta.valueUnit,
    yAxisPosition: 'left' as const,
  };

  it('does not decorate low confidence bars when not enabled', () => {
    const [series] = new Bars(timeSeries).toSeries(plottingOptions);

    expect(series!.data).toEqual([
      [1729796400000, 10],
      [1729798200000, 20],
    ]);
  });

  it('hatches low confidence bars when enabled', () => {
    const [series] = new Bars(timeSeries).toSeries({
      ...plottingOptions,
      showLowConfidence: true,
    });

    expect(series!.data).toEqual([
      [1729796400000, 10],
      {
        value: [1729798200000, 20],
        itemStyle: {decal: expect.objectContaining({symbol: 'rect'})},
      },
    ]);
  });
});
