import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import ProjectsStore from 'sentry/stores/projectsStore';

import {TraceLink} from './traceLink';
import type {TraceEventResponse} from './useTraceTimelineEvents';

describe('TraceLink', () => {
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
});
