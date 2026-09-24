import {AnnotationFixture} from 'sentry-fixture/annotation';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useDroppedData} from 'sentry/components/droppedData/useDroppedData';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

const droppedAnnotations = [AnnotationFixture({eventCount: 10})];
const acceptedAnnotations = [AnnotationFixture({outcome: 'accepted', eventCount: 90})];

const meta: EventsTimeSeriesResponse['meta'] = {
  dataset: DiscoverDatasets.SPANS,
  start: 0,
  end: 60_000,
  droppedAnnotations,
  acceptedAnnotations,
};

describe('useDroppedData', () => {
  it('reads the annotations from meta', () => {
    const {result} = renderHookWithProviders(() => useDroppedData(meta));

    expect(result.current.droppedAnnotations).toBe(droppedAnnotations);
    expect(result.current.acceptedAnnotations).toBe(acceptedAnnotations);
  });

  it('returns no annotations without meta', () => {
    const {result} = renderHookWithProviders(() => useDroppedData(undefined));

    expect(result.current.droppedAnnotations).toBeUndefined();
    expect(result.current.acceptedAnnotations).toBeUndefined();
  });
});
