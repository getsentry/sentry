import type {
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
} from 'echarts';
import {DroppedEventFixture} from 'sentry-fixture/droppedEvent';
import {ThemeFixture} from 'sentry-fixture/theme';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {severityColor, withAlpha} from 'sentry/components/droppedData/band/severityColor';
import {
  BAND_HEIGHT,
  DROPPED_DATA_SERIES_ID,
  useDroppedDataBand,
} from 'sentry/components/droppedData/band/useDroppedDataBand';
import type {DroppedEventsBucket} from 'sentry/components/droppedData/types';
import type {ReactEchartsRef} from 'sentry/types/echarts';

const chartRef: React.RefObject<ReactEchartsRef | null> = {current: null};

describe('useDroppedDataBand', () => {
  it('returns an empty band when there are no dropped events', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({chartRef, droppedData: {droppedEvents: []}})
    );

    expect(result.current.droppedDataSeries).toBeNull();
    expect(result.current.droppedDataYAxis).toBeNull();
    expect(result.current.droppedDataBandHeight).toBe(0);
  });

  it('returns an empty band without dropped data', () => {
    const {result} = renderHookWithProviders(() => useDroppedDataBand({chartRef}));

    expect(result.current.droppedDataSeries).toBeNull();
    expect(result.current.droppedDataYAxis).toBeNull();
    expect(result.current.droppedDataBandHeight).toBe(0);
  });

  it('builds a series and reserves space when dropped events are present', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        chartRef,
        droppedData: {droppedEvents: [DroppedEventFixture({count: 10})]},
      })
    );

    expect(result.current.droppedDataSeries).not.toBeNull();
    expect(result.current.droppedDataSeries?.id).toBe(DROPPED_DATA_SERIES_ID);
    expect(result.current.droppedDataYAxis).not.toBeNull();
    expect(result.current.droppedDataBandHeight).toBe(BAND_HEIGHT);
  });

  it('ignores configured drops', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        chartRef,
        droppedData: {
          droppedEvents: [
            DroppedEventFixture({
              outcome: 'client_discard',
              reason: 'before_send',
              count: 10,
            }),
          ],
        },
      })
    );

    expect(result.current.droppedDataSeries).toBeNull();
  });

  it('keeps buckets with any drops and skips those without', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        chartRef,
        droppedData: {
          droppedEvents: [
            DroppedEventFixture({start: 0, count: 0}),
            DroppedEventFixture({start: 60_000, count: 1}),
          ],
          acceptedEvents: [
            DroppedEventFixture({start: 0, count: 100}),
            DroppedEventFixture({start: 60_000, count: 99}),
          ],
        },
      })
    );

    expect(result.current.droppedDataSeries?.data).toEqual([
      expect.objectContaining({start: 60_000, ratio: 0.01}),
    ]);
  });

  it('hides the band when no bucket has drops', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        chartRef,
        droppedData: {
          droppedEvents: [DroppedEventFixture({start: 0, count: 0})],
          acceptedEvents: [DroppedEventFixture({start: 0, count: 100})],
        },
      })
    );

    expect(result.current.droppedDataSeries).toBeNull();
    expect(result.current.droppedDataBandHeight).toBe(0);
  });

  it('draws no pill for buckets that only have accepted volume', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        chartRef,
        droppedData: {
          droppedEvents: [],
          acceptedEvents: [DroppedEventFixture({count: 8000})],
        },
      })
    );

    expect(result.current.droppedDataSeries).toBeNull();
  });

  describe('tooltip position', () => {
    const CHART_WIDTH = 800;
    const PILL_WIDTH = 10;
    const PILL_BOTTOM = 180;

    function positionTooltip({
      pillCenterX,
      tooltipWidth,
    }: {
      pillCenterX: number;
      tooltipWidth: number;
    }) {
      const {result} = renderHookWithProviders(() =>
        useDroppedDataBand({
          chartRef,
          droppedData: {droppedEvents: [DroppedEventFixture({count: 10})]},
        })
      );

      const position = result.current.droppedDataSeries?.tooltip?.position;
      if (typeof position !== 'function') {
        throw new Error('Expected the dropped data tooltip to position itself');
      }

      const tooltip = document.createElement('div');
      const arrow = document.createElement('div');
      arrow.className = 'tooltip-arrow arrow-top';
      tooltip.append(arrow);

      const [left, top] = position(
        [0, 0],
        [],
        tooltip,
        {
          x: pillCenterX - PILL_WIDTH / 2,
          y: PILL_BOTTOM - 8,
          width: PILL_WIDTH,
          height: 8,
        },
        {contentSize: [tooltipWidth, 120], viewSize: [CHART_WIDTH, 300]}
      ) as [number, number];

      return {left, top, arrowLeft: arrow.style.left};
    }

    it('keeps the tooltip in the chart when the pill is near the right edge', () => {
      const tooltipWidth = 300;
      const pillCenterX = CHART_WIDTH - 10;

      const {left, arrowLeft} = positionTooltip({pillCenterX, tooltipWidth});

      expect(left + tooltipWidth).toBe(CHART_WIDTH);
      expect(arrowLeft).toBe(`${pillCenterX - left}px`);
    });

    it('keeps the tooltip in the chart when the pill is near the left edge', () => {
      const pillCenterX = 10;

      const {left, arrowLeft} = positionTooltip({pillCenterX, tooltipWidth: 300});

      expect(left).toBe(0);
      expect(arrowLeft).toBe(`${pillCenterX}px`);
    });
  });

  it('collapses buckets sharing a time range into a single series datum', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        chartRef,
        droppedData: {
          droppedEvents: [
            DroppedEventFixture({start: 0, end: 60_000, count: 10}),
            DroppedEventFixture({start: 0, end: 60_000, count: 5, reason: 'quota'}),
            DroppedEventFixture({start: 60_000, end: 120_000, count: 20}),
          ],
        },
      })
    );

    expect(result.current.droppedDataSeries?.data).toHaveLength(2);
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
      shape: {width: number; x: number};
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
      dropped: DroppedEventsBucket[],
      accepted: DroppedEventsBucket[] = []
    ) {
      const {result} = renderHookWithProviders(() =>
        useDroppedDataBand({
          chartRef,
          droppedData: {droppedEvents: dropped, acceptedEvents: accepted},
        })
      );

      const series = result.current.droppedDataSeries;
      if (!series || typeof series.renderItem !== 'function') {
        throw new Error('Expected the dropped data series to render items');
      }
      const renderItem = series.renderItem as CustomSeriesRenderItem;

      return (series.data as unknown[]).map((_, dataIndex) => {
        const group = renderItem(
          {
            dataIndex,
            dataIndexInside: dataIndex,
            coordSys: {type: 'cartesian2d', x: 0, width: TRACK_WIDTH},
          } as unknown as CustomSeriesRenderItemParams,
          api
        ) as {children: BandRect[]};

        return group.children;
      });
    }

    function bucket(minute: number, count = 10) {
      return DroppedEventFixture({
        start: minute * 60_000,
        end: (minute + 1) * 60_000,
        count,
      });
    }

    it('draws the track and the gradient once, on the first bucket', () => {
      const [first, second] = renderShapes([bucket(2), bucket(3)]);

      expect(first?.[0]).toMatchObject({shape: {x: 0, width: TRACK_WIDTH}, silent: true});
      expect(first).toHaveLength(3);
      expect(second).toHaveLength(1);
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
