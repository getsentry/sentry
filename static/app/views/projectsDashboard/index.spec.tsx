import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TeamStore} from 'sentry/stores/teamStore';
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

describe('ProjectsDashboard', () => {
  const org = OrganizationFixture();
  const team = TeamFixture();
  const teams = [team];

  beforeEach(() => {
    TeamStore.loadInitialData(teams);
    MockApiClient.addMockResponse({
      url: `/teams/${org.slug}/${team.slug}/members/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [],
    });
    ProjectsStore.loadInitialData([]);
  });

  afterEach(() => {
    TeamStore.reset();
    MockApiClient.clearMockResponses();
  });

  describe('empty state', () => {
    it('renders with 1 project, with no first event', async () => {
      const projects = [ProjectFixture({teams, firstEvent: null})];
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
    });
  });

  describe('with projects', () => {
    it('renders with two projects', async () => {
      const teamA = TeamFixture({slug: 'team1', isMember: true});
      const projects = [
        ProjectFixture({
          id: '1',
          slug: 'project1',
          teams: [teamA],
          firstEvent: new Date().toISOString(),
        }),
        ProjectFixture({
          id: '2',
          slug: 'project2',
          teams: [teamA],
          isBookmarked: true,
          firstEvent: new Date().toISOString(),
        }),
      ];

      ProjectsStore.loadInitialData(projects);
      const teamsWithTwoProjects = [TeamFixture({projects})];
      TeamStore.loadInitialData(teamsWithTwoProjects);
      render(<ProjectsDashboard />);
      expect(await screen.findByText('My Teams')).toBeInTheDocument();
      expect(screen.getAllByTestId('badge-display-name')).toHaveLength(2);
    });

    it('renders only projects for my teams by default', async () => {
      const teamA = TeamFixture({slug: 'team1', isMember: true, projects: undefined});
      const teamProjects = [
        ProjectFixture({
          id: '1',
          slug: 'project1',
          teams: [teamA],
          firstEvent: new Date().toISOString(),
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
        }),
      ]);
      const teamsWithTwoProjects = [TeamFixture({projects: teamProjects})];
      TeamStore.loadInitialData(teamsWithTwoProjects);

      render(<ProjectsDashboard />);
      expect(await screen.findByText('My Teams')).toBeInTheDocument();
      expect(screen.getAllByTestId('badge-display-name')).toHaveLength(1);
    });

    it('renders all projects if open membership is enabled and user selects all teams', async () => {
      const openOrg = OrganizationFixture({features: ['open-membership']});
      const teamA = TeamFixture({slug: 'team1', isMember: true});
      const teamB = TeamFixture({id: '2', slug: 'team2', name: 'team2', isMember: false});
      const teamProjects = [
        ProjectFixture({
          id: '1',
          slug: 'project1',
          teams: [teamA],
          firstEvent: new Date().toISOString(),
        }),
      ];
      teamA.projects = teamProjects;

      const teamBProjects = [
        ProjectFixture({
          id: '2',
          slug: 'project2',
          teams: [teamB],
          firstEvent: new Date().toISOString(),
        }),
      ];
      teamB.projects = teamBProjects;

      ProjectsStore.loadInitialData([...teamProjects, ...teamBProjects]);
      const teamWithTwoProjects = TeamFixture({projects: teamProjects});
      TeamStore.loadInitialData([teamWithTwoProjects, teamA, teamB]);

      const {router} = render(<ProjectsDashboard />, {
        organization: openOrg,

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

    it('renders projects for specific team that user is not a member of', async () => {
      const openMembershipOrg = OrganizationFixture({features: ['open-membership']});
      const teamB = TeamFixture({id: '2', slug: 'team2', name: 'team2', isMember: false});

      const teamA = TeamFixture({id: '1', slug: 'team1', name: 'team1', isMember: true});
      const teamAProjects = [
        ProjectFixture({
          id: '1',
          slug: 'project1',
          teams: [teamA],
          firstEvent: new Date().toISOString(),
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
          isMember: false,
        }),
      ];
      teamB.projects = teamBProjects;

      ProjectsStore.loadInitialData([...teamAProjects, ...teamBProjects]);
      TeamStore.loadInitialData([teamA, teamB]);

      const {router} = render(<ProjectsDashboard />, {
        organization: openMembershipOrg,

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

    it('renders only projects for my teams if open membership is disabled', async () => {
      const closedOrg = OrganizationFixture({features: []});
      const teamA = TeamFixture({slug: 'team1', isMember: true});
      const teamProjects = [
        ProjectFixture({
          id: '1',
          slug: 'project1',
          teams: [teamA],
          firstEvent: new Date().toISOString(),
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
        }),
      ]);
      const teamsWithTwoProjects = [
        TeamFixture({id: '2', slug: 'team2', projects: teamProjects, isMember: false}),
      ];
      TeamStore.loadInitialData([...teamsWithTwoProjects, teamA]);

      render(<ProjectsDashboard />, {
        organization: closedOrg,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/projects/',
            query: {team: ''},
          },
        },
      });
      expect(await screen.findByText('All Teams')).toBeInTheDocument();
      expect(screen.getAllByTestId('badge-display-name')).toHaveLength(1);
      expect(screen.getByText('project1')).toBeInTheDocument();
      expect(screen.queryByText('project2')).not.toBeInTheDocument();
    });

    it('renders correct project with selected team', async () => {
      const teamC = TeamFixture({
        id: '1',
        slug: 'teamC',
        isMember: true,
        projects: [
          ProjectFixture({
            id: '1',
            slug: 'project1',
          }),
          ProjectFixture({
            id: '2',
            slug: 'project2',
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
        }),
        ProjectFixture({
          id: '2',
          slug: 'project2',
          teams: [teamC],
          isBookmarked: true,
          firstEvent: new Date().toISOString(),
        }),
        ProjectFixture({
          id: '3',
          slug: 'project3',
          teams: [teamD],
          firstEvent: new Date().toISOString(),
        }),
        ProjectFixture({
          id: '4',
          slug: 'project4',
          teams: [],
          firstEvent: new Date().toISOString(),
        }),
      ];

      ProjectsStore.loadInitialData(projects);
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/projects/`,
        body: projects,
      });

      render(<ProjectsDashboard />, {
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/projects/',
            query: {team: '2'},
          },
        },
      });

      expect(await screen.findByText('project3')).toBeInTheDocument();
      expect(screen.queryByText('project2')).not.toBeInTheDocument();
      expect(screen.queryByText('project4')).not.toBeInTheDocument();
    });

    it('renders projects by search', async () => {
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
        }),
        ProjectFixture({
          id: '2',
          slug: 'project2',
          teams: [teamA],
          isBookmarked: true,
          firstEvent: new Date().toISOString(),
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
    });

    it('renders bookmarked projects first in team list', async () => {
      const teamA = TeamFixture({slug: 'team1', isMember: true});
      const projects = [
        ProjectFixture({
          id: '11',
          slug: 'm',
          teams: [teamA],
          isBookmarked: false,
        }),
        ProjectFixture({
          id: '12',
          slug: 'm-fave',
          teams: [teamA],
          isBookmarked: true,
        }),
        ProjectFixture({
          id: '13',
          slug: 'a-fave',
          teams: [teamA],
          isBookmarked: true,
        }),
        ProjectFixture({
          id: '14',
          slug: 'z-fave',
          teams: [teamA],
          isBookmarked: true,
        }),
        ProjectFixture({
          id: '15',
          slug: 'a',
          teams: [teamA],
          isBookmarked: false,
        }),
        ProjectFixture({
          id: '16',
          slug: 'z',
          teams: [teamA],
          isBookmarked: false,
        }),
      ];

      ProjectsStore.loadInitialData(projects);
      const teamsWithFavProjects = [TeamFixture({projects})];
      TeamStore.loadInitialData(teamsWithFavProjects);

      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/projects/`,
        body: [ProjectFixture({teams})],
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
});
