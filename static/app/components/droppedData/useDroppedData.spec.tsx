import {AnnotationFixture} from 'sentry-fixture/annotation';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useDroppedData} from 'sentry/components/droppedData/useDroppedData';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

const organization = OrganizationFixture({
  features: ['explore-data-fidelity-annotations'],
});

const dropped = [AnnotationFixture({eventCount: 10})];
const accepted = [AnnotationFixture({outcome: 'accepted', eventCount: 90})];

const meta: EventsTimeSeriesResponse['meta'] = {
  dataset: DiscoverDatasets.SPANS,
  start: 0,
  end: 60_000,
  droppedAnnotations: dropped,
  acceptedAnnotations: accepted,
};

describe('useDroppedData', () => {
  it('returns no annotations without the feature flag', () => {
    const {result} = renderHookWithProviders(() => useDroppedData(meta), {
      organization: OrganizationFixture({features: []}),
    });

    expect(result.current.chartProps.dropped).toBeUndefined();
    expect(result.current.chartProps.accepted).toBeUndefined();
    expect(result.current.hasDroppedData).toBe(false);
  });

  it('passes annotations from meta to the chart', () => {
    const {result} = renderHookWithProviders(() => useDroppedData(meta), {
      organization,
    });

    expect(result.current.chartProps.dropped).toBe(dropped);
    expect(result.current.chartProps.accepted).toBe(accepted);
    expect(result.current.chartProps.visible).toBe(true);
    expect(result.current.hasDroppedData).toBe(true);
  });

  it('has no dropped data when meta has no dropped annotations', () => {
    const {result} = renderHookWithProviders(
      () => useDroppedData({...meta, droppedAnnotations: []}),
      {organization}
    );

    expect(result.current.hasDroppedData).toBe(false);
  });

  it('hides the band when showDroppedData is turned off', () => {
    const {result} = renderHookWithProviders(() => useDroppedData(meta), {
      organization,
    });

    act(() => result.current.setShowDroppedData(false));

    expect(result.current.showDroppedData).toBe(false);
    expect(result.current.chartProps.visible).toBe(false);
  });
});
