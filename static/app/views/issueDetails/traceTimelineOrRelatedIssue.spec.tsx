import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';

import {TraceTimeline} from './traceTimeline/traceTimeline';
import type {TraceEventResponse} from './traceTimeline/useTraceTimelineEvents';
import {TraceTimeLineOrRelatedIssue} from './traceTimelineOrRelatedIssue';

jest.mock('sentry/utils/routeAnalytics/useRouteAnalyticsParams');
jest.mock('sentry/utils/analytics');

describe('TraceTimeline & TraceRelated Issue', () => {
  // Paid plans have global-views enabled
  // Include project: -1 in all matchQuery calls to ensure we are looking at all projects
  const organization = OrganizationFixture({
    features: ['global-views'],
  });
  const firstEventTimestamp = '2024-01-24T09:09:01+00:00';
  // This creates the ApiException event
  const event = EventFixture({
    // This is used to determine the presence of seconds
    dateCreated: firstEventTimestamp,
    contexts: {
      trace: {
        // This is used to determine if we should attempt
        // to render the trace timeline
        trace_id: '123',
      },
    },
  });
  const project = ProjectFixture();

  const emptyBody: TraceEventResponse = {data: [], meta: {fields: {}, units: {}}};
  const issuePlatformBody: TraceEventResponse = {
    data: [
      {
        // In issuePlatform, the message contains the title and the transaction
        message: '/api/slow/ Slow DB Query SELECT "sentry_monitorcheckin"."monitor_id"',
        culprit: '/api/slow/', // Used for subtitle
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
  const mainError = {
    title: event.title,
    culprit: '/api/foo/', // Used for subtitle
    message: '',
    transaction: 'not-being-tested',
    'error.value': [],
    timestamp: firstEventTimestamp,
    'issue.id': event['issue.id'],
    project: project.slug,
    'project.name': project.name,
    id: event.id,
    'event.type': event.type,
    'stack.function': ['important.task', 'task.run'],
  };
  const secondError = {
    title: 'WorkerLostError: ', // The code handles the colon and extra space in the title
    culprit: 'billiard.pool in mark_as_worker_lost', // Used for subtitle
    message: 'Some other error message',
    // This is a case where the culprit is available while the transaction is not
    transaction: '',
    'error.value': ['some-other-error-value', 'The error message used for the issue'],
    timestamp: '2024-01-24T09:09:04+00:00',
    'issue.id': 9999,
    project: project.slug,
    'project.name': project.name,
    id: '12345',
    'event.type': event.type,
  };
  const discoverBody: TraceEventResponse = {
    data: [mainError],
    meta: {fields: {}, units: {}},
  };
  const twoIssuesBody: TraceEventResponse = {
    data: [mainError, secondError],
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
      match: [MockApiClient.matchQuery({dataset: 'issuePlatform', project: -1})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: twoIssuesBody,
      match: [MockApiClient.matchQuery({dataset: 'discover', project: -1})],
    });
    render(<TraceTimeLineOrRelatedIssue event={event} />, {organization});
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
      match: [MockApiClient.matchQuery({dataset: 'issuePlatform', project: -1})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: discoverBody,
      match: [MockApiClient.matchQuery({dataset: 'discover', project: -1})],
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
      match: [MockApiClient.matchQuery({dataset: 'issuePlatform', project: -1})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: emptyBody,
      match: [MockApiClient.matchQuery({dataset: 'discover', project: -1})],
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
      match: [MockApiClient.matchQuery({dataset: 'issuePlatform', project: -1})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: twoIssuesBody,
      match: [MockApiClient.matchQuery({dataset: 'discover', project: -1})],
    });
    render(<TraceTimeLineOrRelatedIssue event={event} />, {organization});
    // Checking for the presence of seconds
    expect(await screen.findAllByText(/\d{1,2}:\d{2}:\d{2} (AM|PM)/)).toHaveLength(5);
  });

  // useTraceTimelineEvents() adds the current event if missing
  it('adds the current event if not in the api response', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: issuePlatformBody,
      match: [MockApiClient.matchQuery({dataset: 'issuePlatform', project: -1})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        // The event for the mainError is missing, thus, it will get added
        data: [secondError],
      },
      match: [MockApiClient.matchQuery({dataset: 'discover', project: -1})],
    });
    render(<TraceTimeLineOrRelatedIssue event={event} />, {organization});
    expect(await screen.findByLabelText('Current Event')).toBeInTheDocument();
  });

  it('skips the timeline and shows related issues (2 issues)', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: issuePlatformBody,
      match: [MockApiClient.matchQuery({dataset: 'issuePlatform', project: -1})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: discoverBody,
      match: [MockApiClient.matchQuery({dataset: 'discover', project: -1})],
    });
    // Used to determine the project badge
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });

    render(<TraceTimeLineOrRelatedIssue event={event} />, {organization});

    // Instead of a timeline, we should see the other related issue
    expect(await screen.findByText('Slow DB Query')).toBeInTheDocument(); // The title
    expect(await screen.findByText('/api/slow/')).toBeInTheDocument(); // The subtitle/transaction
    expect(
      await screen.findByText('One other issue appears in the same trace.')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('SELECT "sentry_monitorcheckin"."monitor_id"') // The message
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Current Event')).not.toBeInTheDocument();

    // Test analytics
    await userEvent.click(await screen.findByText('Slow DB Query'));
    expect(useRouteAnalyticsParams).toHaveBeenCalledWith({
      has_related_trace_issue: true,
    });
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'issue_details.related_trace_issue.trace_issue_clicked',
      {
        group_id: issuePlatformBody.data[0]['issue.id'],
        organization: organization,
      }
    );
  });

  it('trace-related: check title, subtitle for error event', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: emptyBody,
      match: [MockApiClient.matchQuery({dataset: 'issuePlatform', project: -1})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: [secondError]},
      match: [MockApiClient.matchQuery({dataset: 'discover', project: -1})],
    });
    // Used to determine the project badge
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });

    render(<TraceTimeLineOrRelatedIssue event={event} />, {organization});

    // Check title, subtitle and message of error event
    // Some errors have a colon in the title and we should preserve it
    expect(await screen.findByText('WorkerLostError:')).toBeInTheDocument();
    expect(
      await screen.findByText('billiard.pool in mark_as_worker_lost')
    ).toBeInTheDocument();
    expect(
      // The message value is not found in the page
      await screen.queryByText('Task handler raised error:')
    ).not.toBeInTheDocument();
    expect(
      // The message value is not found in the page
      await screen.findByText('The error message used for the issue')
    ).toBeInTheDocument();
  });

  it('skips the timeline and shows NO related issues (only 1 issue)', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: emptyBody,
      match: [MockApiClient.matchQuery({dataset: 'issuePlatform', project: -1})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      // Only 1 issue
      body: discoverBody,
      match: [MockApiClient.matchQuery({dataset: 'discover', project: -1})],
    });
    // Used to determine the project badge
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });

    render(<TraceTimeLineOrRelatedIssue event={event} />, {organization});

    // We do not display any related issues because we only have 1 issue
    expect(await screen.queryByText('Slow DB Query')).not.toBeInTheDocument();
    expect(
      await screen.queryByText('AttributeError: Something Failed')
    ).not.toBeInTheDocument();

    // We do not display the timeline because we only have 1 event
    expect(await screen.queryByLabelText('Current Event')).not.toBeInTheDocument();
    expect(useRouteAnalyticsParams).toHaveBeenCalledWith({});
  });

  it('trace timeline works for plans with no global-views feature', async () => {
    // This test will call the endpoint without the global-views feature, thus,
    // we will only look at the current project (project: event.projectID) instead of passing -1
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: issuePlatformBody,
      match: [
        MockApiClient.matchQuery({
          dataset: 'issuePlatform',
          project: event.projectID,
        }),
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: twoIssuesBody,
      match: [
        MockApiClient.matchQuery({
          dataset: 'discover',
          project: event.projectID,
        }),
      ],
    });

    render(<TraceTimeLineOrRelatedIssue event={event} />, {
      organization: OrganizationFixture({features: []}), // No global-views feature
    });
    expect(await screen.findByLabelText('Current Event')).toBeInTheDocument();
  });

  it('trace-related issue works for plans with no global-views feature', async () => {
    // This test will call the endpoint without the global-views feature, thus,
    // we will only look at the current project (project: event.projectID) instead of passing -1
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: issuePlatformBody,
      match: [
        MockApiClient.matchQuery({
          dataset: 'issuePlatform',
          project: event.projectID,
        }),
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: discoverBody,
      match: [
        MockApiClient.matchQuery({
          dataset: 'discover',
          project: event.projectID,
        }),
      ],
    });
    // Used to determine the project badge
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });

    render(<TraceTimeLineOrRelatedIssue event={event} />, {
      organization: OrganizationFixture({
        features: [],
      }),
    });
    expect(await screen.findByText('Slow DB Query')).toBeInTheDocument();
  });
});
