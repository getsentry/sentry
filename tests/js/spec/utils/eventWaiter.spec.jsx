import {mountWithTheme} from 'sentry-test/enzyme';

import EventWaiter from 'sentry/utils/eventWaiter';

jest.useFakeTimers();

describe('EventWaiter', function () {
  it('waits for the first projet event', async function () {
    const org = TestStubs.Organization();
    const project = TestStubs.ProjectDetails({
      firstEvent: null,
    });

    // Start with a project *without* a first event
    const projectApiMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });

    const child = jest.fn().mockReturnValue(null);

    mountWithTheme(
      <EventWaiter
        api={new MockApiClient()}
        organization={org}
        project={project}
        eventType="error"
        pollInterval={10}
      >
        {child}
      </EventWaiter>
    );

    expect(child).toHaveBeenCalledWith({firstIssue: null});

    // Add the first events and associated responses and tick the timer
    project.firstEvent = '2019-05-01T00:00:00.000Z';

    const events = [
      {
        id: 1,
        firstSeen: project.firstEvent,
      },
      {
        id: 2,
        firstSeen: null,
      },
    ];

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/issues/`,
      method: 'GET',
      body: events,
    });

    child.mockClear();

    // Advanced time for the first setInterval tick to occur
    jest.advanceTimersByTime(1);

    // We have to await *two* API calls. We could normally do this using tick(),
    // however since we have enabled fake timers, we cannot tick.
    await Promise.resolve();
    await Promise.resolve();

    expect(child).toHaveBeenCalledWith({firstIssue: events[0]});

    // Check that the polling has stopped
    projectApiMock.mockClear();

    jest.advanceTimersByTime(10);
    expect(projectApiMock).not.toHaveBeenCalled();
  });

  it('receives a first event of `true` when first even has expired', async function () {
    const org = TestStubs.Organization();
    const project = TestStubs.ProjectDetails({
      firstEvent: '2019-05-01T00:00:00.000Z',
    });

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });

    // No events to list
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/issues/`,
      method: 'GET',
      body: [],
    });

    const child = jest.fn().mockReturnValue(null);

    mountWithTheme(
      <EventWaiter
        api={new MockApiClient()}
        organization={org}
        project={project}
        eventType="error"
        pollInterval={10}
      >
        {child}
      </EventWaiter>
    );

    // We have to await *two* API calls. We could normally do this using tick(),
    // however since we have enabled fake timers, we cannot tick.
    await Promise.resolve();
    await Promise.resolve();

    expect(child).toHaveBeenCalledWith({firstIssue: true});
  });

  it('does not poll when disabled', function () {
    const org = TestStubs.Organization();
    const project = TestStubs.ProjectDetails();

    const projectApiMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });

    // No events to list
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/issues/`,
      method: 'GET',
      body: [],
    });

    const child = jest.fn().mockReturnValue(null);

    mountWithTheme(
      <EventWaiter
        api={new MockApiClient()}
        organization={org}
        project={project}
        eventType="error"
        pollInterval={10}
        disabled
      >
        {child}
      </EventWaiter>
    );

    expect(child).toHaveBeenCalledWith({firstIssue: null});

    // Ensure we do not call it again
    projectApiMock.mockClear();
    jest.advanceTimersByTime(10);
    expect(projectApiMock).not.toHaveBeenCalled();
  });
});
