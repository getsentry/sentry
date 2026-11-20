import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  act,
  cleanup,
  renderHookWithProviders,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import {useRecentCreatedProject} from './useRecentCreatedProject';

describe('useRecentCreatedProject', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({
    slug: 'my-project',
    firstEvent: null,
    dateCreated: new Date().toISOString(),
  });
  const overviewUrl = `/projects/${organization.slug}/${project.slug}/overview/`;

  function renderPollingHook() {
    return renderHookWithProviders(useRecentCreatedProject, {
      initialProps: {
        orgSlug: organization.slug,
        projectSlug: project.slug,
        pollUntilFirstEvent: true,
      },
      organization,
    });
  }

  beforeEach(() => {
    jest.useFakeTimers();
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);
  });

  afterEach(() => {
    try {
      cleanup();
      jest.runOnlyPendingTimers();
    } finally {
      jest.useRealTimers();
    }
  });

  it('polls until the first event arrives', async () => {
    const pendingRequest = MockApiClient.addMockResponse({
      url: overviewUrl,
      body: project,
    });

    const {result} = renderPollingHook();

    await waitFor(() => expect(pendingRequest).toHaveBeenCalledTimes(1));
    await act(() => jest.advanceTimersByTimeAsync(1000));
    expect(pendingRequest).toHaveBeenCalledTimes(2);

    const firstEvent = new Date().toISOString();
    MockApiClient.addMockResponse({url: overviewUrl, body: {...project, firstEvent}});
    await act(() => jest.advanceTimersByTimeAsync(1000));

    await waitFor(() => expect(result.current.project?.firstEvent).toBe(firstEvent));
    expect(result.current.isProjectActive).toBe(true);
  });

  it('keeps polling when the first fetch fails with a server error', async () => {
    const failedRequest = MockApiClient.addMockResponse({
      url: overviewUrl,
      statusCode: 500,
    });

    const {result} = renderPollingHook();

    await waitFor(() => expect(failedRequest).toHaveBeenCalledTimes(1));

    const firstEvent = new Date().toISOString();
    const recoveredRequest = MockApiClient.addMockResponse({
      url: overviewUrl,
      body: {...project, firstEvent},
    });
    await act(() => jest.advanceTimersByTimeAsync(1000));

    expect(recoveredRequest).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.project?.firstEvent).toBe(firstEvent));
  });

  it('stops polling when the first fetch fails with a client error', async () => {
    const notFoundRequest = MockApiClient.addMockResponse({
      url: overviewUrl,
      statusCode: 404,
    });

    const {result} = renderPollingHook();

    await waitFor(() => expect(notFoundRequest).toHaveBeenCalledTimes(1));
    await act(() => jest.advanceTimersByTimeAsync(5000));

    expect(notFoundRequest).toHaveBeenCalledTimes(1);
    expect(result.current.project).toEqual(project);
  });
});
