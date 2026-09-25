import type {
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  LinearGradientObject,
} from 'echarts';
import {AnnotationFixture} from 'sentry-fixture/annotation';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {
  BAND_HEIGHT,
  DROPPED_DATA_SERIES_ID,
  useDroppedDataBand,
} from 'sentry/components/droppedData/useDroppedDataBand';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import type {Annotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

const chartRef: React.RefObject<ReactEchartsRef | null> = {current: null};

describe('useDroppedDataBand', () => {
  it('returns an empty band when there are no annotations', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({chartRef, droppedData: {droppedAnnotations: []}})
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

  it('builds a series and reserves space when annotations are present', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        chartRef,
        droppedData: {droppedAnnotations: [AnnotationFixture({eventCount: 10})]},
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
          droppedAnnotations: [
            AnnotationFixture({
              outcome: 'client_discard',
              reason: 'before_send',
              eventCount: 10,
            }),
          ],
        },
      })
    );

    expect(result.current.droppedDataSeries).toBeNull();
  });

  it('draws a pill for a small positive drop ratio', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        chartRef,
        droppedData: {
          droppedAnnotations: [AnnotationFixture({start: 0, eventCount: 1})],
          acceptedAnnotations: [AnnotationFixture({start: 0, eventCount: 99})],
        },
      })
    );

    expect(result.current.droppedDataSeries).not.toBeNull();
    expect(result.current.droppedDataSeries?.data).toHaveLength(1);
  });

  it('draws no pill for buckets that only have accepted volume', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        chartRef,
        droppedData: {
          droppedAnnotations: [],
          acceptedAnnotations: [AnnotationFixture({eventCount: 8000})],
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
          droppedData: {droppedAnnotations: [AnnotationFixture({eventCount: 10})]},
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
          droppedAnnotations: [
            AnnotationFixture({start: 0, end: 60_000, eventCount: 10}),
            AnnotationFixture({start: 0, end: 60_000, eventCount: 5, reason: 'quota'}),
            AnnotationFixture({start: 60_000, end: 120_000, eventCount: 20}),
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

    interface VisibleRect {
      shape: {width: number; x: number};
      style: {fill: string | LinearGradientObject};
      silent?: boolean;
    }

    function renderShapes(dropped: Annotation[], accepted: Annotation[] = []) {
      const {result} = renderHookWithProviders(() =>
        useDroppedDataBand({
          chartRef,
          droppedData: {droppedAnnotations: dropped, acceptedAnnotations: accepted},
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
        ) as {children: VisibleRect[]};

        return group.children.filter(child => child.silent);
      });
    }

    function renderBand(dropped: Annotation[]) {
      return renderShapes(dropped).map(shapes =>
        shapes.map(({shape}) => [shape.x, shape.x + shape.width])
      );
    }

    function bucket(minute: number, eventCount = 10) {
      return AnnotationFixture({
        start: minute * 60_000,
        end: (minute + 1) * 60_000,
        eventCount,
      });
    }

    function gradientStops(rect: VisibleRect | undefined) {
      const fill = rect?.style.fill;
      if (typeof fill !== 'object' || fill.type !== 'linear') {
        throw new Error('Expected a linear gradient fill');
      }
      return fill.colorStops.map(({color}) => color);
    }

    it('blends adjacent buckets with different drop ratios', () => {
      const [first, second] = renderShapes(
        [bucket(3), bucket(4)],
        [bucket(3), bucket(4, 90)]
      );

      const firstStops = gradientStops(first?.[1]);
      const secondStops = gradientStops(second?.[0]);

      expect(firstStops.at(-1)).toBe(secondStops[0]);
      expect(firstStops[1]).not.toBe(secondStops[1]);
    });

    it('draws the track once, on the first bucket', () => {
      const [first, second] = renderBand([bucket(2), bucket(3)]);

      expect(first).toContainEqual([0, TRACK_WIDTH]);
      expect(second).not.toContainEqual([0, TRACK_WIDTH]);
    });

    it('fills the whole slot and fades into empty neighbouring buckets', () => {
      const [spans] = renderBand([bucket(3)]);

      expect(spans).toEqual([
        [0, TRACK_WIDTH],
        [150, 210],
        [90, 150],
        [210, 270],
      ]);
    });

    it('does not fade between adjacent buckets', () => {
      const [first, second] = renderBand([bucket(3), bucket(4)]);

      expect(first).toEqual([
        [0, TRACK_WIDTH],
        [150, 210],
        [90, 150],
      ]);
      expect(second).toEqual([
        [210, 270],
        [270, 330],
      ]);
    });

    it('meets halfway when a single empty bucket separates two runs', () => {
      const [first, second] = renderBand([bucket(3), bucket(5)]);

      expect(first).toContainEqual([210, 240]);
      expect(second).toContainEqual([240, 270]);
    });
  });
});
