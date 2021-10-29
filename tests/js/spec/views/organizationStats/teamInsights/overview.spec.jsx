import {
  mountWithTheme,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'app/stores/projectsStore';
import TeamStore from 'app/stores/teamStore';
import {isActiveSuperuser} from 'app/utils/isActiveSuperuser';
import localStorage from 'app/utils/localStorage';
import {OrganizationContext} from 'app/views/organizationContext';
import TeamInsightsOverview from 'app/views/organizationStats/teamInsights/overview';

jest.mock('app/utils/localStorage');
jest.mock('app/utils/isActiveSuperuser', () => ({
  isActiveSuperuser: jest.fn(),
}));

describe('TeamInsightsOverview', () => {
  const project1 = TestStubs.Project({id: '2', name: 'js', slug: 'js'});
  const project2 = TestStubs.Project({id: '3', name: 'py', slug: 'py'});
  const team1 = TestStubs.Team({
    id: '2',
    slug: 'frontend',
    name: 'frontend',
    projects: [project1],
    isMember: true,
  });
  const team2 = TestStubs.Team({
    id: '3',
    slug: 'backend',
    name: 'backend',
    projects: [project2],
    isMember: true,
  });
  const team3 = TestStubs.Team({
    id: '4',
    slug: 'internal',
    name: 'internal',
    projects: [],
    isMember: false,
  });
  const mockRouter = {push: jest.fn()};

  beforeEach(() => {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/projects/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/key-transactions-list/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/legacy-key-transactions-count/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: {
        meta: {
          user: 'string',
          transaction: 'string',
          project: 'string',
          tpm: 'number',
          count_unique_user: 'number',
          count_miserable_user: 'number',
          user_misery: 'number',
        },
        data: [
          {
            key_transaction: 1,
            transaction: '/apple/cart',
            project: project1.slug,
            tpm: 30,
            count_unique_user: 1000,
            count_miserable_user: 122,
            user_misery: 0.114,
            project_threshold_config: ['duration', 300],
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/teams/org-slug/${team1.slug}/alerts-triggered/`,
      body: TestStubs.TeamAlertsTriggered(),
    });
    MockApiClient.addMockResponse({
      url: `/teams/org-slug/${team1.slug}/time-to-resolution/`,
      body: TestStubs.TeamResolutionTime(),
    });
    MockApiClient.addMockResponse({
      url: `/teams/org-slug/${team1.slug}/issue-breakdown/`,
      body: TestStubs.TeamIssuesReviewed(),
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/teams/org-slug/${team1.slug}/release-count/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/teams/org-slug/${team2.slug}/alerts-triggered/`,
      body: TestStubs.TeamAlertsTriggered(),
    });
    MockApiClient.addMockResponse({
      url: `/teams/org-slug/${team2.slug}/time-to-resolution/`,
      body: TestStubs.TeamResolutionTime(),
    });
    MockApiClient.addMockResponse({
      url: `/teams/org-slug/${team2.slug}/issue-breakdown/`,
      body: TestStubs.TeamIssuesReviewed(),
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/teams/org-slug/${team2.slug}/release-count/`,
      body: [],
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  function createWrapper() {
    const teams = [team1, team2, team3];
    const projects = [project1, project2];
    const organization = TestStubs.Organization({teams, projects});
    const context = TestStubs.routerContext([{organization}]);
    TeamStore.loadInitialData(teams);

    return mountWithTheme(
      <OrganizationContext.Provider value={organization}>
        <TeamInsightsOverview router={mockRouter} location={{}} />
      </OrganizationContext.Provider>,
      {
        context,
      }
    );
  }

  it('defaults to first team', async () => {
    createWrapper();
    await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));

    expect(screen.getByText('#backend')).toBeInTheDocument();
    expect(screen.getByText('Key transaction')).toBeInTheDocument();
  });

  it('allows team switching', async () => {
    createWrapper();
    await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));

    expect(screen.getByText('#backend')).toBeInTheDocument();
    userEvent.type(screen.getByText('#backend'), '{mouseDown}');
    expect(screen.getByText('#frontend')).toBeInTheDocument();
    // Teams user is not a member of are hidden
    expect(screen.queryByText('#internal')).not.toBeInTheDocument();
    userEvent.click(screen.getByText('#frontend'));
    expect(mockRouter.push).toHaveBeenCalledWith({query: {team: team1.id}});
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'teamInsightsSelectedTeamId:org-slug',
      team1.id
    );
  });

  it('superusers can switch to any team', () => {
    isActiveSuperuser.mockReturnValue(true);
    createWrapper();

    expect(screen.getByText('#backend')).toBeInTheDocument();
    userEvent.type(screen.getByText('#backend'), '{mouseDown}');
    expect(screen.getByText('#frontend')).toBeInTheDocument();
    // User is not a member of internal team
    expect(screen.getByText('#internal')).toBeInTheDocument();
  });

  it('shows users with no teams the join team button', () => {
    createWrapper();
    ProjectsStore.loadInitialData([{...project1, isMember: false}]);
    TeamStore.loadInitialData([]);

    expect(screen.getByText('Join a Team')).toBeInTheDocument();
  });
});
