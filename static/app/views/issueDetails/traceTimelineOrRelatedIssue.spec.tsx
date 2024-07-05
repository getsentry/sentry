import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';

import {getTitleSubtitleMessage} from './traceTimeline/traceIssue';
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
    message: 'This is the message for the issue',
    culprit: 'n/a',
    timestamp: firstEventTimestamp,
    'issue.id': event['issue.id'],
    project: project.slug,
    'project.name': project.name,
    title: event.title,
    id: event.id,
    transaction: 'important.task',
    'event.type': event.type,
    'stack.function': ['important.task', 'task.run'],
  };
  const secondError = {
    message: 'Message of the second issue',
    culprit: 'n/a',
    timestamp: '2024-01-24T09:09:04+00:00',
    'issue.id': 9999,
    project: project.slug,
    'project.name': project.name,
    title: 'someTitle',
    id: '12345',
    transaction: 'foo',
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

function createEvent({
  culprit,
  message,
  title,
  transaction,
  event_type = 'error',
}: {
  culprit: string;
  message: string;
  title: string;
  transaction: string;
  event_type?: string;
}) {
  return {
    culprit: culprit,
    message: message,
    timestamp: '2024-01-24T09:09:04+00:00',
    'issue.id': 9999,
    project: 'foo',
    'project.name': 'bar',
    title: title,
    id: '12345',
    transaction: transaction,
    'event.type': event_type,
  };
}

describe('getTitleSubtitleMessage()', () => {
  it('error event', () => {
    expect(
      getTitleSubtitleMessage(
        createEvent({
          culprit: 'n/a',
          title:
            'ClientError: 404 Client Error: for url: https://api.clickup.com/sentry/webhook',
          message: 'Message of the second issue',
          transaction: 'foo',
        })
      )
    ).toEqual({
      title: 'ClientError', // The colon and remainder of string are removed
      subtitle: 'foo',
      message: 'Message of the second issue',
    });
  });

  it('error event: It keeps the colon', () => {
    expect(
      getTitleSubtitleMessage(
        createEvent({
          culprit: 'n/a',
          title: 'WorkerLostError: ',
          message: 'Message of the second issue',
          transaction: 'foo',
        })
      )
    ).toEqual({
      title: 'WorkerLostError:', // The colon is kept
      subtitle: 'foo',
      message: 'Message of the second issue',
    });
  });

  it('default event', () => {
    expect(
      getTitleSubtitleMessage(
        createEvent({
          culprit: '/api/0/organizations/{organization_id_or_slug}/issues/',
          message: 'n/a',
          title: 'Query from referrer search.group_index is throttled',
          transaction: 'n/a',
          event_type: 'default',
        })
      )
    ).toEqual({
      title: 'Query from referrer search.group_index is throttled',
      subtitle: '',
      message: '/api/0/organizations/{organization_id_or_slug}/issues/',
    });
  });
});
