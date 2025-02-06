import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';
import {TeamFixture} from 'sentry-fixture/team';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import * as projectsActions from 'sentry/actionCreators/projects';
import ProjectsStatsStore from 'sentry/stores/projectsStatsStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import ProjectsDashboard from 'sentry/views/projectsDashboard';

jest.unmock('lodash/debounce');
jest.mock('lodash/debounce', () => {
  const debounceMap = new Map();
  const mockDebounce =
    (fn: (...args: any[]) => void, timeout: number) =>
    (...args: any[]) => {
      if (debounceMap.has(fn)) {
        clearTimeout(debounceMap.get(fn));
      }
      debounceMap.set(
        fn,
        setTimeout(() => {
          fn.apply(fn, args);
          debounceMap.delete(fn);
        }, timeout)
      );
    };
  return mockDebounce;
});

describe('ProjectsDashboard', function () {
  const org = OrganizationFixture();
  const team = TeamFixture();
  const teams = [team];

  beforeEach(function () {
    TeamStore.loadInitialData(teams);
    MockApiClient.addMockResponse({
      url: `/teams/${org.slug}/${team.slug}/members/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [],
    });
    ProjectsStatsStore.reset();
    ProjectsStore.loadInitialData([]);
  });

  afterEach(function () {
    TeamStore.reset();
    projectsActions._projectStatsToFetch.clear();
    MockApiClient.clearMockResponses();
  });

  describe('empty state', function () {
    it('renders with 1 project, with no first event', async function () {
      const projects = [ProjectFixture({teams, firstEvent: null, stats: []})];
      ProjectsStore.loadInitialData(projects);

      const teamsWithOneProject = [TeamFixture({projects})];
      TeamStore.loadInitialData(teamsWithOneProject);

      render(<ProjectsDashboard />);

      expect(await screen.findByTestId('join-team')).toBeInTheDocument();
      expect(screen.getByTestId('create-project')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('Search for projects by name')
      ).toBeInTheDocument();
      expect(screen.getByText('My Teams')).toBeInTheDocument();
      expect(screen.getByText('Resources')).toBeInTheDocument();
      expect(await screen.findByTestId('badge-display-name')).toBeInTheDocument();
      expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
    });
  });

  describe('with projects', function () {
    it('renders with two projects', async function () {
      const teamA = TeamFixture({slug: 'team1', isMember: true});
      const projects = [
        ProjectFixture({
          id: '1',
          slug: 'project1',
          teams: [teamA],
          firstEvent: new Date().toISOString(),
          stats: [],
        }),
        ProjectFixture({
          id: '2',
          slug: 'project2',
          teams: [teamA],
          isBookmarked: true,
          firstEvent: new Date().toISOString(),
          stats: [],
        }),
      ];

      ProjectsStore.loadInitialData(projects);
      const teamsWithTwoProjects = [TeamFixture({projects})];
      TeamStore.loadInitialData(teamsWithTwoProjects);
      render(<ProjectsDashboard />);
      expect(await screen.findByText('My Teams')).toBeInTheDocument();
      expect(screen.getAllByTestId('badge-display-name')).toHaveLength(2);
      expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
    });

    it('renders only projects for my teams by default', async function () {
      const teamA = TeamFixture({slug: 'team1', isMember: true, projects: undefined});
      const teamProjects = [
        ProjectFixture({
          id: '1',
          slug: 'project1',
          teams: [teamA],
          firstEvent: new Date().toISOString(),
          stats: [],
        }),
      ];

      ProjectsStore.loadInitialData([
        ...teamProjects,
        ProjectFixture({
          id: '2',
          slug: 'project2',
          teams: [],
          isBookmarked: true,
          firstEvent: new Date().toISOString(),
          stats: [],
        }),
      ]);
      const teamsWithTwoProjects = [TeamFixture({projects: teamProjects})];
      TeamStore.loadInitialData(teamsWithTwoProjects);

      render(<ProjectsDashboard />);
      expect(await screen.findByText('My Teams')).toBeInTheDocument();
      expect(screen.getAllByTestId('badge-display-name')).toHaveLength(1);
    });

    it('renders all projects if open membership is enabled and user selects all teams', async function () {
      const openOrg = OrganizationFixture({features: ['open-membership']});
      const teamA = TeamFixture({slug: 'team1', isMember: true});
      const teamB = TeamFixture({id: '2', slug: 'team2', name: 'team2', isMember: false});
      const teamProjects = [
        ProjectFixture({
          id: '1',
          slug: 'project1',
          teams: [teamA],
          firstEvent: new Date().toISOString(),
          stats: [],
        }),
      ];
      teamA.projects = teamProjects;

      const teamBProjects = [
        ProjectFixture({
          id: '2',
          slug: 'project2',
          teams: [teamB],
          firstEvent: new Date().toISOString(),
          stats: [],
        }),
      ];
      teamB.projects = teamBProjects;

      ProjectsStore.loadInitialData([...teamProjects, ...teamBProjects]);
      const teamWithTwoProjects = TeamFixture({projects: teamProjects});
      TeamStore.loadInitialData([teamWithTwoProjects, teamA, teamB]);

      const {router} = render(<ProjectsDashboard />, {
        organization: openOrg,
        disableRouterMocks: true,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/projects/',
          },
        },
      });
      // Open My Teams dropdown
      await userEvent.click(await screen.findByText('My Teams'));
      // Select "All Teams" by clearing the selection
      await userEvent.click(screen.getByRole('button', {name: 'Clear'}));
      // Close dropdown by clicking outside
      await userEvent.click(document.body);

      expect(await screen.findByText('All Teams')).toBeInTheDocument();
      expect(screen.getAllByTestId('badge-display-name')).toHaveLength(2);

      await userEvent.click(screen.getByText('All Teams'));
      expect(await screen.findByText('Other Teams')).toBeInTheDocument();
      expect(screen.getByText('#team2')).toBeInTheDocument();
      expect(router.location.query).toEqual({team: ''});
    });

    it('renders projects for specific team that user is not a member of', async function () {
      const openMembershipOrg = OrganizationFixture({features: ['open-membership']});
      const teamB = TeamFixture({id: '2', slug: 'team2', name: 'team2', isMember: false});

      const teamA = TeamFixture({id: '1', slug: 'team1', name: 'team1', isMember: true});
      const teamAProjects = [
        ProjectFixture({
          id: '1',
          slug: 'project1',
          teams: [teamA],
          firstEvent: new Date().toISOString(),
          stats: [],
        }),
      ];
      teamA.projects = teamAProjects;

      const teamBProjects = [
        ProjectFixture({
          id: '2',
          slug: 'project2',
          name: 'project2',
          teams: [teamB],
          firstEvent: new Date().toISOString(),
          stats: [],
          isMember: false,
        }),
      ];
      teamB.projects = teamBProjects;

      ProjectsStore.loadInitialData([...teamAProjects, ...teamBProjects]);
      TeamStore.loadInitialData([teamA, teamB]);

      const {router} = render(<ProjectsDashboard />, {
        organization: openMembershipOrg,
        disableRouterMocks: true,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/projects/',
          },
        },
      });
      // Open dropdown
      await userEvent.click(await screen.findByText('My Teams'));
      // Clear "My Teams" and select "team2"
      await userEvent.click(screen.getByRole('button', {name: 'Clear'}));
      await userEvent.click(screen.getByRole('option', {name: '#team2'}));
      // Click outside the dropdown to close it
      await userEvent.click(document.body);

      expect(await screen.findByText('#team2')).toBeInTheDocument();
      expect(router.location.query).toEqual({team: '2'});
      expect(screen.getByText('project2')).toBeInTheDocument();
      expect(screen.getAllByTestId('badge-display-name')).toHaveLength(1);
    });

    it('renders only projects for my teams if open membership is disabled', async function () {
      const {organization: closedOrg, router} = initializeOrg({
        organization: {features: []},
        router: {
          // All projects
          location: {query: {team: ''}},
        },
      });
      const teamA = TeamFixture({slug: 'team1', isMember: true});
      const teamProjects = [
        ProjectFixture({
          id: '1',
          slug: 'project1',
          teams: [teamA],
          firstEvent: new Date().toISOString(),
          stats: [],
        }),
      ];
      teamA.projects = teamProjects;

      ProjectsStore.loadInitialData([
        ...teamProjects,
        ProjectFixture({
          id: '2',
          slug: 'project2',
          teams: [],
          firstEvent: new Date().toISOString(),
          stats: [],
        }),
      ]);
      const teamsWithTwoProjects = [
        TeamFixture({id: '2', slug: 'team2', projects: teamProjects, isMember: false}),
      ];
      TeamStore.loadInitialData([...teamsWithTwoProjects, teamA]);

      render(<ProjectsDashboard />, {
        router,
        organization: closedOrg,
      });
      expect(await screen.findByText('All Teams')).toBeInTheDocument();
      expect(screen.getAllByTestId('badge-display-name')).toHaveLength(1);
      expect(screen.getByText('project1')).toBeInTheDocument();
      expect(screen.queryByText('project2')).not.toBeInTheDocument();
    });

    it('renders correct project with selected team', async function () {
      const teamC = TeamFixture({
        id: '1',
        slug: 'teamC',
        isMember: true,
        projects: [
          ProjectFixture({
            id: '1',
            slug: 'project1',
            stats: [],
          }),
          ProjectFixture({
            id: '2',
            slug: 'project2',
            stats: [],
          }),
        ],
      });
      const teamD = TeamFixture({
        id: '2',
        slug: 'teamD',
        isMember: true,
        projects: [
          ProjectFixture({
            id: '3',
            slug: 'project3',
          }),
        ],
      });

      const teamsWithSpecificProjects = [teamC, teamD];
      TeamStore.loadInitialData(teamsWithSpecificProjects);

      const projects = [
        ProjectFixture({
          id: '1',
          slug: 'project1',
          teams: [teamC],
          firstEvent: new Date().toISOString(),
          stats: [],
        }),
        ProjectFixture({
          id: '2',
          slug: 'project2',
          teams: [teamC],
          isBookmarked: true,
          firstEvent: new Date().toISOString(),
          stats: [],
        }),
        ProjectFixture({
          id: '3',
          slug: 'project3',
          teams: [teamD],
          firstEvent: new Date().toISOString(),
          stats: [],
        }),
      ];

      ProjectsStore.loadInitialData(projects);
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/projects/`,
        body: projects,
      });

      const router = RouterFixture({
        location: {
          pathname: '',
          hash: '',
          state: '',
          action: 'PUSH',
          key: '',
          query: {team: '2'},
          search: '?team=2`',
        },
      });

      render(<ProjectsDashboard />, {router});

      expect(await screen.findByText('project3')).toBeInTheDocument();
      expect(screen.queryByText('project2')).not.toBeInTheDocument();
    });

    it('renders projects by search', async function () {
      const teamA = TeamFixture({slug: 'team1', isMember: true});
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/projects/`,
        body: [],
      });
      const projects = [
        ProjectFixture({
          id: '1',
          slug: 'project1',
          teams: [teamA],
          firstEvent: new Date().toISOString(),
          stats: [],
        }),
        ProjectFixture({
          id: '2',
          slug: 'project2',
          teams: [teamA],
          isBookmarked: true,
          firstEvent: new Date().toISOString(),
          stats: [],
        }),
      ];

      ProjectsStore.loadInitialData(projects);
      const teamsWithTwoProjects = [TeamFixture({projects})];
      TeamStore.loadInitialData(teamsWithTwoProjects);
      render(<ProjectsDashboard />);
      await userEvent.type(
        screen.getByPlaceholderText('Search for projects by name'),
        'project2{enter}'
      );
      expect(screen.getByText('project2')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByText('project1')).not.toBeInTheDocument();
      });
      expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
    });

    it('renders bookmarked projects first in team list', async function () {
      const teamA = TeamFixture({slug: 'team1', isMember: true});
      const projects = [
        ProjectFixture({
          id: '11',
          slug: 'm',
          teams: [teamA],
          isBookmarked: false,
          stats: [],
        }),
        ProjectFixture({
          id: '12',
          slug: 'm-fave',
          teams: [teamA],
          isBookmarked: true,
          stats: [],
        }),
        ProjectFixture({
          id: '13',
          slug: 'a-fave',
          teams: [teamA],
          isBookmarked: true,
          stats: [],
        }),
        ProjectFixture({
          id: '14',
          slug: 'z-fave',
          teams: [teamA],
          isBookmarked: true,
          stats: [],
        }),
        ProjectFixture({
          id: '15',
          slug: 'a',
          teams: [teamA],
          isBookmarked: false,
          stats: [],
        }),
        ProjectFixture({
          id: '16',
          slug: 'z',
          teams: [teamA],
          isBookmarked: false,
          stats: [],
        }),
      ];

      ProjectsStore.loadInitialData(projects);
      const teamsWithFavProjects = [TeamFixture({projects})];
      TeamStore.loadInitialData(teamsWithFavProjects);

      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/projects/`,
        body: [
          ProjectFixture({
            teams,
            stats: [
              [1517281200, 2],
              [1517310000, 1],
            ],
          }),
        ],
      });

      render(<ProjectsDashboard />);

      // check that all projects are displayed
      await waitFor(() =>
        expect(screen.getAllByTestId('badge-display-name')).toHaveLength(6)
      );

      const projectName = screen.getAllByTestId('badge-display-name');
      // check that projects are in the correct order - alphabetical with bookmarked projects in front
      expect(within(projectName[0]!).getByText('a-fave')).toBeInTheDocument();
      expect(within(projectName[1]!).getByText('m-fave')).toBeInTheDocument();
      expect(within(projectName[2]!).getByText('z-fave')).toBeInTheDocument();
      expect(within(projectName[3]!).getByText('a')).toBeInTheDocument();
      expect(within(projectName[4]!).getByText('m')).toBeInTheDocument();
      expect(within(projectName[5]!).getByText('z')).toBeInTheDocument();
    });
  });

  describe('ProjectsStatsStore', function () {
    const teamA = TeamFixture({slug: 'team1', isMember: true});
    const projects = [
      ProjectFixture({
        id: '1',
        slug: 'm',
        teams,
        isBookmarked: false,
      }),
      ProjectFixture({
        id: '2',
        slug: 'm-fave',
        teams: [teamA],
        isBookmarked: true,
      }),
      ProjectFixture({
        id: '3',
        slug: 'a-fave',
        teams: [teamA],
        isBookmarked: true,
      }),
      ProjectFixture({
        id: '4',
        slug: 'z-fave',
        teams: [teamA],
        isBookmarked: true,
      }),
      ProjectFixture({
        id: '5',
        slug: 'a',
        teams: [teamA],
        isBookmarked: false,
      }),
      ProjectFixture({
        id: '6',
        slug: 'z',
        teams: [teamA],
        isBookmarked: false,
      }),
    ];

    beforeEach(function () {
      const teamsWithStatTestProjects = [TeamFixture({projects})];
      TeamStore.loadInitialData(teamsWithStatTestProjects);
    });

    it('uses ProjectsStatsStore to load stats', async function () {
      ProjectsStore.loadInitialData(projects);

      jest.useFakeTimers();
      ProjectsStatsStore.onStatsLoadSuccess([
        {...projects[0]!, stats: [[1517281200, 2]]},
      ]);
      const loadStatsSpy = jest.spyOn(projectsActions, 'loadStatsForProject');
      const mock = MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/projects/`,
        body: projects.map(project => ({
          ...project,
          stats: [
            [1517281200, 2],
            [1517310000, 1],
          ],
        })),
      });

      const {unmount} = render(<ProjectsDashboard />);

      expect(loadStatsSpy).toHaveBeenCalledTimes(6);
      expect(mock).not.toHaveBeenCalled();

      const projectSummary = screen.getAllByTestId('summary-links');
      // Has 5 Loading Cards because 1 project has been loaded in store already
      expect(
        within(projectSummary[0]!).getByTestId('loading-placeholder')
      ).toBeInTheDocument();
      expect(
        within(projectSummary[1]!).getByTestId('loading-placeholder')
      ).toBeInTheDocument();
      expect(
        within(projectSummary[2]!).getByTestId('loading-placeholder')
      ).toBeInTheDocument();
      expect(
        within(projectSummary[3]!).getByTestId('loading-placeholder')
      ).toBeInTheDocument();
      expect(within(projectSummary[4]!).getByText('Errors: 2')).toBeInTheDocument();
      expect(
        within(projectSummary[5]!).getByTestId('loading-placeholder')
      ).toBeInTheDocument();

      // Advance timers so that batched request fires
      act(() => jest.advanceTimersByTime(51));
      expect(mock).toHaveBeenCalledTimes(1);
      // query ids = 3, 2, 4 = bookmarked
      // 1 - already loaded in store so shouldn't be in query
      expect(mock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            query: 'id:3 id:2 id:4 id:5 id:6',
          }),
        })
      );
      jest.useRealTimers();

      // All cards have loaded
      await waitFor(() => {
        expect(within(projectSummary[0]!).getByText('Errors: 3')).toBeInTheDocument();
      });
      expect(within(projectSummary[1]!).getByText('Errors: 3')).toBeInTheDocument();
      expect(within(projectSummary[2]!).getByText('Errors: 3')).toBeInTheDocument();
      expect(within(projectSummary[3]!).getByText('Errors: 3')).toBeInTheDocument();
      expect(within(projectSummary[4]!).getByText('Errors: 3')).toBeInTheDocument();
      expect(within(projectSummary[5]!).getByText('Errors: 3')).toBeInTheDocument();

      // Resets store when it unmounts
      unmount();
      expect(ProjectsStatsStore.getAll()).toEqual({});
    });
  });
});
