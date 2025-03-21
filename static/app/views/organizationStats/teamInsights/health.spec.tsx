import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {TeamAlertsTriggeredFixture} from 'sentry-fixture/teamAlertsTriggered';
import {TeamResolutionTimeFixture} from 'sentry-fixture/teamResolutionTime';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import type {Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import localStorage from 'sentry/utils/localStorage';
import TeamStatsHealth from 'sentry/views/organizationStats/teamInsights/health';

jest.mock('sentry/utils/localStorage');
jest.mock('sentry/utils/isActiveSuperuser', () => ({
  isActiveSuperuser: jest.fn(),
}));

describe('TeamStatsHealth', () => {
  const project1 = ProjectFixture({id: '2', name: 'js', slug: 'js'});
  const project2 = ProjectFixture({id: '3', name: 'py', slug: 'py'});
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
      method: 'GET',
      url: `/organizations/org-slug/sessions/`,
      body: {
        start: '2021-10-30T00:00:00Z',
        end: '2021-12-24T00:00:00Z',
        query: '',
        intervals: [],
        groups: [
          {
            by: {project: 1, 'session.status': 'healthy'},
            totals: {'sum(session)': 0},
            series: {'sum(session)': []},
          },
          {
            by: {project: 1, 'session.status': 'crashed'},
            totals: {'sum(session)': 0},
            series: {'sum(session)': []},
          },
          {
            by: {project: 1, 'session.status': 'errored'},
            totals: {'sum(session)': 0},
            series: {'sum(session)': []},
          },
          {
            by: {project: 1, 'session.status': 'abnormal'},
            totals: {'sum(session)': 0},
            series: {'sum(session)': []},
          },
        ],
      },
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
      body: TeamAlertsTriggeredFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/teams/org-slug/${team1.slug}/alerts-triggered-index/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/teams/org-slug/${team1.slug}/time-to-resolution/`,
      body: TeamResolutionTimeFixture(),
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/teams/org-slug/${team1.slug}/release-count/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/teams/org-slug/${team2.slug}/alerts-triggered/`,
      body: TeamAlertsTriggeredFixture(),
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
      method: 'GET',
      url: `/teams/org-slug/${team2.slug}/release-count/`,
      body: [],
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

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: [],
    });

    return render(<TeamStatsHealth {...routerProps} />, {
      organization,
    });
  }

  it('defaults to first team', async () => {
    createWrapper();

    expect(await screen.findByText('#backend')).toBeInTheDocument();
    expect(screen.getByText('Key transaction')).toBeInTheDocument();
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
