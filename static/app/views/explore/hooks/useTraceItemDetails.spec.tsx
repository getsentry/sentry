import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  act,
  render,
  renderHookWithProviders,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {
  useTraceItemDetails,
  usePrefetchTraceItemDetailsOnHover,
  usePrefetchTraceItemDetailsOnMount,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceItemDataset} from 'sentry/views/explore/types';

const HOVER_TIMEOUT = 150;

describe('useTraceItemDetails', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({id: '1', slug: 'project-slug'});

  function HoverPrefetchTarget({
    sharedHoverTimeoutRef,
  }: {
    sharedHoverTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  }) {
    const {hoverProps} = usePrefetchTraceItemDetailsOnHover({
      projectId: project.id,
      traceItemId: 'item-id',
      traceId: '1234567890abcdef1234567890abcdef',
      traceItemType: TraceItemDataset.LOGS,
      referrer: 'api.explore.log-item-details',
      timestamp: 123,
      sharedHoverTimeoutRef,
      timeout: HOVER_TIMEOUT,
    });

    return <div {...hoverProps} data-test-id="hover-prefetch-target" />;
  }

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

  it('keeps details cached separately for each opaque routing hint', async () => {
    const request = addTraceItemDetailsMock();
    const initialProps: {routingHint?: string} = {};
    const {result, rerender} = renderHookWithProviders(
      ({routingHint}: {routingHint?: string}) =>
        useTraceItemDetails({
          projectId: project.id,
          traceItemId: 'item-id',
          traceId: '1234567890abcdef1234567890abcdef',
          traceItemType: TraceItemDataset.LOGS,
          referrer: 'api.explore.log-item-details',
          timestamp: 123,
          routingHint,
        }),
      {organization, initialProps}
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(request.mock.calls[0]![1].query).not.toHaveProperty('routing_hint');

    rerender({routingHint: ' opaque+/== '});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]![1].query).toMatchObject({
      routing_hint: ' opaque+/== ',
      timestamp: 123,
    });

    rerender({routingHint: 'second-hint'});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls[2]![1].query.routing_hint).toBe('second-hint');

    rerender({routingHint: ' opaque+/== '});
    expect(result.current.isSuccess).toBe(true);
    rerender({routingHint: ''});
    expect(result.current.isSuccess).toBe(true);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it.each(['prefetch', 'fetchTraceItemDetails'] as const)(
    'shares hinted details from %s with the expanded item',
    async method => {
      const request = addTraceItemDetailsMock();
      const props = {
        projectId: project.id,
        traceItemId: 'item-id',
        traceId: '1234567890abcdef1234567890abcdef',
        traceItemType: TraceItemDataset.LOGS,
        referrer: 'api.explore.log-item-details',
        timestamp: 123,
        routingHint: 'opaque+/==',
      };
      const {result, rerender} = renderHookWithProviders(
        ({expanded}: {expanded: boolean}) => ({
          hover: usePrefetchTraceItemDetailsOnHover({
            ...props,
            sharedHoverTimeoutRef: {current: null},
            timeout: 0,
          }),
          details: useTraceItemDetails({...props, enabled: expanded}),
        }),
        {organization, initialProps: {expanded: false}}
      );

      await act(async () => {
        await result.current.hover[method]();
      });
      await waitFor(() => expect(result.current.details.isSuccess).toBe(true));
      rerender({expanded: true});
      expect(request).toHaveBeenCalledTimes(1);
      expect(request.mock.calls[0]![1].query.routing_hint).toBe(props.routingHint);
    }
  );

  it('surfaces invalid hinted requests without retrying against default storage', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/trace-items/item-id/`,
      statusCode: 400,
      body: {detail: 'Invalid trace item details request.'},
    });
    const {result} = renderHookWithProviders(useTraceItemDetails, {
      organization,
      initialProps: {
        projectId: project.id,
        traceItemId: 'item-id',
        traceId: '1234567890abcdef1234567890abcdef',
        traceItemType: TraceItemDataset.LOGS,
        referrer: 'api.explore.log-item-details',
        timestamp: 123,
        routingHint: 'invalid',
      },
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]![1].query.routing_hint).toBe('invalid');
  });

  it('uses timestamp instead of page filter datetime when timestamp is passed', async () => {
    initializePageFilters({period: '14d', start: null, end: null, utc: false});
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
    expect(traceItemDetailsMock.mock.calls[0]![1].query).toMatchObject({timestamp: 123});
    expect(traceItemDetailsMock.mock.calls[0]![1].query).not.toHaveProperty(
      'statsPeriod'
    );
    expect(traceItemDetailsMock.mock.calls[0]![1].query).not.toHaveProperty('start');
    expect(traceItemDetailsMock.mock.calls[0]![1].query).not.toHaveProperty('end');
    expect(traceItemDetailsMock.mock.calls[0]![1].query).not.toHaveProperty('utc');
  });

  it('uses page filter relative datetime when timestamp is not passed', async () => {
    initializePageFilters({period: '14d', start: null, end: null, utc: false});
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
    initializePageFilters({period: '14d', start: null, end: null, utc: false});
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
    initializePageFilters({period: '14d', start: null, end: null, utc: false});
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
    expect(traceItemDetailsMock.mock.calls[0]![1].query).toMatchObject({timestamp: 0});
    expect(traceItemDetailsMock.mock.calls[0]![1].query).not.toHaveProperty(
      'statsPeriod'
    );
  });

  it('fetches details when the hover prefetch is invoked', async () => {
    initializePageFilters({period: '14d', start: null, end: null, utc: false});
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

  it('reports pending only while the prefetched details request is in flight', async () => {
    initializePageFilters({period: '14d', start: null, end: null, utc: false});
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/projects/${organization.slug}/${project.slug}/trace-items/item-id/`,
      asyncDelay: 100,
      body: {
        itemId: 'item-id',
        links: null,
        meta: {},
        timestamp: '2025-04-03T15:50:10.000Z',
        attributes: [],
      },
    });

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
    expect(result.current.isTraceItemDetailsPending).toBe(false);

    act(() => result.current.prefetch());
    await waitFor(() => expect(result.current.isTraceItemDetailsPending).toBe(true));
    await waitFor(() => expect(result.current.isTraceItemDetailsPending).toBe(false));
  });

  it('does not fetch details when the hovered element unmounts before the hover timeout elapses', async () => {
    jest.useFakeTimers();
    initializePageFilters({period: '14d', start: null, end: null, utc: false});
    const traceItemDetailsMock = addTraceItemDetailsMock();
    const sharedHoverTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null> = {
      current: null,
    };

    const {unmount} = render(
      <HoverPrefetchTarget sharedHoverTimeoutRef={sharedHoverTimeoutRef} />,
      {organization}
    );

    await userEvent.hover(screen.getByTestId('hover-prefetch-target'), {delay: null});
    unmount();
    act(() => {
      jest.advanceTimersByTime(HOVER_TIMEOUT * 10);
    });

    expect(traceItemDetailsMock).not.toHaveBeenCalled();
    expect(sharedHoverTimeoutRef.current).toBeNull();
    jest.useRealTimers();
  });

  it('fetches details when the hovered element stays mounted past the hover timeout', async () => {
    jest.useFakeTimers();
    initializePageFilters({period: '14d', start: null, end: null, utc: false});
    const traceItemDetailsMock = addTraceItemDetailsMock();

    render(<HoverPrefetchTarget sharedHoverTimeoutRef={{current: null}} />, {
      organization,
    });

    await waitFor(() => expect(ProjectsStore.getState().projects).toHaveLength(1));
    await userEvent.hover(screen.getByTestId('hover-prefetch-target'), {delay: null});
    act(() => {
      jest.advanceTimersByTime(HOVER_TIMEOUT + 1);
    });

    await waitFor(() => expect(traceItemDetailsMock).toHaveBeenCalledTimes(1));
    // Flush the .then() callback that reads cached data after prefetch
    await act(async () => {});
    jest.useRealTimers();
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
