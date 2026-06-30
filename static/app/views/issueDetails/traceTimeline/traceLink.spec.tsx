import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import {TraceLink} from './traceLink';
import type {TraceEventResponse} from './useTraceTimelineEvents';

describe('TraceLink', () => {
  const organization = OrganizationFixture();
  const event = EventFixture({
    contexts: {
      trace: {
        trace_id: '123',
      },
    },
  });
  const project = ProjectFixture();

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
        culprit: 'foo',
        'event.type': '',
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
        culprit: 'foo',
        'stack.function': [''],
        'error.value': ['foo', 'bar'],
      },
    ],
    meta: {fields: {}, units: {}},
  };

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
  });

  it('renders the number of issues', async () => {
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
    render(<TraceLink event={event} />, {organization});
    expect(await screen.findByText('View Full Trace')).toBeInTheDocument();
  });

  it('does not carry issue list filters into the trace target', async () => {
    render(<TraceLink event={event} />, {
      organization: {...organization, features: ['performance-view']},
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/issues/${event.groupID}/`,
          query: {
            project: project.id,
            query: 'is:unresolved issue.category:[error,outage]',
            referrer: 'issue-stream',
          },
        },
      },
    });

    const link = await screen.findByRole('link', {name: 'View Full Trace'});
    const url = new URL(link.getAttribute('href')!, 'https://example.com');

    expect(url.pathname).toBe(`/organizations/${organization.slug}/issues/trace/123/`);
    expect(url.searchParams.get('groupId')).toBe(event.groupID);
    expect(url.searchParams.get('referrer')).toBe('issue-stream');
    expect(url.searchParams.get('source')).toBe('issue_details');
    expect(url.searchParams.has('project')).toBe(false);
    expect(url.searchParams.has('query')).toBe(false);
  });

  it('renders no trace available', async () => {
    render(<TraceLink event={EventFixture()} />, {organization});
    expect(await screen.findByText('No Trace Available')).toBeInTheDocument();
  });
});
