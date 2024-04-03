import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';

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
    expect(
      await screen.findByRole('link', {name: 'View Full Trace (2 issues)'})
    ).toBeInTheDocument();
  });

  it('renders no trace available', async () => {
    render(<TraceLink event={EventFixture({})} />, {organization});
    expect(await screen.findByText('No Trace Available')).toBeInTheDocument();
  });
});
