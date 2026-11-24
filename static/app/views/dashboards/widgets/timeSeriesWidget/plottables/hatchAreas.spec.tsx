import type {CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams} from 'echarts';

import {HatchAreas} from './hatchAreas';

describe('HatchAreas', () => {
  const config = {name: 'areas', color: '#f0f0f2', dataType: 'number' as const};

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

  it('draws a hatched area across the full plot height behind the data', () => {
    const [series] = new HatchAreas([{start: 1_000, end: 3_000}], config).toSeries();

    expect(series).toEqual(
      expect.objectContaining({
        data: [[1_000, 3_000]],
        encode: {x: [0, 1]},
        silent: true,
        tooltip: {show: false},
        z: 1,
      })
    );

    const values = [1_000, 3_000];
    const element = series!.renderItem!(
      {
        dataIndex: 0,
        coordSys: {type: 'cartesian2d', x: 0, y: 10, width: 500, height: 200},
      } as unknown as CustomSeriesRenderItemParams,
      {
        value: (dimension: number) => values[dimension],
        coord: ([time]: number[]) => [(time ?? 0) / 10, 0],
      } as unknown as CustomSeriesRenderItemAPI
    );

    expect(element).toEqual(
      expect.objectContaining({
        type: 'rect',
        shape: {x: 100, y: 10, width: 200, height: 200},
        style: expect.objectContaining({
          decal: expect.objectContaining({color: '#f0f0f2'}),
        }),
      })
    );
  });
});
