import {AnnotationFixture} from 'sentry-fixture/annotation';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useDroppedData} from 'sentry/components/droppedData/useDroppedData';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {DiscoverDatasets} from 'sentry/utils/discover/types';

const organization = OrganizationFixture({
  features: ['explore-data-fidelity-annotations'],
});

const droppedAnnotations = [AnnotationFixture({eventCount: 10})];
const acceptedAnnotations = [AnnotationFixture({outcome: 'accepted', eventCount: 90})];

describe('useDroppedData', () => {
  beforeEach(() => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
  });

  afterEach(() => {
    PageFiltersStore.reset();
  });

  it('requests annotations and returns them', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      body: {
        timeSeries: [],
        meta: {droppedAnnotations, acceptedAnnotations},
      },
    });

    const {result} = renderHookWithProviders(
      () => useDroppedData({dataset: DiscoverDatasets.SPANS}),
      {organization}
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(request).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events-timeseries/`,
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: DiscoverDatasets.SPANS,
          includeAnnotations: 1,
          referrer: 'api.explore.dropped-data-annotations',
        }),
      })
    );
    expect(result.current.droppedAnnotations).toEqual(droppedAnnotations);
    expect(result.current.acceptedAnnotations).toEqual(acceptedAnnotations);
  });

  it('does not request annotations without the feature flag', () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      body: {timeSeries: [], meta: {}},
    });

    const {result} = renderHookWithProviders(
      () => useDroppedData({dataset: DiscoverDatasets.SPANS}),
      {organization: OrganizationFixture({features: []})}
    );

    expect(request).not.toHaveBeenCalled();
    expect(result.current.droppedAnnotations).toBeUndefined();
  });
});
