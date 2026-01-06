import {AutofixSetupFixture} from 'sentry-fixture/autofixSetupFixture';
import {EventFixture} from 'sentry-fixture/event';
import {EventsStatsFixture} from 'sentry-fixture/events';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TagsFixture} from 'sentry-fixture/tags';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {mockTour} from 'sentry/components/tours/testUtils';
import ProjectsStore from 'sentry/stores/projectsStore';

import {GroupDetailsLayout} from './groupDetailsLayout';

jest.mock('sentry/views/issueDetails/issueDetailsTour', () => ({
  ...jest.requireActual('sentry/views/issueDetails/issueDetailsTour'),
  useIssueDetailsTour: () => mockTour(),
}));

describe('GroupDetailsLayout', () => {
  const organization = OrganizationFixture();
  const group = GroupFixture();
  const event = EventFixture();
  const project = ProjectFixture();

  beforeEach(() => {
    ProjectsStore.init();
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/flags/logs/',
      body: {data: []},
    });
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
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/setup/`,
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: false,
          userHasAcknowledged: false,
        },
        integration: {ok: true, reason: null},
        githubWriteIntegration: {ok: true, repos: []},
      }),
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      body: [project],
    });
  });

  it('renders children, can collapse sidebar', async () => {
    render(
      <GroupDetailsLayout group={group} event={event} project={project}>
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
