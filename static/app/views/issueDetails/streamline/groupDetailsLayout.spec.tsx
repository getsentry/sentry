import {EventFixture} from 'sentry-fixture/event';
import {EventsStatsFixture} from 'sentry-fixture/events';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TagsFixture} from 'sentry-fixture/tags';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {ReprocessingStatus} from 'sentry/views/issueDetails/utils';

import {GroupDetailsLayout} from './groupDetailsLayout';

describe('GroupDetailsLayout', () => {
  const organization = OrganizationFixture();
  const group = GroupFixture();
  const event = EventFixture();
  const project = ProjectFixture();

  beforeEach(() => {
    ProjectsStore.init();
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      method: 'GET',
      body: group,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replay-count/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/repos/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/stats/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/attachments/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/first-last-release/`,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/external-issues/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/integrations/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {'count()': EventsStatsFixture(), 'count_unique(user)': EventsStatsFixture()},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: [{'count_unique(user)': 21}]},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/owners/`,
      body: {owners: [], rules: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/tags/`,
      body: TagsFixture(),
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/events/1/committers/',
      body: {committers: []},
    });
    MockApiClient.addMockResponse({
      url: '/issues/1/autofix/setup/',
      body: {
        genAIConsent: {ok: false},
        integration: {ok: true},
        githubWriteIntegration: {ok: true},
      },
    });
  });

  it('renders children, can collapse sidebar', async () => {
    render(
      <GroupDetailsLayout
        group={group}
        event={event}
        project={project}
        groupReprocessingStatus={ReprocessingStatus.NO_STATUS}
      >
        <div data-test-id="children" />
      </GroupDetailsLayout>
    );

    expect(await screen.findByTestId('children')).toBeInTheDocument();
    expect(
      await screen.findByText('Track this issue in Jira, GitHub, etc.')
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Close sidebar'}));
    expect(await screen.findByTestId('children')).toBeInTheDocument();
    expect(
      screen.queryByText('Track this issue in Jira, GitHub, etc.')
    ).not.toBeInTheDocument();
  });
});
