import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import localStorage from 'sentry/utils/localStorage';
import TeamStatsIssues from 'sentry/views/organizationStats/teamInsights/issues';

jest.mock('sentry/utils/localStorage');
jest.mock('sentry/utils/isActiveSuperuser', () => ({
  isActiveSuperuser: jest.fn(),
}));

describe('TeamStatsIssues', () => {
  const env1 = 'prod';
  const env2 = 'dev';
  const project1 = TestStubs.Project({
    id: '2',
    name: 'js',
    slug: 'js',
    environments: [env1, env2],
  });
  const project2 = TestStubs.Project({
    id: '3',
    name: 'py',
    slug: 'py',
    environments: [env1, env2],
  });
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
      url: `/teams/org-slug/${team1.slug}/time-to-resolution/`,
      body: TestStubs.TeamResolutionTime(),
    });
    MockApiClient.addMockResponse({
      url: `/teams/org-slug/${team1.slug}/issue-breakdown/`,
      body: TestStubs.TeamIssuesBreakdown(),
    });
    MockApiClient.addMockResponse({
      url: `/teams/org-slug/${team2.slug}/alerts-triggered-index/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/teams/org-slug/${team2.slug}/time-to-resolution/`,
      body: TestStubs.TeamResolutionTime(),
    });
    MockApiClient.addMockResponse({
      url: `/teams/org-slug/${team2.slug}/issue-breakdown/`,
      body: TestStubs.TeamIssuesBreakdown(),
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/teams/org-slug/${team2.slug}/issues/old/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/teams/org-slug/${team2.slug}/unresolved-issue-age/`,
      body: [],
    });
    const unresolvedStats = {
      '2021-12-10T00:00:00+00:00': {unresolved: 45},
      '2021-12-11T00:00:00+00:00': {unresolved: 45},
      '2021-12-12T00:00:00+00:00': {unresolved: 45},
      '2021-12-13T00:00:00+00:00': {unresolved: 49},
      '2021-12-14T00:00:00+00:00': {unresolved: 50},
      '2021-12-15T00:00:00+00:00': {unresolved: 45},
      '2021-12-16T00:00:00+00:00': {unresolved: 44},
      '2021-12-17T00:00:00+00:00': {unresolved: 44},
      '2021-12-18T00:00:00+00:00': {unresolved: 44},
      '2021-12-19T00:00:00+00:00': {unresolved: 43},
      '2021-12-20T00:00:00+00:00': {unresolved: 40},
      '2021-12-21T00:00:00+00:00': {unresolved: 37},
      '2021-12-22T00:00:00+00:00': {unresolved: 36},
      '2021-12-23T00:00:00+00:00': {unresolved: 37},
    };
    MockApiClient.addMockResponse({
      url: `/teams/org-slug/${team1.slug}/all-unresolved-issues/`,
      body: {
        2: unresolvedStats,
      },
    });
    MockApiClient.addMockResponse({
      url: `/teams/org-slug/${team2.slug}/all-unresolved-issues/`,
      body: {
        3: unresolvedStats,
      },
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  function createWrapper() {
    const teams = [team1, team2, team3];
    const projects = [project1, project2];
    ProjectsStore.loadInitialData(projects);
    const organization = TestStubs.Organization({
      teams,
      projects,
    });
    const context = TestStubs.routerContext([{organization}]);
    TeamStore.loadInitialData(teams, false, null);

    return mountWithTheme(<TeamStatsIssues router={mockRouter} location={{}} />, {
      context,
      organization,
    });
  }

  it('defaults to first team', () => {
    createWrapper();

    expect(screen.getByText('#backend')).toBeInTheDocument();
    expect(screen.getByText('All Unresolved Issues')).toBeInTheDocument();
  });

  it('allows team switching', () => {
    createWrapper();

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

  it('can filter by environment', () => {
    createWrapper();

    // For some reason the "Environment:" is rendered via css :before
    expect(screen.getByText('All')).toBeInTheDocument();
    userEvent.type(screen.getByText('All'), '{mouseDown}');
    expect(screen.getByText(env1)).toBeInTheDocument();
    userEvent.click(screen.getByText(env1));
    expect(mockRouter.push).toHaveBeenCalledWith({query: {environment: 'prod'}});
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
    TeamStore.loadInitialData([], false, null);

    expect(screen.getByText('Join a Team')).toBeInTheDocument();
  });
});
