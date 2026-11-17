import type {
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
} from 'echarts';

import {render, renderHookWithProviders, screen} from 'sentry-test/reactTestingLibrary';

import {useReleaseBand} from './useReleaseBand';

const MINUTE = 60_000;

const buckets = Array.from({length: 10}, (_, index) => ({
  start: index * MINUTE,
  end: (index + 1) * MINUTE,
}));

function release(version: string, time: number) {
  return {version, timestamp: new Date(time).toISOString()};
}

interface BandRect {
  shape: {width: number; x: number};
  style: {opacity: number};
  silent?: boolean;
}

describe('useReleaseBand', () => {
  it('returns no band without releases', () => {
    const {result} = renderHookWithProviders(() => useReleaseBand({buckets}));

    expect(result.current).toBeNull();
  });

  it('draws a marker shaded by release count on buckets with releases and keeps every bucket hoverable', () => {
    const TRACK_WIDTH = 600;
    const api = {
      coord: ([time]: number[]) => [(time ?? 0) / 1000, 100],
    } as unknown as CustomSeriesRenderItemAPI;

    const {result} = renderHookWithProviders(() =>
      useReleaseBand({
        buckets,
        releases: [
          release('1.0.0', 2 * MINUTE),
          release('1.1.0', 5 * MINUTE),
          release('1.1.1', 5 * MINUTE),
          release('1.1.2', 5 * MINUTE),
        ],
      })
    );
    const series = result.current?.series(0);
    if (!series || typeof series.renderItem !== 'function') {
      throw new Error('Expected the release band series to render items');
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
      useReleaseBand({
        buckets,
        releases: [
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
});
