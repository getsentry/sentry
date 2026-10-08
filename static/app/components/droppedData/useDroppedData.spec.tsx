import {DroppedEventFixture} from 'sentry-fixture/droppedEvent';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useDroppedData} from 'sentry/components/droppedData/useDroppedData';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {DiscoverDatasets} from 'sentry/utils/discover/types';

const organization = OrganizationFixture({
  features: ['explore-data-fidelity-annotations'],
});

const droppedEvents = [DroppedEventFixture({count: 10})];
const acceptedEvents = [DroppedEventFixture({outcome: 'accepted', count: 90})];

function droppedEventsBody() {
  return {
    meta: {dataset: 'spans', start: 0, end: 0, interval: 0},
    droppedEvents,
    acceptedEvents,
  };
}

describe('useDroppedData', () => {
  beforeEach(() => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
  });

  afterEach(() => {
    PageFiltersStore.reset();
  });

  it('requests dropped events and returns them', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-dropped/`,
      body: droppedEventsBody(),
    });

    const {result} = renderHookWithProviders(
      () => useDroppedData({dataset: DiscoverDatasets.SPANS}),
      {organization}
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(request).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events-dropped/`,
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: DiscoverDatasets.SPANS,
          referrer: 'api.explore.dropped-data-annotations',
        }),
      })
    );
    expect(request.mock.calls[0][1].query).not.toHaveProperty('yAxis');
    expect(result.current.droppedEvents).toEqual(droppedEvents);
    expect(result.current.acceptedEvents).toEqual(acceptedEvents);
  });

  it('requests trace metrics without a chart aggregate', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-dropped/`,
      body: droppedEventsBody(),
    });

    const {result} = renderHookWithProviders(
      () => useDroppedData({dataset: DiscoverDatasets.TRACEMETRICS}),
      {organization}
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(request).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events-dropped/`,
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: DiscoverDatasets.TRACEMETRICS,
          referrer: 'api.explore.dropped-data-annotations',
        }),
      })
    );
    expect(request.mock.calls[0][1].query).not.toHaveProperty('yAxis');
    expect(result.current.droppedEvents).toEqual(droppedEvents);
  });

  it('does not request dropped events without the feature flag', () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-dropped/`,
      body: droppedEventsBody(),
    });

    const {result} = renderHookWithProviders(
      () => useDroppedData({dataset: DiscoverDatasets.SPANS}),
      {organization: OrganizationFixture({features: []})}
    );

    expect(request).not.toHaveBeenCalled();
    expect(result.current.droppedEvents).toBeUndefined();
  });
});
