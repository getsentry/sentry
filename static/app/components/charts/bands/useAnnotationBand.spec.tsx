import type {
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
} from 'echarts';

import {render, renderHookWithProviders, screen} from 'sentry-test/reactTestingLibrary';

import type {AnnotationItem} from 'sentry/components/charts/annotations/types';

import {useAnnotationBand} from './useAnnotationBand';

const MINUTE = 60_000;

const buckets = Array.from({length: 10}, (_, index) => ({
  start: index * MINUTE,
  end: (index + 1) * MINUTE,
}));

function release(version: string, time: number): AnnotationItem {
  return {id: version, kind: 'release', start: time, title: version};
}

function bar(minute: number) {
  return {start: minute * MINUTE, end: (minute + 1) * MINUTE};
}

interface BandRect {
  shape: {width: number; x: number};
  style: {opacity: number};
  silent?: boolean;
}

const TRACK_WIDTH = 600;

const api = {
  coord: ([time]: number[]) => [(time ?? 0) / 1000, 100],
} as unknown as CustomSeriesRenderItemAPI;

function renderBucket(
  band: ReturnType<typeof useAnnotationBand>,
  dataIndex: number
): BandRect[] {
  const series = band?.series(0);
  if (!series || typeof series.renderItem !== 'function') {
    throw new Error('Expected the annotation band series to render items');
  }
  const renderItem = series.renderItem as CustomSeriesRenderItem;

  return (
    renderItem(
      {
        dataIndex,
        dataIndexInside: dataIndex,
        coordSys: {type: 'cartesian2d', x: 0, y: 0, width: TRACK_WIDTH, height: 100},
      } as unknown as CustomSeriesRenderItemParams,
      api
    ) as {children: BandRect[]}
  ).children;
}

describe('useAnnotationBand', () => {
  it('returns no band without annotations', () => {
    const {result} = renderHookWithProviders(() => useAnnotationBand({buckets}));

    expect(result.current).toBeNull();
  });

  it('draws a pill shaded by annotation count on buckets with annotations and keeps every bucket hoverable', () => {
    const {result} = renderHookWithProviders(() =>
      useAnnotationBand({
        buckets,
        items: [
          release('1.0.0', 2 * MINUTE),
          release('1.1.0', 5 * MINUTE),
          release('1.1.1', 5 * MINUTE),
          release('1.1.2', 5 * MINUTE),
        ],
      })
    );

    expect(result.current?.series(0).data).toHaveLength(buckets.length);

    const empty = renderBucket(result.current, 0);
    const one = renderBucket(result.current, 2);
    const three = renderBucket(result.current, 5);

    expect(empty).toHaveLength(4);
    expect(empty.at(-1)).toMatchObject({
      shape: {x: 0, width: 30},
      style: {fill: 'transparent'},
    });
    expect(one).toHaveLength(5);
    expect(three).toHaveLength(5);

    expect(one.at(-2)).toMatchObject({shape: {x: 91, width: 58}, style: {opacity: 0.25}});
    expect(three.at(-2)).toMatchObject({
      shape: {x: 271, width: 58},
      style: {opacity: 0.75},
    });
    expect(three.at(-1)).toMatchObject({
      shape: {x: 270, width: 60},
      style: {fill: 'transparent'},
    });
    expect(three.at(-1)?.silent).toBeUndefined();
    expect(three.slice(0, 3)).toMatchObject([
      {shape: {x: 0, width: 270}, silent: true},
      {shape: {x: 330, width: 270}, silent: true},
      {shape: {x: 270, width: 60}, silent: true},
    ]);
  });

  it('spans each pill across the bars it groups', () => {
    const {result} = renderHookWithProviders(() =>
      useAnnotationBand({
        buckets,
        barsPerBucket: 4,
        items: [release('1.0.0', 5 * MINUTE)],
      })
    );

    expect(result.current?.buckets).toEqual([
      {...bar(0), end: 4 * MINUTE, items: []},
      {...bar(4), end: 8 * MINUTE, items: [release('1.0.0', 5 * MINUTE)]},
      {...bar(8), end: 10 * MINUTE, items: []},
    ]);

    const children = renderBucket(result.current, 1);
    expect(children.at(-2)).toMatchObject({shape: {x: 211, width: 238}});
    expect(children.at(-1)).toMatchObject({shape: {x: 210, width: 240}});
  });

  it('gives the shared tooltip the release count of every bucket', () => {
    const {result} = renderHookWithProviders(() =>
      useAnnotationBand({
        buckets,
        items: [
          release('1.1.0', 5 * MINUTE),
          release('1.1.1', 5 * MINUTE + 1000),
          release('1.1.2', 5 * MINUTE + 2000),
        ],
      })
    );
    const band = result.current!;

    expect(band.tooltipSection?.(bar(20))).toBeNull();

    const {unmount} = render(band.tooltipSection!(bar(5))!);
    expect(screen.getByText('Releases')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    unmount();

    render(band.tooltipSection!(bar(2))!);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('counts only the annotations in the hovered range when it is narrower than a pill', () => {
    const {result} = renderHookWithProviders(() =>
      useAnnotationBand({
        buckets,
        barsPerBucket: 4,
        items: [release('1.0.0', 4 * MINUTE), release('1.1.0', 6 * MINUTE)],
      })
    );
    const band = result.current!;

    const {unmount} = render(band.tooltipSection!({start: 4 * MINUTE, end: 8 * MINUTE})!);
    expect(screen.getByText('2')).toBeInTheDocument();
    unmount();

    render(band.tooltipSection!(bar(6))!);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('passes the annotations of a clicked bucket to onClick, even when it has none', () => {
    const onClick = jest.fn();
    const items = [release('1.1.0', 5 * MINUTE), release('1.1.1', 5 * MINUTE)];
    const {result} = renderHookWithProviders(() =>
      useAnnotationBand({
        buckets,
        items: [release('1.0.0', 2 * MINUTE), ...items],
        onClick,
      })
    );

    result.current!.onClick?.(5 * MINUTE);
    expect(onClick).toHaveBeenCalledWith(items);

    result.current!.onClick?.(3 * MINUTE);
    expect(onClick).toHaveBeenLastCalledWith([]);
  });

  it('counts ranges that started before the chart and are still running in the first bucket', () => {
    const onClick = jest.fn();
    const ongoing: AnnotationItem = {
      id: 'ongoing',
      kind: 'timeseriesAnnotation',
      start: -5 * MINUTE,
      end: 'ongoing',
      title: 'Ingestion outage',
    };
    const ended: AnnotationItem = {...ongoing, id: 'ended', end: -2 * MINUTE};
    const {result} = renderHookWithProviders(() =>
      useAnnotationBand({buckets, items: [ongoing, ended], onClick})
    );

    result.current!.onClick?.(0);
    expect(onClick).toHaveBeenCalledWith([ongoing]);
  });

  it('counts each kind in the band on its own tooltip row', () => {
    const flag: AnnotationItem = {
      id: 'flag-1',
      kind: 'flag',
      start: 2 * MINUTE,
      title: 'my-flag',
    };
    const {result} = renderHookWithProviders(() =>
      useAnnotationBand({
        buckets,
        items: [release('1.1.0', 5 * MINUTE), release('1.1.1', 5 * MINUTE), flag],
      })
    );

    render(result.current!.tooltipSection!(bar(5))!);

    expect(screen.getByText('Releases')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Flags')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.queryByText('Changes')).not.toBeInTheDocument();
  });
});
