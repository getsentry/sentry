import type {
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
} from 'echarts';
import {OutcomeRowFixture} from 'sentry-fixture/outcomeRow';
import {ThemeFixture} from 'sentry-fixture/theme';

import {render, renderHookWithProviders, screen} from 'sentry-test/reactTestingLibrary';

import {BAND_HEIGHT} from 'sentry/components/charts/bands/bandShapes';
import type {OutcomeRow} from 'sentry/components/droppedData/types';
import {DiscoverDatasets} from 'sentry/utils/discover/types';

import {severityColor, withAlpha} from './severityColor';
import {DROPPED_DATA_SERIES_ID, useDroppedDataBand} from './useDroppedDataBand';

describe('useDroppedDataBand', () => {
  it('returns an empty band when there are no dropped events', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        droppedData: {dataset: DiscoverDatasets.SPANS, droppedEvents: []},
      })
    );

    expect(result.current).toBeNull();
  });

  it('returns an empty band without dropped data', () => {
    const {result} = renderHookWithProviders(() => useDroppedDataBand({}));

    expect(result.current).toBeNull();
  });

  it('builds a band when dropped events are present', () => {
    const onClick = jest.fn();
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        droppedData: {
          dataset: DiscoverDatasets.SPANS,
          droppedEvents: [OutcomeRowFixture({count: 10})],
          onClick,
        },
      })
    );

    expect(result.current).toMatchObject({
      id: DROPPED_DATA_SERIES_ID,
      height: BAND_HEIGHT,
      onClick,
    });
  });

  it('ignores intentional drops', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        droppedData: {
          dataset: DiscoverDatasets.SPANS,
          droppedEvents: [OutcomeRowFixture({count: 10, tags: ['intentional']})],
        },
      })
    );

    expect(result.current).toBeNull();
  });

  it('keeps buckets without drops so they can be hovered', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        droppedData: {
          dataset: DiscoverDatasets.SPANS,
          droppedEvents: [
            OutcomeRowFixture({start: 0, count: 0}),
            OutcomeRowFixture({start: 60_000, count: 1}),
          ],
          acceptedEvents: [
            OutcomeRowFixture({start: 0, count: 100}),
            OutcomeRowFixture({start: 60_000, count: 99}),
            OutcomeRowFixture({start: 120_000, count: 50}),
          ],
        },
      })
    );

    expect(result.current?.series(0).data).toEqual([
      expect.objectContaining({start: 0, ratio: 0}),
      expect.objectContaining({start: 60_000, ratio: 0.01}),
      expect.objectContaining({start: 120_000, ratio: 0, accepted: 50}),
    ]);
  });

  it('hides the band when no bucket has drops', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        droppedData: {
          dataset: DiscoverDatasets.SPANS,
          droppedEvents: [OutcomeRowFixture({start: 0, count: 0})],
          acceptedEvents: [OutcomeRowFixture({start: 0, count: 100})],
        },
      })
    );

    expect(result.current).toBeNull();
  });

  it('hides the band when every bucket is below the highlight threshold', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        droppedData: {
          dataset: DiscoverDatasets.SPANS,
          droppedEvents: [OutcomeRowFixture({start: 0, count: 1})],
          acceptedEvents: [OutcomeRowFixture({start: 0, count: 1999})],
        },
      })
    );

    expect(result.current).toBeNull();
  });

  it('draws no pill for buckets that only have accepted volume', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        droppedData: {
          dataset: DiscoverDatasets.SPANS,
          droppedEvents: [],
          acceptedEvents: [OutcomeRowFixture({count: 8000})],
        },
      })
    );

    expect(result.current).toBeNull();
  });

  it('gives the shared tooltip a section for each bucket it has', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        droppedData: {
          dataset: DiscoverDatasets.SPANS,
          droppedEvents: [
            OutcomeRowFixture({start: 0, count: 25}),
            OutcomeRowFixture({start: 60_000, count: 0}),
          ],
          acceptedEvents: [
            OutcomeRowFixture({start: 0, count: 75}),
            OutcomeRowFixture({start: 60_000, count: 100}),
          ],
        },
      })
    );
    const band = result.current!;

    expect(band.buckets.map(({start}) => start)).toEqual([0, 60_000]);
    expect(band.tooltipSection?.(120_000)).toBeNull();

    const {unmount} = render(band.tooltipSection!(0)!);
    expect(screen.getByText('Dropped Spans')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    unmount();

    render(band.tooltipSection!(60_000)!);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('collapses buckets sharing a time range into a single series datum', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        droppedData: {
          dataset: DiscoverDatasets.SPANS,
          droppedEvents: [
            OutcomeRowFixture({start: 0, end: 60_000, count: 10}),
            OutcomeRowFixture({start: 0, end: 60_000, count: 5, reason: 'quota'}),
            OutcomeRowFixture({start: 60_000, end: 120_000, count: 20}),
          ],
        },
      })
    );

    expect(result.current?.series(0).data).toHaveLength(2);
  });

  describe('render item', () => {
    const TRACK_WIDTH = 600;

    // One pixel per second, so each one-minute bucket is 60px wide.
    const api = {
      coord: ([time]: number[]) => [(time ?? 0) / 1000, 100],
    } as unknown as CustomSeriesRenderItemAPI;

    interface Gradient {
      colorStops: Array<{color: string; offset: number}>;
      global: boolean;
      x: number;
      x2: number;
    }

    interface BandRect {
      shape: {width: number; x: number; y: number};
      style: {fill: string | Gradient};
      silent?: boolean;
    }

    function span({shape}: BandRect) {
      return [shape.x, shape.x + shape.width];
    }

    function gradientRect(shapes: BandRect[] | undefined) {
      const rect = shapes?.find(shape => typeof shape.style.fill !== 'string');
      if (!rect) {
        throw new Error('Expected the bucket to draw a gradient');
      }

      const gradient = rect.style.fill as Gradient;
      return {
        rect,
        gradient,
        colors: gradient.colorStops.map(stop => stop.color),
        offsets: gradient.colorStops.map(stop => stop.offset),
        xs: gradient.colorStops.map(stop =>
          Math.round(gradient.x + stop.offset * (gradient.x2 - gradient.x))
        ),
      };
    }

    function renderShapes(
      dropped: OutcomeRow[],
      accepted: OutcomeRow[] = [],
      bandOffset = 0
    ) {
      const {result} = renderHookWithProviders(() =>
        useDroppedDataBand({
          droppedData: {
            dataset: DiscoverDatasets.SPANS,
            droppedEvents: dropped,
            acceptedEvents: accepted,
          },
        })
      );

      const series = result.current?.series(bandOffset);
      if (!series || typeof series.renderItem !== 'function') {
        throw new Error('Expected the dropped data series to render items');
      }
      const renderItem = series.renderItem as CustomSeriesRenderItem;

      return (series.data as unknown[]).map((_, dataIndex) => {
        const group = renderItem(
          {
            dataIndex,
            dataIndexInside: dataIndex,
            coordSys: {type: 'cartesian2d', x: 0, y: 0, width: TRACK_WIDTH, height: 100},
          } as unknown as CustomSeriesRenderItemParams,
          api
        ) as {children: BandRect[]};

        return group.children;
      });
    }

    function bucket(minute: number, count = 10) {
      return OutcomeRowFixture({
        start: minute * 60_000,
        end: (minute + 1) * 60_000,
        count,
      });
    }

    it('draws the track and the gradient once, on the first bucket', () => {
      const [first, second] = renderShapes([bucket(2), bucket(3)]);

      expect(first?.[0]).toMatchObject({shape: {x: 0, width: TRACK_WIDTH}, silent: true});
      expect(first).toHaveLength(6);
      expect(second).toHaveLength(4);
    });

    it('highlights the hovered bucket over the plot', () => {
      const [shapes] = renderShapes([bucket(3)]);

      expect(shapes?.slice(-4, -1).map(span)).toEqual([
        [0, 150],
        [210, TRACK_WIDTH],
        [150, 210],
      ]);
    });

    it('draws the band at the offset it is given below the plot', () => {
      const [shapes] = renderShapes([bucket(3)], [], 12);

      expect(shapes?.[0]?.shape.y).toBe(114);
    });

    it('centres each hover target on its bucket start, clamped to the track', () => {
      const spans = renderShapes([bucket(0), bucket(5), bucket(10)]).map(shapes =>
        span(shapes.at(-1)!)
      );

      expect(spans).toEqual([
        [0, 30],
        [270, 330],
        [570, TRACK_WIDTH],
      ]);
    });

    it('limits hovering to the slot while the gradient stays silent', () => {
      const [shapes] = renderShapes([bucket(3)]);
      const hover = shapes!.at(-1)!;

      expect(hover.silent).toBeUndefined();
      expect(hover).toMatchObject({style: {fill: 'transparent'}});
      expect(span(hover)).toEqual([150, 210]);
      expect(gradientRect(shapes).rect.silent).toBe(true);
    });

    it('keeps buckets below the highlight threshold hoverable but out of the gradient', () => {
      const [first, second] = renderShapes(
        [bucket(3), bucket(4, 1)],
        [bucket(3, 90), bucket(4, 1999)]
      );
      const color = severityColor(0.1, ThemeFixture());
      const {colors} = gradientRect(first);

      expect(span(second!.at(-1)!)).toEqual([210, 270]);
      expect(colors).toEqual([withAlpha(color, 0), color, color, withAlpha(color, 0)]);
    });

    it('blends adjacent buckets evenly around their shared edge', () => {
      const theme = ThemeFixture();
      const [first] = renderShapes(
        [bucket(3, 9), bucket(4, 12)],
        [bucket(3, 91), bucket(4, 88)]
      );
      const nine = severityColor(0.09, theme);
      const twelve = severityColor(0.12, theme);
      const {colors, xs} = gradientRect(first);

      expect(colors).toEqual([
        withAlpha(nine, 0),
        nine,
        nine,
        twelve,
        twelve,
        withAlpha(twelve, 0),
      ]);
      // The shared edge sits at 210, halfway between the 9% and 12% stops.
      expect(xs).toEqual([142, 158, 202, 218, 262, 278]);
    });

    it('fades a lone bucket to clear across both of its edges', () => {
      const [shapes] = renderShapes([bucket(3)]);
      const color = severityColor(1, ThemeFixture());
      const {rect, colors, xs} = gradientRect(shapes);

      expect(span(rect)).toEqual([142, 218]);
      expect(colors).toEqual([withAlpha(color, 0), color, color, withAlpha(color, 0)]);
      expect(xs).toEqual([142, 158, 202, 218]);
    });

    it('fades runs one empty slot apart without overlapping', () => {
      const [first] = renderShapes([bucket(3), bucket(5)]);
      const color = severityColor(1, ThemeFixture());
      const clear = withAlpha(color, 0);
      const {colors, xs} = gradientRect(first);

      expect(colors).toEqual([clear, color, color, clear, clear, color, color, clear]);
      expect(xs).toEqual([142, 158, 202, 218, 262, 278, 322, 338]);
    });

    it('cuts the gradient off at the edge of the plot', () => {
      const [shapes] = renderShapes([bucket(0)]);
      const {rect, gradient, offsets} = gradientRect(shapes);

      expect(span(rect)).toEqual([0, 38]);
      expect(gradient).toMatchObject({global: true, x: -38, x2: 38});
      for (const offset of offsets) {
        expect(offset).toBeGreaterThanOrEqual(0);
        expect(offset).toBeLessThanOrEqual(1);
      }
    });
  });
});
