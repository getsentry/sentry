import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {
  useTraceItemDetails,
  usePrefetchTraceItemDetailsOnHover,
  usePrefetchTraceItemDetailsOnMount,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceItemDataset} from 'sentry/views/explore/types';

describe('useTraceItemDetails', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({id: '1', slug: 'project-slug'});

  function initializePageFilters(
    datetime: Parameters<typeof PageFiltersStore.onInitializeUrlState>[0]['datetime']
  ) {
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [Number(project.id)],
      environments: [],
      datetime,
    });
  }

  function addTraceItemDetailsMock() {
    return MockApiClient.addMockResponse({
      method: 'GET',
      url: `/projects/${organization.slug}/${project.slug}/trace-items/item-id/`,
      body: {
        itemId: 'item-id',
        links: null,
        meta: {},
        timestamp: '2025-04-03T15:50:10.000Z',
        attributes: [],
      },
    });
  }

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('uses timestamp instead of page filter datetime when timestamp is passed', async () => {
    initializePageFilters({
      period: '14d',
      start: null,
      end: null,
      utc: false,
    });
    const traceItemDetailsMock = addTraceItemDetailsMock();

    renderHookWithProviders(useTraceItemDetails, {
      organization,
      initialProps: {
        projectId: project.id,
        traceItemId: 'item-id',
        traceId: '1234567890abcdef1234567890abcdef',
        traceItemType: TraceItemDataset.LOGS,
        referrer: 'api.explore.log-item-details',
        timestamp: 123,
      },
    });

    await waitFor(() => expect(traceItemDetailsMock).toHaveBeenCalledTimes(1));
    expect(traceItemDetailsMock.mock.calls[0]![1].query).toMatchObject({
      timestamp: 123,
    });
    expect(traceItemDetailsMock.mock.calls[0]![1].query).not.toHaveProperty(
      'statsPeriod'
    );
    expect(traceItemDetailsMock.mock.calls[0]![1].query).not.toHaveProperty('start');
    expect(traceItemDetailsMock.mock.calls[0]![1].query).not.toHaveProperty('end');
    expect(traceItemDetailsMock.mock.calls[0]![1].query).not.toHaveProperty('utc');
  });

  it('uses page filter relative datetime when timestamp is not passed', async () => {
    initializePageFilters({
      period: '14d',
      start: null,
      end: null,
      utc: false,
    });
    const traceItemDetailsMock = addTraceItemDetailsMock();

    renderHookWithProviders(useTraceItemDetails, {
      organization,
      initialProps: {
        projectId: project.id,
        traceItemId: 'item-id',
        traceId: '1234567890abcdef1234567890abcdef',
        traceItemType: TraceItemDataset.LOGS,
        referrer: 'api.explore.log-item-details',
      },
    });

    await waitFor(() => expect(traceItemDetailsMock).toHaveBeenCalledTimes(1));
    expect(traceItemDetailsMock.mock.calls[0]![1].query).toMatchObject({
      statsPeriod: '14d',
    });
    expect(traceItemDetailsMock.mock.calls[0]![1].query).not.toHaveProperty('timestamp');
  });

  it('uses page filter stats period as fallback when timestamp is null', async () => {
    initializePageFilters({
      period: '14d',
      start: null,
      end: null,
      utc: false,
    });
    const traceItemDetailsMock = addTraceItemDetailsMock();

    renderHookWithProviders(useTraceItemDetails, {
      organization,
      initialProps: {
        projectId: project.id,
        traceItemId: 'item-id',
        traceId: '1234567890abcdef1234567890abcdef',
        traceItemType: TraceItemDataset.LOGS,
        referrer: 'api.explore.log-item-details',
        timestamp: null,
      },
    });

    await waitFor(() => expect(traceItemDetailsMock).toHaveBeenCalledTimes(1));
    expect(traceItemDetailsMock.mock.calls[0]![1].query).toMatchObject({
      statsPeriod: '14d',
    });
    expect(traceItemDetailsMock.mock.calls[0]![1].query).not.toHaveProperty('timestamp');
  });

  it('uses page filter absolute datetime when timestamp is not passed', async () => {
    initializePageFilters({
      period: null,
      start: '2025-04-03T15:00:00.000Z',
      end: '2025-04-03T16:00:00.000Z',
      utc: true,
    });
    const traceItemDetailsMock = addTraceItemDetailsMock();

    renderHookWithProviders(useTraceItemDetails, {
      organization,
      initialProps: {
        projectId: project.id,
        traceItemId: 'item-id',
        traceId: '1234567890abcdef1234567890abcdef',
        traceItemType: TraceItemDataset.LOGS,
        referrer: 'api.explore.log-item-details',
      },
    });

    await waitFor(() => expect(traceItemDetailsMock).toHaveBeenCalledTimes(1));
    expect(traceItemDetailsMock.mock.calls[0]![1].query).toMatchObject({
      start: '2025-04-03T15:00:00.000',
      end: '2025-04-03T16:00:00.000',
      utc: 'true',
    });
    expect(traceItemDetailsMock.mock.calls[0]![1].query).not.toHaveProperty('timestamp');
    expect(traceItemDetailsMock.mock.calls[0]![1].query).not.toHaveProperty(
      'statsPeriod'
    );
  });

  it('passes zero as a valid timestamp', async () => {
    initializePageFilters({
      period: '14d',
      start: null,
      end: null,
      utc: false,
    });
    const traceItemDetailsMock = addTraceItemDetailsMock();

    renderHookWithProviders(useTraceItemDetails, {
      organization,
      initialProps: {
        projectId: project.id,
        traceItemId: 'item-id',
        traceId: '1234567890abcdef1234567890abcdef',
        traceItemType: TraceItemDataset.LOGS,
        referrer: 'api.explore.log-item-details',
        timestamp: 0,
      },
    });

    await waitFor(() => expect(traceItemDetailsMock).toHaveBeenCalledTimes(1));
    expect(traceItemDetailsMock.mock.calls[0]![1].query).toMatchObject({
      timestamp: 0,
    });
    expect(traceItemDetailsMock.mock.calls[0]![1].query).not.toHaveProperty(
      'statsPeriod'
    );
  });

  it('fetches details when the hover prefetch is invoked', async () => {
    initializePageFilters({
      period: '14d',
      start: null,
      end: null,
      utc: false,
    });
    const traceItemDetailsMock = addTraceItemDetailsMock();

    const {result} = renderHookWithProviders(usePrefetchTraceItemDetailsOnHover, {
      organization,
      initialProps: {
        projectId: project.id,
        traceItemId: 'item-id',
        traceId: '1234567890abcdef1234567890abcdef',
        traceItemType: TraceItemDataset.LOGS,
        referrer: 'api.explore.log-item-details',
        timestamp: 123,
        sharedHoverTimeoutRef: {current: null},
        timeout: 0,
      },
    });

    await waitFor(() => expect(ProjectsStore.getState().projects).toHaveLength(1));
    act(() => result.current.prefetch());

    await waitFor(() => expect(traceItemDetailsMock).toHaveBeenCalledTimes(1));
  });

  it('runs the prefetch on mount when enabled and the project is ready', () => {
    const prefetch = jest.fn();

    renderHookWithProviders(usePrefetchTraceItemDetailsOnMount, {
      organization,
      initialProps: {prefetch, enabled: true, isProjectReady: true},
    });

    expect(prefetch).toHaveBeenCalledTimes(1);
  });

  it('does not run the prefetch on mount when not enabled', () => {
    const prefetch = jest.fn();

    renderHookWithProviders(usePrefetchTraceItemDetailsOnMount, {
      organization,
      initialProps: {prefetch, enabled: false, isProjectReady: true},
    });

    expect(prefetch).not.toHaveBeenCalled();
  });

  it('does not run the prefetch on mount until the project is ready', () => {
    const prefetch = jest.fn();

    renderHookWithProviders(usePrefetchTraceItemDetailsOnMount, {
      organization,
      initialProps: {prefetch, enabled: true, isProjectReady: false},
    });

    expect(prefetch).not.toHaveBeenCalled();
  });
});
