import {AnnotationFixture} from 'sentry-fixture/annotation';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {
  BAND_HEIGHT,
  DROPPED_DATA_SERIES_ID,
  useDroppedDataBand,
} from 'sentry/views/explore/components/chart/droppedDataBand/useDroppedDataBand';

describe('useDroppedDataBand', () => {
  it('returns an empty band when there are no annotations', () => {
    const {result} = renderHookWithProviders(() => useDroppedDataBand({annotations: []}));

    expect(result.current.droppedDataSeries).toBeNull();
    expect(result.current.droppedDataYAxis).toBeNull();
    expect(result.current.droppedDataBandHeight).toBe(0);
  });

  it('builds a series and reserves space when annotations are present', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({annotations: [AnnotationFixture({droppedCount: 10})]})
    );

    expect(result.current.droppedDataSeries).not.toBeNull();
    expect(result.current.droppedDataSeries?.id).toBe(DROPPED_DATA_SERIES_ID);
    expect(result.current.droppedDataYAxis).not.toBeNull();
    expect(result.current.droppedDataBandHeight).toBe(BAND_HEIGHT);
  });

  it('collapses the band when showDroppedData is false', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        annotations: [AnnotationFixture({droppedCount: 10})],
        showDroppedData: false,
      })
    );

    expect(result.current.droppedDataSeries).toBeNull();
    expect(result.current.droppedDataYAxis).toBeNull();
    expect(result.current.droppedDataBandHeight).toBe(0);
  });

  it('ignores client discard annotations', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        annotations: [AnnotationFixture({label: 'Client discard', droppedCount: 10})],
      })
    );

    expect(result.current.droppedDataSeries).toBeNull();
  });

  it('collapses buckets sharing a time range into a single series datum', () => {
    const {result} = renderHookWithProviders(() =>
      useDroppedDataBand({
        annotations: [
          AnnotationFixture({start: 0, end: 60_000, droppedCount: 10}),
          AnnotationFixture({start: 0, end: 60_000, droppedCount: 5, reason: 'quota'}),
          AnnotationFixture({start: 60_000, end: 120_000, droppedCount: 20}),
        ],
      })
    );

    expect(result.current.droppedDataSeries?.data).toHaveLength(2);
  });
});
