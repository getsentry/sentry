import {AutofixSetupFixture} from 'sentry-fixture/autofixSetupFixture';
import {EventFixture} from 'sentry-fixture/event';
import {EventsStatsFixture} from 'sentry-fixture/events';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TagsFixture} from 'sentry-fixture/tags';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Container} from '@sentry/scraps/layout';

import {mockTour} from 'sentry/components/tours/testUtils';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {GroupDataContextProvider} from 'sentry/views/issueDetails/groupDataContext';

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
      url: '/organizations/org-slug/members/',
      body: [],
    });
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
      url: '/organizations/org-slug/repos/',
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
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {pullRequests: []},
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
        integration: {ok: true, reason: null},
      }),
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      body: [project],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders children, can collapse sidebar', async () => {
    // Sidebar placement resolves against the query container's width (the sidebar
    // sits beside the content at `4xl`+, and can be collapsed there; below that it
    // drops to the bottom and stays visible). jsdom reports a 0px container, so
    // fake a desktop width to exercise the collapsible side layout.
    jest.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(1400);

    render(
      <Container containerType="inline-size">
        <GroupDataContextProvider group={group} project={group.project}>
          <GroupDetailsLayout group={group} event={event} project={project}>
            <div data-test-id="children" />
          </GroupDetailsLayout>
        </GroupDataContextProvider>
      </Container>
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
