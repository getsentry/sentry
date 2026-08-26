import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {useEventWaiter} from 'sentry/utils/useEventWaiter';

describe('useEventWaiter', () => {
  beforeEach(() => {
    ProjectsStore.reset();
  });

  it('waits for the first project event and resolves the matching issue', async () => {
    const org = OrganizationFixture();
    const project = ProjectFixture({firstEvent: null});

    // Start with a project *without* a first event
    const projectApiMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });

    const {result} = renderHookWithProviders(
      () =>
        useEventWaiter({
          eventType: 'error',
          organization: org,
          project,
          pollInterval: 100,
        }),
      {organization: org}
    );

    // Initially null
    expect(result.current).toBeNull();

    // Simulate first event arriving on subsequent poll
    const events = [
      {id: 1, firstSeen: '2019-05-01T00:00:00.000Z'},
      {id: 2, firstSeen: null},
    ];

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: ProjectFixture({firstEvent: '2019-05-01T00:00:00.000Z'}),
    });

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/issues/`,
      method: 'GET',
      body: events,
    });

    // Wait for the hook to resolve the first issue
    await waitFor(() => {
      expect(result.current).toEqual(events[0]);
    });

    // Verify polling stops after resolution
    projectApiMock.mockClear();
  });

  it('returns true when first event has expired (no matching issue)', async () => {
    const org = OrganizationFixture();
    const project = ProjectFixture({firstEvent: '2019-05-01T00:00:00.000Z'});

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });

    // No matching issues
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/issues/`,
      method: 'GET',
      body: [],
    });

    const {result} = renderHookWithProviders(
      () =>
        useEventWaiter({
          eventType: 'error',
          organization: org,
          project,
          pollInterval: 100,
        }),
      {organization: org}
    );

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('returns true for transaction events', async () => {
    const org = OrganizationFixture();
    const project = ProjectFixture({firstTransactionEvent: true});

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });

    const {result} = renderHookWithProviders(
      () =>
        useEventWaiter({
          eventType: 'transaction',
          organization: org,
          project,
          pollInterval: 100,
        }),
      {organization: org}
    );

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('does not poll when disabled', () => {
    const org = OrganizationFixture();
    const project = ProjectFixture();

    const projectApiMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });

    const {result} = renderHookWithProviders(
      () =>
        useEventWaiter({
          eventType: 'error',
          organization: org,
          project,
          disabled: true,
          pollInterval: 100,
        }),
      {organization: org}
    );

    expect(result.current).toBeNull();
    expect(projectApiMock).not.toHaveBeenCalled();
  });

  it('stops polling after first event is detected', async () => {
    jest.useFakeTimers();

    const org = OrganizationFixture();
    const project = ProjectFixture({firstEvent: null});

    // API returns a project with firstTransactionEvent already set
    const projectApiMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: ProjectFixture({firstTransactionEvent: true}),
    });

    const {result} = renderHookWithProviders(
      () =>
        useEventWaiter({
          eventType: 'transaction',
          organization: org,
          project,
          pollInterval: 100,
        }),
      {organization: org}
    );

    // Flush the initial fetch
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });

    expect(result.current).toBe(true);
    expect(projectApiMock).toHaveBeenCalledTimes(1);

    // Advance well past multiple poll intervals
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });

    // Polling should have stopped — no calls beyond the initial fetch
    expect(projectApiMock).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it.each([
    ['transaction', 'firstTransactionEvent'],
    ['log', 'hasLogs'],
    ['profile', 'hasProfiles'],
    ['replay', 'hasReplays'],
  ] as const)(
    'writes %s first-event flag back to ProjectsStore when polling detects it',
    async (eventType, field) => {
      const org = OrganizationFixture();
      const project = ProjectFixture({[field]: false});
      act(() => ProjectsStore.loadInitialData([project]));

      expect(ProjectsStore.getById(project.id)?.[field]).toBe(false);

      MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/`,
        method: 'GET',
        body: ProjectFixture({
          id: project.id,
          slug: project.slug,
          [field]: true,
        }),
      });

      const {result} = renderHookWithProviders(
        () =>
          useEventWaiter({
            eventType,
            organization: org,
            project,
            pollInterval: 100,
          }),
        {organization: org}
      );

      await waitFor(() => {
        expect(result.current).toBe(true);
      });

      await waitFor(() => {
        expect(ProjectsStore.getById(project.id)?.[field]).toBe(true);
      });
    }
  );

  it('writes firstEvent back to ProjectsStore when polling detects an error event', async () => {
    const org = OrganizationFixture();
    const project = ProjectFixture({firstEvent: null});
    act(() => ProjectsStore.loadInitialData([project]));

    const firstEvent = '2019-05-01T00:00:00.000Z';

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: ProjectFixture({
        id: project.id,
        slug: project.slug,
        firstEvent,
      }),
    });

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/issues/`,
      method: 'GET',
      body: [{id: 1, firstSeen: firstEvent}],
    });

    const {result} = renderHookWithProviders(
      () =>
        useEventWaiter({
          eventType: 'error',
          organization: org,
          project,
          pollInterval: 100,
        }),
      {organization: org}
    );

    await waitFor(() => {
      expect(result.current).toEqual({id: 1, firstSeen: firstEvent});
    });

    await waitFor(() => {
      expect(ProjectsStore.getById(project.id)?.firstEvent).toBe(firstEvent);
    });
  });

  it('does not rewrite ProjectsStore when the first-event flag is already true', async () => {
    const org = OrganizationFixture();
    const project = ProjectFixture({firstTransactionEvent: true});
    act(() => ProjectsStore.loadInitialData([project]));

    const onUpdateSuccess = jest.spyOn(ProjectsStore, 'onUpdateSuccess');

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: ProjectFixture({
        id: project.id,
        slug: project.slug,
        firstTransactionEvent: true,
      }),
    });

    const {result} = renderHookWithProviders(
      () =>
        useEventWaiter({
          eventType: 'transaction',
          organization: org,
          project,
          pollInterval: 100,
        }),
      {organization: org}
    );

    await waitFor(() => {
      expect(result.current).toBe(true);
    });

    expect(onUpdateSuccess).not.toHaveBeenCalled();
    onUpdateSuccess.mockRestore();
  });

  it('does not write ProjectsStore when the project is not in the store', async () => {
    const org = OrganizationFixture();
    const project = ProjectFixture({firstTransactionEvent: false});

    const onUpdateSuccess = jest.spyOn(ProjectsStore, 'onUpdateSuccess');

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: ProjectFixture({
        id: project.id,
        slug: project.slug,
        firstTransactionEvent: true,
      }),
    });

    const {result} = renderHookWithProviders(
      () =>
        useEventWaiter({
          eventType: 'transaction',
          organization: org,
          project,
          pollInterval: 100,
        }),
      {organization: org}
    );

    await waitFor(() => {
      expect(result.current).toBe(true);
    });

    expect(onUpdateSuccess).not.toHaveBeenCalled();
    expect(ProjectsStore.getById(project.id)).toBeUndefined();
    onUpdateSuccess.mockRestore();
  });
});
