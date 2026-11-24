import type {CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams} from 'echarts';

import {HatchAreas} from './hatchAreas';

describe('HatchAreas', () => {
  const config = {
    name: 'areas',
    color: '#f0f0f2',
    dataType: 'number' as const,
    fadeColor: '#ffffff',
  };

  it('clips areas to the bounds it is plotted with', () => {
    const areas = new HatchAreas(
      [
        {start: -10, end: 10},
        {start: 40, end: 120},
        {start: 150, end: 160},
      ],
      config
    );

    const [series] = areas.toSeries({bounds: {start: 0, end: 100}});

    expect(series?.data).toEqual([
      [0, 10],
      [40, 100],
    ]);
  });

  it('is empty without ranges', () => {
    expect(new HatchAreas([], config).isEmpty).toBe(true);
  });

  it('draws stripes behind the data, and a wash with stripes over it', () => {
    const series = new HatchAreas([{start: 1_000, end: 3_000}], config).toSeries();

    expect(series.map(({z}) => z)).toEqual([1, 4]);
    for (const item of series) {
      expect(item).toEqual(
        expect.objectContaining({
          data: [[1_000, 3_000]],
          encode: {x: [0, 1]},
          silent: true,
          tooltip: {show: false},
        })
      );
    }

    const values = [1_000, 3_000];
    const [background, foreground] = series.map(item =>
      item.renderItem!(
        {
          dataIndex: 0,
          coordSys: {type: 'cartesian2d', x: 0, y: 10, width: 500, height: 200},
        } as unknown as CustomSeriesRenderItemParams,
        {
          value: (dimension: number) => values[dimension],
          coord: ([time]: number[]) => [(time ?? 0) / 10, 0],
        } as unknown as CustomSeriesRenderItemAPI
      )
    );

    expect(background).toEqual(
      expect.objectContaining({
        type: 'rect',
        shape: {x: 100, y: 10, width: 200, height: 200},
        style: expect.objectContaining({
          decal: expect.objectContaining({color: '#f0f0f2', dashArrayY: [2, 2]}),
        }),
      })
    );
    expect(foreground).toEqual({
      type: 'group',
      children: [
        expect.objectContaining({
          type: 'rect',
          shape: {x: 100, y: 10, width: 200, height: 200},
          style: {fill: '#ffffff', opacity: 0.5},
        }),
        expect.objectContaining({
          style: expect.objectContaining({
            opacity: 0.4,
            decal: expect.objectContaining({color: '#ffffff', dashArrayY: [0, 2, 2, 0]}),
          }),
        }),
      ],
    });
  });
});
