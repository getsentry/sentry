import {AnnotationFixture} from 'sentry-fixture/annotation';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useDroppedData} from 'sentry/components/droppedData/useDroppedData';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {DiscoverDatasets} from 'sentry/utils/discover/types';

const organization = OrganizationFixture({
  features: ['explore-data-fidelity-annotations'],
});

const dropped = [AnnotationFixture({eventCount: 10})];
const accepted = [AnnotationFixture({outcome: 'accepted', eventCount: 90})];

const droppedDataOptions = {
  dataset: DiscoverDatasets.SPANS,
  interval: '1h',
};

function mockAnnotations({
  droppedAnnotations = dropped,
  acceptedAnnotations = accepted,
}: {
  acceptedAnnotations?: typeof accepted;
  droppedAnnotations?: typeof dropped;
} = {}) {
  return MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events-annotations/',
    method: 'GET',
    body: {
      meta: {dataset: 'spans', start: 0, end: 60_000, interval: 60_000},
      droppedAnnotations,
      acceptedAnnotations,
    },
  });
}

describe('useDroppedData', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    const project = ProjectFixture();
    ProjectsStore.loadInitialData([project]);
    PageFiltersStore.onInitializeUrlState({
      projects: [parseInt(project.id, 10)],
      environments: [],
      datetime: {period: '7d', start: null, end: null, utc: null},
    });
  });

  it('does not fetch without the feature flag', () => {
    const request = mockAnnotations();

    const {result} = renderHookWithProviders(() => useDroppedData(droppedDataOptions), {
      organization: OrganizationFixture({features: []}),
    });

    expect(result.current.chartProps.dropped).toBeUndefined();
    expect(result.current.chartProps.accepted).toBeUndefined();
    expect(result.current.hasDroppedData).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it('passes annotations from the endpoint to the chart', async () => {
    mockAnnotations();

    const {result} = renderHookWithProviders(() => useDroppedData(droppedDataOptions), {
      organization,
    });

    await waitFor(() => expect(result.current.hasDroppedData).toBe(true));
    expect(result.current.chartProps.dropped).toEqual(dropped);
    expect(result.current.chartProps.accepted).toEqual(accepted);
    expect(result.current.chartProps.visible).toBe(true);
  });

  it('has no dropped data when the endpoint returns no dropped annotations', async () => {
    const request = mockAnnotations({droppedAnnotations: []});

    const {result} = renderHookWithProviders(() => useDroppedData(droppedDataOptions), {
      organization,
    });

    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(result.current.hasDroppedData).toBe(false);
  });

  it('hides the band when showDroppedData is turned off', async () => {
    mockAnnotations();

    const {result} = renderHookWithProviders(() => useDroppedData(droppedDataOptions), {
      organization,
    });

    await waitFor(() => expect(result.current.hasDroppedData).toBe(true));

    act(() => result.current.setShowDroppedData(false));

    expect(result.current.showDroppedData).toBe(false);
    expect(result.current.chartProps.visible).toBe(false);
  });
});
