import type {CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams} from 'echarts';

import {FullHeightAreas} from './fullHeightAreas';

describe('FullHeightAreas', () => {
  const config = {name: 'areas', color: '#f0f0f2'};

  it('merges overlapping ranges and clips them to the bounds', () => {
    const areas = new FullHeightAreas({
      ...config,
      ranges: [
        {start: 40, end: 60},
        {start: -10, end: 10},
        {start: 50, end: 120},
        {start: 150, end: 160},
      ],
      bounds: {start: 0, end: 100},
    });

    expect(areas.ranges).toEqual([
      {start: 0, end: 10},
      {start: 40, end: 100},
    ]);
    expect(areas.start).toBe(0);
    expect(areas.end).toBe(100);
  });

  it('is empty without ranges', () => {
    expect(new FullHeightAreas({...config, ranges: []}).isEmpty).toBe(true);
  });

  it('draws a hatched area across the full plot height behind the data', () => {
    const [series] = new FullHeightAreas({
      ...config,
      ranges: [{start: 1_000, end: 3_000}],
    }).toSeries();

    expect(series).toEqual(
      expect.objectContaining({
        data: [[1_000, 3_000]],
        encode: {x: [0, 1]},
        silent: true,
        tooltip: {show: false},
        z: 1,
      })
    );

    const element = series!.renderItem!(
      {
        dataIndex: 0,
        coordSys: {type: 'cartesian2d', x: 0, y: 10, width: 500, height: 200},
      } as unknown as CustomSeriesRenderItemParams,
      {
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
