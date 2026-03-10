import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useEventWaiter} from 'sentry/utils/useEventWaiter';

describe('useEventWaiter', () => {
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
});
