import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import ProjectsStore from 'sentry/stores/projectsStore';

import {TraceTimeline} from './traceTimeline';
import type {TraceEventResponse} from './useTraceTimelineEvents';

describe('TraceTimeline', () => {
  const organization = OrganizationFixture({features: ['issues-trace-timeline']});
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
        issue: 'SENTRY-ABC1',
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
        issue: 'SENTRY-2EYS',
        transaction: 'important.task',
        'event.type': 'error',
        'stack.function': ['important.task', 'task.run'],
      },
    ],
    meta: {fields: {}, units: {}},
  };

  beforeEach(() => {
    // Can be removed with issueDetailsNewExperienceQ42023
    ProjectsStore.loadInitialData([project]);
    ConfigStore.set(
      'user',
      UserFixture({
        options: {
          ...UserFixture().options,
          issueDetailsNewExperienceQ42023: true,
        },
      })
    );
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
  });

  it('displays nothing if the only event is the current event', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [],
        meta: {fields: {}, units: {}},
      },
      match: [MockApiClient.matchQuery({dataset: 'issuePlatform'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: discoverBody,
      match: [MockApiClient.matchQuery({dataset: 'discover'})],
    });
    render(<TraceTimeline event={event} />, {organization});
    expect(await screen.findByTestId('trace-timeline-empty')).toBeInTheDocument();
  });

  it('displays nothing if there are no events', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [],
        meta: {fields: {}, units: {}},
      },
      match: [MockApiClient.matchQuery({dataset: 'issuePlatform'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [],
        meta: {fields: {}, units: {}},
      },
      match: [MockApiClient.matchQuery({dataset: 'discover'})],
    });
    render(<TraceTimeline event={event} />, {organization});
    expect(await screen.findByTestId('trace-timeline-empty')).toBeInTheDocument();
  });

  it('shows seconds for very short timelines', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: issuePlatformBody,
      match: [MockApiClient.matchQuery({dataset: 'issuePlatform'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [],
        meta: {fields: {}, units: {}},
      },
      match: [MockApiClient.matchQuery({dataset: 'discover'})],
    });
    render(<TraceTimeline event={event} />, {organization});
    // Checking for the presence of seconds
    expect(await screen.findAllByText(/\d{1,2}:\d{2}:\d{2} (AM|PM)/)).toHaveLength(3);
  });
});
