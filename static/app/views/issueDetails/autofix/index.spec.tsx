import {ExplorerAutofixResponseFixture} from 'sentry-fixture/autofix';
import {EventsStatsFixture} from 'sentry-fixture/events';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import AutofixPage from 'sentry/views/issueDetails/autofix';
import {TopBar} from 'sentry/views/navigation/topBar';

jest.mock('sentry/utils/useFeedbackForm', () => ({
  useFeedbackForm: () => jest.fn(),
}));

describe('AutofixPage', () => {
  const project = ProjectFixture({id: '1'});
  const group = GroupFixture({id: '101', project, hasSeen: true});
  const organization = OrganizationFixture({
    features: ['gen-ai-features', 'autofix-page'],
  });

  const initialRouterConfig = {
    location: {pathname: `/issues/${group.id}/autofix/`},
    route: '/issues/:groupId/autofix/',
  };

  function renderPage(org = organization) {
    return render(
      <TopBar.Slot.Provider>
        <TopBar />
        <AutofixPage />
      </TopBar.Slot.Provider>,
      {organization: org, initialRouterConfig}
    );
  }

  beforeEach(() => {
    ProjectsStore.reset();
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: group,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
      body: ExplorerAutofixResponseFixture({autofix: null}),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/setup/`,
      body: {
        integration: {ok: false, reason: null},
        billing: {hasAutofixQuota: false},
        seerReposLinked: false,
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {pullRequests: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/attachments/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/tags/`,
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
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      body: {},
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
      url: `/organizations/${organization.slug}/releases/stats/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/flags/logs/`,
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });
  });

  it('renders the issue preview for the group in the route', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', {name: group.metadata.type})
    ).toBeInTheDocument();
  });

  it('renders the event filter bar and graph above the preview', async () => {
    renderPage();

    // EventDetailsHeader depends on providers the issue details route supplies
    // and this sibling route has to stand up itself, so assert it really mounts.
    expect(await screen.findByRole('button', {name: 'All Envs'})).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Filter events\u2026')).toBeInTheDocument();
    expect(screen.getByRole('figure')).toBeInTheDocument();
  });

  it('shows an Issues / short-id / Autofix breadcrumb trail', async () => {
    renderPage();

    expect(await screen.findByRole('link', {name: group.shortId})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/${group.id}/`
    );
    expect(screen.getByRole('link', {name: 'Issues'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/`
    );
    expect(screen.getByRole('heading', {name: 'Autofix', level: 1})).toBeInTheDocument();
  });

  it('is not found without the autofix-page feature', () => {
    renderPage(OrganizationFixture({features: ['gen-ai-features']}));

    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
  });
});
