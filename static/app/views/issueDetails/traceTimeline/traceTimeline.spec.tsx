import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';

import {TraceTimeline} from './traceTimeline';
import type {TraceEventResponse} from './useTraceTimelineEvents';

describe('TraceTimeline', () => {
  const organization = OrganizationFixture({features: ['issues-trace-timeline']});
  const event = EventFixture();

  const issuePlatformBody: TraceEventResponse = {
    data: [
      {
        timestamp: '2024-01-24T09:09:03+00:00',
        'issue.id': 1000,
        project: 'sentry',
        'project.name': 'sentry',
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
        project: 'sentry',
        'project.name': 'sentry',
        title: 'AttributeError: Something Failed',
        id: event.id,
        issue: 'SENTRY-2EYS',
      },
    ],
    meta: {fields: {}, units: {}},
  };

  beforeEach(() => {
    // Can be removed with issueDetailsNewExperienceQ42023
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

    await userEvent.hover(screen.getByLabelText('Current Event'));
    expect(await screen.findByText('You are here')).toBeInTheDocument();
  });
});
