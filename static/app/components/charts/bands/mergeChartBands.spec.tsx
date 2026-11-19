import type {ECharts} from 'echarts';

import type {EChartClickHandler} from 'sentry/types/echarts';

import {BAND_Y_AXIS, BAND_Z} from './bandShapes';
import {mergeChartBands, type ChartBand} from './mergeChartBands';

type ClickEvent = Parameters<EChartClickHandler>[0];

const instance = {} as ECharts;

function band(id: string, height: number, onClick?: (start: number) => void): ChartBand {
  return {
    id,
    buckets: [
      {start: 0, end: 60_000},
      {start: 60_000, end: 120_000},
    ],
    height,
    onClick,
    series: offset => ({type: 'custom', name: `${id} at ${offset}`}),
  };
}

describe('mergeChartBands', () => {
  it('returns the options unchanged without bands', () => {
    const options = {grid: {bottom: 12}, yAxes: [{type: 'value' as const}]};

    expect(mergeChartBands(options, [])).toBe(options);
    expect(mergeChartBands(options, [null])).toBe(options);
  });

  it('appends each band series on its own y-axis', () => {
    const series = [{type: 'line' as const, name: 'count()'}];
    const yAxes = [{type: 'value' as const}, {type: 'value' as const}];

    const merged = mergeChartBands({grid: {bottom: 12}, series, yAxes}, [
      band('first', 12),
      null,
      band('second', 8),
    ]);

    expect(merged.yAxes).toEqual([...yAxes, BAND_Y_AXIS, BAND_Y_AXIS]);
    expect(merged.series).toEqual([
      ...series,
      expect.objectContaining({id: 'first', yAxisIndex: 2, z: BAND_Z}),
      expect.objectContaining({id: 'second', yAxisIndex: 3, z: BAND_Z}),
    ]);
  });

  it('stacks each band below the offset and the bands before it', () => {
    const merged = mergeChartBands(
      {grid: {bottom: 0}, yAxes: []},
      [band('first', 12), band('second', 8)],
      {offset: 18}
    );

    expect(merged.series).toEqual([
      expect.objectContaining({name: 'first at 18'}),
      expect.objectContaining({name: 'second at 30'}),
    ]);
  });

  it('adds the stack height to the grid bottom and x-axis offset', () => {
    const merged = mergeChartBands(
      {
        grid: {left: 2, bottom: 20},
        xAxis: {type: 'value', offset: 18, axisLine: {onZero: true, show: true}},
        yAxes: [],
      },
      [band('first', 12), band('second', 8)],
      {offset: 18}
    );

    expect(merged.grid).toEqual({left: 2, bottom: 40});
    expect(merged.xAxis).toEqual({
      type: 'value',
      offset: 38,
      axisLine: {onZero: false, show: true},
    });
  });

  it('moves the x-axis below the bands without a base x-axis', () => {
    const merged = mergeChartBands({grid: {bottom: 0}, yAxes: []}, [band('first', 12)]);

    expect(merged.xAxis).toEqual({offset: 12, axisLine: {onZero: false}});
  });

  it('sends band clicks to their band and other clicks to the chart', () => {
    const onFirstClick = jest.fn();
    const onSecondClick = jest.fn();
    const onClick = jest.fn();
    const merged = mergeChartBands({grid: {bottom: 0}, yAxes: [], onClick}, [
      band('first', 12, onFirstClick),
      band('second', 8, onSecondClick),
    ]);

    merged.onClick?.({seriesId: 'second', dataIndex: 1} as ClickEvent, instance);

    expect(onSecondClick).toHaveBeenCalledWith(60_000);
    expect(onFirstClick).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();

    const seriesClick = {seriesId: 'count()', dataIndex: 0} as ClickEvent;
    merged.onClick?.(seriesClick, instance);

    expect(onClick).toHaveBeenCalledWith(seriesClick, instance);
    expect(onFirstClick).not.toHaveBeenCalled();
    expect(onSecondClick).toHaveBeenCalledTimes(1);
  });

  it('ignores band clicks outside its buckets', () => {
    const onBandClick = jest.fn();
    const onClick = jest.fn();
    const merged = mergeChartBands({grid: {bottom: 0}, yAxes: [], onClick}, [
      band('first', 12, onBandClick),
    ]);

    merged.onClick?.({seriesId: 'first', dataIndex: 5} as ClickEvent, instance);

    expect(onBandClick).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });
});
