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

interface BandRect {
  shape: {width: number; x: number};
  style: {opacity: number};
  silent?: boolean;
}

describe('useAnnotationBand', () => {
  it('returns no band without annotations', () => {
    const {result} = renderHookWithProviders(() => useAnnotationBand({buckets}));

    expect(result.current).toBeNull();
  });

  it('draws a marker shaded by annotation count on buckets with annotations and keeps every bucket hoverable', () => {
    const TRACK_WIDTH = 600;
    const api = {
      coord: ([time]: number[]) => [(time ?? 0) / 1000, 100],
    } as unknown as CustomSeriesRenderItemAPI;

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
    const series = result.current?.series(0);
    if (!series || typeof series.renderItem !== 'function') {
      throw new Error('Expected the annotation band series to render items');
    }
    const renderItem = series.renderItem as CustomSeriesRenderItem;

    expect(series.data).toHaveLength(buckets.length);

    const [empty, one, three] = [0, 2, 5].map(
      dataIndex =>
        (
          renderItem(
            {
              dataIndex,
              dataIndexInside: dataIndex,
              coordSys: {
                type: 'cartesian2d',
                x: 0,
                y: 0,
                width: TRACK_WIDTH,
                height: 100,
              },
            } as unknown as CustomSeriesRenderItemParams,
            api
          ) as {children: BandRect[]}
        ).children
    );

    expect(empty).toHaveLength(5);
    expect(empty?.[0]).toMatchObject({shape: {x: 0, width: TRACK_WIDTH}, silent: true});
    expect(empty?.at(-1)).toMatchObject({
      shape: {x: 0, width: 30},
      style: {fill: 'transparent'},
    });
    expect(one).toHaveLength(5);
    expect(three).toHaveLength(5);

    expect(one?.at(-2)).toMatchObject({
      shape: {x: 90, width: 60},
      style: {opacity: 0.25},
    });
    expect(three?.at(-2)).toMatchObject({
      shape: {x: 270, width: 60},
      style: {opacity: 0.75},
    });
    expect(three?.at(-1)).toMatchObject({
      shape: {x: 270, width: 60},
      style: {fill: 'transparent'},
    });
    expect(three?.at(-1)?.silent).toBeUndefined();
    expect(three?.slice(0, 3)).toMatchObject([
      {shape: {x: 0, width: 270}, silent: true},
      {shape: {x: 330, width: 270}, silent: true},
      {shape: {x: 270, width: 60}, silent: true},
    ]);
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

    expect(band.tooltipSection?.(20 * MINUTE)).toBeNull();

    const {unmount} = render(band.tooltipSection!(5 * MINUTE)!);
    expect(screen.getByText('Releases')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    unmount();

    render(band.tooltipSection!(2 * MINUTE)!);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('passes the annotations of a clicked bucket to onClick', () => {
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

    onClick.mockClear();
    result.current!.onClick?.(3 * MINUTE);
    expect(onClick).not.toHaveBeenCalled();
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

    render(result.current!.tooltipSection!(5 * MINUTE)!);

    expect(screen.getByText('Releases')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Flags')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.queryByText('Changes')).not.toBeInTheDocument();
  });
});
