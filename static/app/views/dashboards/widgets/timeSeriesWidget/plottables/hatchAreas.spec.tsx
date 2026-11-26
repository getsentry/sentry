import type {CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams} from 'echarts';

import {BAND_Z, HATCH_Z2} from 'sentry/components/charts/bands/bandShapes';

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

  it('draws a wash with stripes over the data', () => {
    const [series] = new HatchAreas([{start: 1_000, end: 3_000}], config).toSeries();

    expect(series).toEqual(
      expect.objectContaining({
        data: [[1_000, 3_000]],
        encode: {x: [0, 1]},
        silent: true,
        tooltip: {show: false},
        z: BAND_Z - 1,
      })
    );

    const values = [1_000, 3_000];
    const item = series!.renderItem!(
      {
        dataIndex: 0,
        coordSys: {type: 'cartesian2d', x: 0, y: 10, width: 500, height: 200},
      } as unknown as CustomSeriesRenderItemParams,
      {
        value: (dimension: number) => values[dimension],
        coord: ([time]: number[]) => [(time ?? 0) / 10, 0],
      } as unknown as CustomSeriesRenderItemAPI
    );

    const shape = {x: 100, y: 10, width: 200, height: 200};
    expect(item).toEqual({
      type: 'group',
      children: [
        expect.objectContaining({
          type: 'rect',
          z2: HATCH_Z2,
          shape,
          style: {fill: '#ffffff', opacity: 0.5},
        }),
        expect.objectContaining({
          type: 'rect',
          z2: HATCH_Z2,
          shape,
          style: expect.objectContaining({
            opacity: 0.6,
            decal: expect.objectContaining({color: '#f0f0f2', dashArrayY: [2, 2]}),
          }),
        }),
      ],
    });
  });
});
