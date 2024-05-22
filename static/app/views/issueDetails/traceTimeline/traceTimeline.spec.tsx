import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';

import {TraceTimeline} from './traceTimeline';
import type {TraceEventResponse} from './useTraceTimelineEvents';

jest.mock('sentry/utils/routeAnalytics/useRouteAnalyticsParams');

describe('TraceTimeline', () => {
  const organization = OrganizationFixture();
  const event = EventFixture({
    dateCreated: '2024-01-24T09:09:03+00:00',
    contexts: {
      trace: {
        trace_id: '123',
      },
    },
  });
  const project = ProjectFixture();

  const emptyBody: TraceEventResponse = {data: [], meta: {fields: {}, units: {}}};
  const issuePlatformBody: TraceEventResponse = {
    data: [
      {
        timestamp: '2024-01-24T09:09:03+00:00',
        'issue.id': 1000,
        project: project.slug,
        'project.name': project.name,
        title: 'Slow DB Query',
        id: 'abc',
        transaction: '/api/slow/',
      },
    ],
    meta: {fields: {}, units: {}},
  };
  const discoverBody: TraceEventResponse = {
    data: [
      {
        timestamp: '2024-01-23T22:11:42+00:00',
        'issue.id': 4909507143,
        project: project.slug,
        'project.name': project.name,
        title: 'AttributeError: Something Failed',
        id: event.id,
        transaction: 'important.task',
        'event.type': 'error',
        'stack.function': ['important.task', 'task.run'],
      },
    ],
    meta: {fields: {}, units: {}},
  };

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
    jest.clearAllMocks();
  });

  it('renders items and highlights the current event', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: issuePlatformBody,
      match: [MockApiClient.matchQuery({dataset: 'issuePlatform'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: discoverBody,
      match: [MockApiClient.matchQuery({dataset: 'discover'})],
    });
    render(<TraceTimeline event={event} />, {organization});
    expect(await screen.findByLabelText('Current Event')).toBeInTheDocument();

    await userEvent.hover(screen.getByTestId('trace-timeline-tooltip-1'));
    expect(await screen.findByText('You are here')).toBeInTheDocument();
    expect(useRouteAnalyticsParams).toHaveBeenCalledWith({
      trace_timeline_status: 'shown',
    });
  });

  it('displays nothing if the only event is the current event', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: emptyBody,
      match: [MockApiClient.matchQuery({dataset: 'issuePlatform'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: discoverBody,
      match: [MockApiClient.matchQuery({dataset: 'discover'})],
    });
    const {container} = render(<TraceTimeline event={event} />, {organization});
    await waitFor(() =>
      expect(useRouteAnalyticsParams).toHaveBeenCalledWith({
        trace_timeline_status: 'empty',
      })
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('displays nothing if there are no events', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: emptyBody,
      match: [MockApiClient.matchQuery({dataset: 'issuePlatform'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: emptyBody,
      match: [MockApiClient.matchQuery({dataset: 'discover'})],
    });
    const {container} = render(<TraceTimeline event={event} />, {organization});
    await waitFor(() =>
      expect(useRouteAnalyticsParams).toHaveBeenCalledWith({
        trace_timeline_status: 'empty',
      })
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows seconds for very short timelines', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: issuePlatformBody,
      match: [MockApiClient.matchQuery({dataset: 'issuePlatform'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: emptyBody,
      match: [MockApiClient.matchQuery({dataset: 'discover'})],
    });
    render(<TraceTimeline event={event} />, {organization});
    // Checking for the presence of seconds
    expect(await screen.findAllByText(/\d{1,2}:\d{2}:\d{2} (AM|PM)/)).toHaveLength(5);
  });

  it('adds the current event if not in the api response', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: issuePlatformBody,
      match: [MockApiClient.matchQuery({dataset: 'issuePlatform'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: emptyBody,
      match: [MockApiClient.matchQuery({dataset: 'discover'})],
    });
    render(<TraceTimeline event={event} />, {organization});
    expect(await screen.findByLabelText('Current Event')).toBeInTheDocument();
  });

  it('skips the timeline and shows related issues (2 issues)', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: issuePlatformBody,
      match: [MockApiClient.matchQuery({dataset: 'issuePlatform'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: discoverBody,
      match: [MockApiClient.matchQuery({dataset: 'discover'})],
    });
    // I believe the call to projects is to determine what projects a user belongs to
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });

    // Enable related issues feature flag
    organization.features = ['related-issues-issue-details-page'];
    render(<TraceTimeline event={event} />, {organization});

    // Instead of a timeline, we should see related issues
    expect(await screen.findByText('Slow DB Query')).toBeInTheDocument();
    expect(
      await screen.findByText('AttributeError: Something Failed')
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Current Event')).not.toBeInTheDocument();
    expect(useRouteAnalyticsParams).toHaveBeenCalledWith({
      trace_timeline_status: 'empty',
    });
  });

  it('skips the timeline and shows NO related issues (only 1 issue)', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: emptyBody,
      match: [MockApiClient.matchQuery({dataset: 'issuePlatform'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      // Only 1 issue
      body: discoverBody,
      match: [MockApiClient.matchQuery({dataset: 'discover'})],
    });
    // I believe the call to projects is to determine what projects a user belongs to
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });

    // Enable related issues feature flag
    organization.features = ['related-issues-issue-details-page'];
    render(<TraceTimeline event={event} />, {organization});

    // We do not display any related issues because we only have 1 issue
    expect(await screen.queryByText('Slow DB Query')).not.toBeInTheDocument();
    expect(
      await screen.queryByText('AttributeError: Something Failed')
    ).not.toBeInTheDocument();

    // We do not display the timeline because we only have 1 event
    expect(await screen.queryByLabelText('Current Event')).not.toBeInTheDocument();
    expect(useRouteAnalyticsParams).toHaveBeenCalledWith({
      trace_timeline_status: 'empty',
    });
  });
});
