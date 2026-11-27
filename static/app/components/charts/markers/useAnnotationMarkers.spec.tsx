import type {
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
} from 'echarts';
import type {CallbackDataParams} from 'echarts/types/dist/shared';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import type {AnnotationItem} from 'sentry/components/charts/annotations/types';
import type {ReactEchartsRef} from 'sentry/types/echarts';

import {useAnnotationMarkers} from './useAnnotationMarkers';

const MINUTE = 60_000;

const chartRef = {current: null};

const buckets = Array.from({length: 10}, (_, index) => ({
  start: index * MINUTE,
  end: (index + 1) * MINUTE,
}));

function change(
  id: string,
  time: number,
  pinned: boolean,
  end?: AnnotationItem['end']
): AnnotationItem {
  return {id, kind: 'timeseriesAnnotation', start: time, title: id, pinned, end};
}

const api = {
  coord: ([time]: number[]) => [(time ?? 0) / 1000, 100],
} as unknown as CustomSeriesRenderItemAPI;

const params = {
  coordSys: {type: 'cartesian2d', x: 0, y: 10, width: 600, height: 200},
} as unknown as CustomSeriesRenderItemParams;

function renderMarkers(items: AnnotationItem[]) {
  const {result} = renderHookWithProviders(() =>
    useAnnotationMarkers({buckets, chartRef, items})
  );
  const series = result.current;
  if (!series || typeof series.renderItem !== 'function') {
    throw new Error('Expected the marker series to render items');
  }
  const renderItem = series.renderItem as CustomSeriesRenderItem;
  const data = series.data as unknown[];

  return data.map((_, dataIndex) =>
    renderItem({...params, dataIndex, dataIndexInside: dataIndex}, api)
  );
}

describe('useAnnotationMarkers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });
  it('returns no markers without pinned annotations', () => {
    const {result} = renderHookWithProviders(() =>
      useAnnotationMarkers({
        buckets,
        chartRef,
        items: [
          {id: '1.0.0', kind: 'release', start: MINUTE, title: '1.0.0'},
          {...change('high-severity', 2 * MINUTE, false), severity: 'high'},
          change('unpinned', 3 * MINUTE, false),
        ],
      })
    );

    expect(result.current).toBeNull();
  });

  it('draws one marker per bucket with pinned annotations, at the bucket center', () => {
    const markers = renderMarkers([
      change('first', 2 * MINUTE + 10_000, true),
      change('second', 2 * MINUTE + 20_000, true),
      change('third', 5 * MINUTE, true),
      change('not-pinned', 7 * MINUTE, false),
    ]);

    expect(markers).toHaveLength(2);
    expect(markers[0]).toMatchObject({
      children: [
        {type: 'line', shape: {x1: 120, y1: 10, x2: 120, y2: 210}},
        {type: 'circle', shape: {cx: 120, cy: 10}},
        {type: 'rect'},
      ],
    });
    expect(markers[1]).toMatchObject({
      children: [{shape: {x1: 300}}, {shape: {cx: 300}}, {type: 'rect'}],
    });
  });

  it('draws a line along the top to the center of the bucket a range ends in', () => {
    const [range] = renderMarkers([
      change('range', 2 * MINUTE, true, 5 * MINUTE + 30_000),
    ]);

    expect(range).toMatchObject({
      children: [
        {type: 'line', shape: {x1: 120, y1: 10, x2: 300, y2: 10}},
        {type: 'rect'},
        {type: 'line', shape: {x1: 120, x2: 120}},
        {type: 'circle'},
        {type: 'rect'},
      ],
    });
  });

  it('runs ongoing ranges to the right edge of the plot', () => {
    const [ongoing] = renderMarkers([change('ongoing', 2 * MINUTE, true, 'ongoing')]);

    expect(ongoing).toMatchObject({
      children: [{shape: {x1: 120, x2: 600}}, {}, {}, {}, {}],
    });
  });

  it('draws only the line from the left edge for ranges that started before the chart', () => {
    const [earlier] = renderMarkers([
      change('earlier', -2 * MINUTE, true, 3 * MINUTE + 30_000),
    ]);

    expect(earlier).toMatchObject({
      children: [
        {type: 'line', shape: {x1: 0, y1: 10, x2: 180, y2: 10}},
        {type: 'rect', shape: {x: 0, width: 180}},
      ],
    });
  });

  it('keeps the longest range when pinned annotations share a bucket', () => {
    const [merged] = renderMarkers([
      change('short', 2 * MINUTE, true, 3 * MINUTE),
      change('long', 2 * MINUTE + 10_000, true, 6 * MINUTE),
      change('point', 2 * MINUTE + 20_000, true),
    ]);

    expect(merged).toMatchObject({
      children: [{shape: {x1: 120, x2: 360}}, {}, {}, {}, {}],
    });
  });

  it('shows the annotations of the hovered marker in its tooltip', async () => {
    const ele = document.createElement('div');
    const querySelector = document.querySelector.bind(document);
    jest
      .spyOn(document, 'querySelector')
      .mockImplementation(selector =>
        selector === '.echarts-for-react:hover' ? ele : querySelector(selector)
      );
    const hoveredChartRef = {current: {ele} as unknown as ReactEchartsRef};

    const {result} = renderHookWithProviders(() =>
      useAnnotationMarkers({
        buckets,
        chartRef: hoveredChartRef,
        items: [change('outage', 2 * MINUTE, true), change('cluster', 5 * MINUTE, true)],
        utc: true,
      })
    );
    const formatter = result.current?.tooltip?.formatter as (
      params: CallbackDataParams
    ) => string;

    const tooltip = document.createElement('div');
    tooltip.innerHTML = await act(() => formatter({dataIndex: 1} as CallbackDataParams));

    expect(tooltip).toHaveTextContent('cluster');
    expect(tooltip).not.toHaveTextContent('outage');
  });
});
