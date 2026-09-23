import {AnnotationFixture} from 'sentry-fixture/annotation';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import type {ReactEchartsRef} from 'sentry/types/echarts';
import {
  BAND_HEIGHT,
  DROPPED_DATA_SERIES_ID,
  useDroppedDataBand,
} from 'sentry/views/explore/components/chart/droppedDataBand/useDroppedDataBand';

const chartRef: React.RefObject<ReactEchartsRef | null> = {current: null};

describe('useDroppedDataBand', () => {
  it('returns an empty band when there are no annotations', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({chartRef, droppedAnnotations: []})
    );

    expect(result.current.droppedDataSeries).toBeNull();
    expect(result.current.droppedDataYAxis).toBeNull();
    expect(result.current.droppedDataBandHeight).toBe(0);
  });

  it('builds a series and reserves space when annotations are present', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        chartRef,
        droppedAnnotations: [AnnotationFixture({eventCount: 10})],
      })
    );

    expect(result.current.droppedDataSeries).not.toBeNull();
    expect(result.current.droppedDataSeries?.id).toBe(DROPPED_DATA_SERIES_ID);
    expect(result.current.droppedDataYAxis).not.toBeNull();
    expect(result.current.droppedDataBandHeight).toBe(BAND_HEIGHT);
  });

  it('collapses the band when showDroppedData is false', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        chartRef,
        droppedAnnotations: [AnnotationFixture({eventCount: 10})],
        showDroppedData: false,
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
        droppedAnnotations: [
          AnnotationFixture({
            outcome: 'client_discard',
            reason: 'before_send',
            eventCount: 10,
          }),
        ],
      })
    );

    expect(result.current.droppedDataSeries).toBeNull();
  });

  it('draws a pill for a small positive drop ratio', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        chartRef,
        droppedAnnotations: [AnnotationFixture({start: 0, eventCount: 1})],
        acceptedAnnotations: [AnnotationFixture({start: 0, eventCount: 99})],
      })
    );

    expect(result.current.droppedDataSeries).not.toBeNull();
    expect(result.current.droppedDataSeries?.data).toHaveLength(1);
  });

  it('draws no pill for buckets that only have accepted volume', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        chartRef,
        droppedAnnotations: [],
        acceptedAnnotations: [AnnotationFixture({eventCount: 8000})],
      })
    );

    expect(result.current.droppedDataSeries).toBeNull();
  });

  it('collapses buckets sharing a time range into a single series datum', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        chartRef,
        droppedAnnotations: [
          AnnotationFixture({start: 0, end: 60_000, eventCount: 10}),
          AnnotationFixture({start: 0, end: 60_000, eventCount: 5, reason: 'quota'}),
          AnnotationFixture({start: 60_000, end: 120_000, eventCount: 20}),
        ],
      })
    );

    expect(result.current.droppedDataSeries?.data).toHaveLength(2);
  });
});
