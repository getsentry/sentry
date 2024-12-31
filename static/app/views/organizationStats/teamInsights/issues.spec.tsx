import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {TeamIssuesBreakdownFixture} from 'sentry-fixture/teamIssuesBreakdown';
import {TeamResolutionTimeFixture} from 'sentry-fixture/teamResolutionTime';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import type {Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
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
  const project1 = ProjectFixture({
    id: '2',
    name: 'js',
    slug: 'js',
    environments: [env1, env2],
  });
  const project2 = ProjectFixture({
    id: '3',
    name: 'py',
    slug: 'py',
    environments: [env1, env2],
  });
  const team1 = TeamFixture({
    id: '2',
    slug: 'frontend',
    name: 'frontend',
    projects: [project1],
    isMember: true,
  });
  const team2 = TeamFixture({
    id: '3',
    slug: 'backend',
    name: 'backend',
    projects: [project2],
    isMember: true,
  });
  const team3 = TeamFixture({
    id: '4',
    slug: 'internal',
    name: 'internal',
    projects: [],
    isMember: false,
  });
  const {routerProps, router} = initializeOrg();

  beforeEach(() => {
    TeamStore.reset();

    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/projects/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/teams/org-slug/${team1.slug}/time-to-resolution/`,
      body: TeamResolutionTimeFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/teams/org-slug/${team1.slug}/issue-breakdown/`,
      body: TeamIssuesBreakdownFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/teams/org-slug/${team2.slug}/alerts-triggered-index/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/teams/org-slug/${team2.slug}/time-to-resolution/`,
      body: TeamResolutionTimeFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/teams/org-slug/${team2.slug}/issue-breakdown/`,
      body: TeamIssuesBreakdownFixture(),
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

  function createWrapper({
    projects,
    teams,
    isOrgOwner,
  }: {isOrgOwner?: boolean; projects?: Project[]; teams?: Team[]} = {}) {
    teams = teams ?? [team1, team2, team3];
    projects = projects ?? [project1, project2];
    ProjectsStore.loadInitialData(projects);
    const organization = OrganizationFixture();

    if (isOrgOwner !== undefined && !isOrgOwner) {
      organization.access = organization.access.filter(scope => scope !== 'org:admin');
    }

    TeamStore.loadInitialData(teams, false, null);

    return render(<TeamStatsIssues {...routerProps} />, {organization});
  }

  it('defaults to first team', async () => {
    createWrapper();

    expect(await screen.findByText('#backend')).toBeInTheDocument();
    expect(screen.getByText('All Unresolved Issues')).toBeInTheDocument();
  });

  it('allows team switching as non-owner', async () => {
    createWrapper({isOrgOwner: false});

    expect(screen.getByText('#backend')).toBeInTheDocument();
    await userEvent.type(screen.getByText('#backend'), '{mouseDown}');
    expect(screen.getByText('#frontend')).toBeInTheDocument();
    // Teams user is not a member of are hidden
    expect(screen.queryByText('#internal')).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('#frontend'));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({query: {team: team1.id}})
    );
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'teamInsightsSelectedTeamId:org-slug',
      team1.id
    );
  });

  it('allows team switching as owner', async () => {
    createWrapper();

    expect(screen.getByText('#backend')).toBeInTheDocument();
    await userEvent.type(screen.getByText('#backend'), '{mouseDown}');
    expect(screen.getByText('#frontend')).toBeInTheDocument();
    // Org owners can see all teams including ones they are not members of
    expect(screen.getByText('#internal')).toBeInTheDocument();
    await userEvent.click(screen.getByText('#internal'));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({query: {team: team3.id}})
    );
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'teamInsightsSelectedTeamId:org-slug',
      team3.id
    );
  });

  it('can filter by environment', async () => {
    createWrapper();

    // For some reason the "Environment:" is rendered via css :before
    expect(screen.getByText('All')).toBeInTheDocument();
    await userEvent.type(screen.getByText('All'), '{mouseDown}');
    expect(screen.getByText(env1)).toBeInTheDocument();
    await userEvent.click(screen.getByText(env1));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({query: {environment: 'prod'}})
    );
  });

  it('superusers can switch to any team', async () => {
    jest.mocked(isActiveSuperuser).mockReturnValue(true);
    createWrapper();

    expect(screen.getByText('#backend')).toBeInTheDocument();
    await userEvent.type(screen.getByText('#backend'), '{mouseDown}');
    expect(screen.getByText('#frontend')).toBeInTheDocument();
    // User is not a member of internal team
    expect(screen.getByText('#internal')).toBeInTheDocument();
  });

  it('shows users with no teams the join team button', () => {
    createWrapper({
      projects: [{...project1, isMember: false}],
      teams: [],
    });

    expect(screen.getByText('Join a Team')).toBeInTheDocument();
  });
});
