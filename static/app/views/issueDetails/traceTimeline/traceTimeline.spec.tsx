import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';

import {TraceTimeline} from './traceTimeline';
import type {TraceEventResponse} from './useTraceTimelineEvents';

jest.mock('sentry/utils/routeAnalytics/useRouteAnalyticsParams');
jest.mock('sentry/utils/analytics');

describe('TraceTimeline', () => {
  // Paid plans have global-views enabled
  // Include project: -1 in all matchQuery calls to ensure we are looking at all projects
  const organization = OrganizationFixture({
    features: ['global-views'],
  });
  // This creates the ApiException event
  const event = EventFixture({
    // This is used to determine the presence of seconds
    dateCreated: '2024-01-24T09:09:03+00:00',
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
        // In issuePlatform, we store the subtitle within the message
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
    message: 'This is the subtitle of the issue',
    timestamp: '2024-01-23T22:11:42+00:00',
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
    timestamp: '2024-01-23T22:11:42+00:00',
    'issue.id': 9999,
    project: project.slug,
    'project.name': project.name,
    title: 'someTitle',
    id: '12345',
    transaction: 'foo',
    'event.type': event.type,
  };
  const oneIssue: TraceEventResponse = {
    data: [mainError],
    meta: {fields: {}, units: {}},
  };
  const twoIssues: TraceEventResponse = {
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
      body: twoIssues,
      match: [MockApiClient.matchQuery({dataset: 'discover', project: -1})],
    });
    // Used to determine the project badge
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });
    render(<TraceTimeline event={event} />, {organization});
    expect(await screen.findByLabelText('Current Event')).toBeInTheDocument();

    await userEvent.hover(screen.getByTestId('trace-timeline-tooltip-1'));
    expect(await screen.findByText('You are here')).toBeInTheDocument();
    expect(useRouteAnalyticsParams).toHaveBeenCalledWith({
      has_related_trace_issue: false,
      trace_timeline_status: 'empty',
      trace_timeline_two_issues: false,
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
      body: oneIssue,
      match: [MockApiClient.matchQuery({dataset: 'discover', project: -1})],
    });
    const {container} = render(<TraceTimeline event={event} />, {organization});
    await waitFor(() =>
      expect(useRouteAnalyticsParams).toHaveBeenCalledWith({
        has_related_trace_issue: false,
        trace_timeline_status: 'empty',
        trace_timeline_two_issues: false,
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
        has_related_trace_issue: false,
        trace_timeline_status: 'empty',
        trace_timeline_two_issues: false,
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
      body: emptyBody,
      match: [MockApiClient.matchQuery({dataset: 'discover', project: -1})],
    });
    // Used to determine the project badge
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });
    render(<TraceTimeline event={event} />, {organization});
    // Checking for the presence of seconds
    expect(await screen.findAllByText(/\d{1,2}:\d{2}:\d{2} (AM|PM)/)).toHaveLength(5);
    expect(useRouteAnalyticsParams).toHaveBeenLastCalledWith({
      has_related_trace_issue: false, // XXX: Check
      trace_timeline_status: 'empty',
      trace_timeline_two_issues: false, // XXX: Check
    });
  });

  it('adds the current event if not in the api response', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: issuePlatformBody,
      match: [MockApiClient.matchQuery({dataset: 'issuePlatform', project: -1})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: emptyBody,
      match: [MockApiClient.matchQuery({dataset: 'discover', project: -1})],
    });
    // Used to determine the project badge
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });
    render(<TraceTimeline event={event} />, {organization});
    expect(await screen.findByLabelText('Current Event')).not.toBeInTheDocument();
    expect(useRouteAnalyticsParams).toHaveBeenLastCalledWith({
      has_related_trace_issue: false, // XXX: Check
      trace_timeline_status: 'empty',
      trace_timeline_two_issues: false, // XXX: Check
    });
  });

  it('skips the timeline and shows related issues (2 issues)', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: issuePlatformBody,
      match: [MockApiClient.matchQuery({dataset: 'issuePlatform', project: -1})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: emptyBody,
      match: [MockApiClient.matchQuery({dataset: 'discover', project: -1})],
    });
    // Used to determine the project badge
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });

    render(<TraceTimeline event={event} />, {
      organization: OrganizationFixture({
        features: ['global-views'],
      }),
    });

    // Instead of a timeline, we should see the other related issue
    expect(await screen.findByText('Slow DB Query')).toBeInTheDocument();
    expect(
      await screen.findByText('SELECT "sentry_monitorcheckin"."monitor_id"')
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Current Event')).not.toBeInTheDocument();

    // Test analytics
    await userEvent.click(await screen.findByText('Slow DB Query'));
    expect(useRouteAnalyticsParams).toHaveBeenLastCalledWith({
      has_related_trace_issue: true,
      trace_timeline_status: 'empty',
      // Even though the trace timeline has not been rendered, we still
      // track that it would have been the two issues case that related issues is replacing
      trace_timeline_two_issues: true,
    });
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'issue_details.related_trace_issue.trace_issue_clicked',
      {
        group_id: issuePlatformBody.data[0]['issue.id'],
        organization: OrganizationFixture({
          features: ['global-views'],
        }),
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
      body: oneIssue,
      match: [MockApiClient.matchQuery({dataset: 'discover', project: -1})],
    });
    // Used to determine the project badge
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });

    render(<TraceTimeline event={event} />, {
      organization: OrganizationFixture({
        features: ['related-issues-issue-details-page', 'global-views'],
      }),
    });

    // We do not display any related issues because we only have 1 issue
    expect(await screen.queryByText('Slow DB Query')).not.toBeInTheDocument();
    expect(
      await screen.queryByText('AttributeError: Something Failed')
    ).not.toBeInTheDocument();

    // We do not display the timeline because we only have 1 event
    expect(await screen.queryByLabelText('Current Event')).not.toBeInTheDocument();
    expect(useRouteAnalyticsParams).toHaveBeenCalledWith({
      has_related_trace_issue: false,
      trace_timeline_status: 'empty',
      trace_timeline_two_issues: false,
    });
  });

  it('works for plans with no global-views feature', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: issuePlatformBody,
      match: [
        MockApiClient.matchQuery({
          dataset: 'issuePlatform',
          // Since we don't have global-views, we only look at the current project
          project: event.projectID,
        }),
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: emptyBody,
      match: [
        MockApiClient.matchQuery({
          dataset: 'discover',
          // Since we don't have global-views, we only look at the current project
          project: event.projectID,
        }),
      ],
    });
    // Used to determine the project badge
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });

    render(<TraceTimeline event={event} />, {
      organization: OrganizationFixture({
        features: [], // No global-views feature
      }),
    });
    expect(await screen.queryByText('Slow DB Query')).toBeInTheDocument();
    expect(await screen.findByLabelText('Current Event')).not.toBeInTheDocument();
    expect(useRouteAnalyticsParams).toHaveBeenCalledWith({
      has_related_trace_issue: false, // Should be true
      trace_timeline_status: 'empty',
      trace_timeline_two_issues: false, // Should be true
    });
  });
});
