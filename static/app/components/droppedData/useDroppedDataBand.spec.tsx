import {AnnotationFixture} from 'sentry-fixture/annotation';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {
  BAND_HEIGHT,
  DROPPED_DATA_SERIES_ID,
  useDroppedDataBand,
} from 'sentry/components/droppedData/useDroppedDataBand';
import type {ReactEchartsRef} from 'sentry/types/echarts';

const chartRef: React.RefObject<ReactEchartsRef | null> = {current: null};

describe('useDroppedDataBand', () => {
  it('returns an empty band when there are no annotations', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({chartRef, droppedData: {dropped: []}})
    );

    expect(result.current.droppedDataSeries).toBeNull();
    expect(result.current.droppedDataYAxis).toBeNull();
    expect(result.current.droppedDataBandHeight).toBe(0);
  });

  it('builds a series and reserves space when annotations are present', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        chartRef,
        droppedData: {dropped: [AnnotationFixture({eventCount: 10})]},
      })
    );

    expect(result.current.droppedDataSeries).not.toBeNull();
    expect(result.current.droppedDataSeries?.id).toBe(DROPPED_DATA_SERIES_ID);
    expect(result.current.droppedDataYAxis).not.toBeNull();
    expect(result.current.droppedDataBandHeight).toBe(BAND_HEIGHT);
  });

  it('collapses the band when visible is false', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        chartRef,
        droppedData: {dropped: [AnnotationFixture({eventCount: 10})], visible: false},
      })
    );

    expect(result.current.droppedDataSeries).toBeNull();
    expect(result.current.droppedDataYAxis).toBeNull();
    expect(result.current.droppedDataBandHeight).toBe(0);
  });

  it('ignores configured drops', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        chartRef,
        droppedData: {
          dropped: [
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
          dropped: [AnnotationFixture({start: 0, eventCount: 1})],
          accepted: [AnnotationFixture({start: 0, eventCount: 99})],
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
          dropped: [],
          accepted: [AnnotationFixture({eventCount: 8000})],
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
          droppedData: {dropped: [AnnotationFixture({eventCount: 10})]},
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
          dropped: [
            AnnotationFixture({start: 0, end: 60_000, eventCount: 10}),
            AnnotationFixture({start: 0, end: 60_000, eventCount: 5, reason: 'quota'}),
            AnnotationFixture({start: 60_000, end: 120_000, eventCount: 20}),
          ],
        },
      })
    );

    expect(result.current.droppedDataSeries?.data).toHaveLength(2);
  });
});
