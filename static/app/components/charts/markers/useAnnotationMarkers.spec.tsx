import type {
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
} from 'echarts';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import type {AnnotationItem} from 'sentry/components/charts/annotations/types';

import {useAnnotationMarkers} from './useAnnotationMarkers';

const MINUTE = 60_000;

const buckets = Array.from({length: 10}, (_, index) => ({
  start: index * MINUTE,
  end: (index + 1) * MINUTE,
}));

function change(
  id: string,
  time: number,
  severity: AnnotationItem['severity']
): AnnotationItem {
  return {id, kind: 'timeseriesAnnotation', start: time, title: id, severity};
}

const api = {
  coord: ([time]: number[]) => [(time ?? 0) / 1000, 100],
} as unknown as CustomSeriesRenderItemAPI;

const params = {
  coordSys: {type: 'cartesian2d', x: 0, y: 10, width: 600, height: 200},
} as unknown as CustomSeriesRenderItemParams;

describe('useAnnotationMarkers', () => {
  it('returns no markers without severe annotations', () => {
    const {result} = renderHookWithProviders(() =>
      useAnnotationMarkers({
        buckets,
        items: [
          {id: '1.0.0', kind: 'release', start: MINUTE, title: '1.0.0'},
          change('medium', 2 * MINUTE, 'medium'),
          change('low', 3 * MINUTE, 'low'),
        ],
      })
    );

    expect(result.current).toBeNull();
  });

  it('draws one marker per bucket with severe annotations, at the bucket center', () => {
    const {result} = renderHookWithProviders(() =>
      useAnnotationMarkers({
        buckets,
        items: [
          change('first', 2 * MINUTE + 10_000, 'high'),
          change('second', 2 * MINUTE + 20_000, 'high'),
          change('third', 5 * MINUTE, 'high'),
          change('not-severe', 7 * MINUTE, 'low'),
        ],
      })
    );
    const series = result.current;
    if (!series || typeof series.renderItem !== 'function') {
      throw new Error('Expected the marker series to render items');
    }
    const renderItem = series.renderItem as CustomSeriesRenderItem;

    expect(series.data).toHaveLength(2);

    const [merged, single] = [0, 1].map(dataIndex =>
      renderItem({...params, dataIndex, dataIndexInside: dataIndex}, api)
    );

    expect(merged).toMatchObject({
      children: [
        {type: 'line', shape: {x1: 120, y1: 10, x2: 120, y2: 210}},
        {type: 'circle', shape: {cx: 120, cy: 10}},
      ],
    });
    expect(single).toMatchObject({
      children: [{shape: {x1: 300}}, {shape: {cx: 300}}],
    });
  });
});
