import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {Area} from './area';

describe('Area', () => {
  const timeSeries = TimeSeriesFixture({
    values: [
      {timestamp: 1729796400000, value: 10},
      {timestamp: 1729798200000, value: 20, incomplete: true},
    ],
  });

  it.each(['left', 'right'] as const)(
    'stacks matching segments on the %s axis while keeping complete and incomplete data separate',
    yAxisPosition => {
      const plottingOptions = {
        color: '#7553FF',
        unit: timeSeries.meta.valueUnit,
        yAxisPosition,
      };
      const first = new Area(timeSeries).toSeries(plottingOptions);
      const second = new Area(
        TimeSeriesFixture({...timeSeries, yAxis: 'other()'})
      ).toSeries(plottingOptions);

      expect(first).toHaveLength(2);
      expect(second).toHaveLength(2);
      expect(first[0]!.stack).toBeTruthy();
      expect(first[1]!.stack).toBeTruthy();
      expect(first[0]!.stack).toBe(second[0]!.stack);
      expect(first[1]!.stack).toBe(second[1]!.stack);
      expect(first[0]!.stack).not.toBe(first[1]!.stack);
    }
  );

  it('does not stack complete or incomplete data across Y axes', () => {
    const area = new Area(timeSeries);
    const plottingOptions = {color: '#7553FF', unit: timeSeries.meta.valueUnit};
    const left = area.toSeries({...plottingOptions, yAxisPosition: 'left'});
    const right = area.toSeries({...plottingOptions, yAxisPosition: 'right'});

    expect(left).toHaveLength(2);
    expect(right).toHaveLength(2);
    expect(left.map(series => series.yAxisIndex)).toEqual([0, 0]);
    expect(right.map(series => series.yAxisIndex)).toEqual([1, 1]);
    expect(left[0]!.stack).not.toBe(right[0]!.stack);
    expect(left[1]!.stack).not.toBe(right[1]!.stack);
  });

  it('draws low confidence segments dashed only when enabled', () => {
    const lowConfidenceTimeSeries = TimeSeriesFixture({
      values: [
        {timestamp: 1729796400000, value: 10},
        {timestamp: 1729798200000, value: 20, confidence: 'low'},
      ],
    });
    const plottingOptions = {
      color: '#7553FF',
      unit: lowConfidenceTimeSeries.meta.valueUnit,
      yAxisPosition: 'left' as const,
    };
    const area = new Area(lowConfidenceTimeSeries);

    const disabled = area.toSeries(plottingOptions);
    expect(disabled).toHaveLength(1);
    expect(disabled[0]!.lineStyle?.type).toBeUndefined();

    const enabled = area.toSeries({...plottingOptions, showLowConfidence: true});
    expect(enabled).toHaveLength(2);
    expect(enabled[0]!.lineStyle?.type).toBeUndefined();
    expect(enabled[1]!.lineStyle?.type).toBe('dashed');
  });
});
