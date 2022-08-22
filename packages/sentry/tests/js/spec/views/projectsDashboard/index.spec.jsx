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
import {Dashboard} from 'sentry/views/projectsDashboard';

jest.unmock('lodash/debounce');
jest.mock('lodash/debounce', () => {
  const debounceMap = new Map();
  const mockDebounce =
    (fn, timeout) =>
    (...args) => {
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
  const org = TestStubs.Organization();
  const team = TestStubs.Team();
  const teams = [team];

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: `/teams/${org.slug}/${team.slug}/members/`,
      body: [],
    });
    ProjectsStatsStore.reset();
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  describe('empty state', function () {
    it('renders with no projects', function () {
      const noProjectTeams = [TestStubs.Team({isMember: false, projects: []})];
      ProjectsStore.loadInitialData([]);

      render(
        <Dashboard teams={noProjectTeams} organization={org} params={{orgId: org.slug}} />
      );

      expect(screen.queryByTestId('join-team')).not.toBeInTheDocument();
      expect(screen.queryByTestId('create-project')).not.toBeInTheDocument();
      expect(screen.getByText('Remain Calm')).toBeInTheDocument();
    });

    it('renders with 1 project, with no first event', function () {
      const projects = TestStubs.Project({teams, firstEvent: false});

      const teamsWithOneProject = [TestStubs.Team({projects})];

      render(
        <Dashboard
          teams={teamsWithOneProject}
          organization={org}
          params={{orgId: org.slug}}
        />
      );

      expect(screen.getByTestId('join-team')).toBeInTheDocument();
      expect(screen.getByTestId('create-project')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('Search for projects by name')
      ).toBeInTheDocument();
      expect(screen.getByText('My Teams')).toBeInTheDocument();
      expect(screen.getByText('Resources')).toBeInTheDocument();
      expect(screen.getByTestId('badge-display-name')).toBeInTheDocument();
    });
  });

  describe('with projects', function () {
    it('renders with two projects', function () {
      const teamA = TestStubs.Team({slug: 'team1', isMember: true});
      const projects = [
        TestStubs.Project({
          id: '1',
          slug: 'project1',
          teams: [teamA],
          firstEvent: true,
        }),
        TestStubs.Project({
          id: '2',
          slug: 'project2',
          teams: [teamA],
          isBookmarked: true,
          firstEvent: true,
        }),
      ];

      const teamsWithTwoProjects = [TestStubs.Team({projects})];

      render(
        <Dashboard
          teams={teamsWithTwoProjects}
          organization={org}
          params={{orgId: org.slug}}
        />
      );
      expect(screen.getByText('My Teams')).toBeInTheDocument();
      expect(screen.getAllByTestId('badge-display-name')).toHaveLength(2);
    });

    it('renders correct project with selected team', function () {
      const teamC = TestStubs.Team({
        id: '1',
        slug: 'teamC',
        isMember: true,
        projects: [
          TestStubs.Project({
            id: '1',
            slug: 'project1',
          }),
          TestStubs.Project({
            id: '2',
            slug: 'project2',
          }),
        ],
      });
      const teamD = TestStubs.Team({
        id: '2',
        slug: 'teamD',
        isMember: true,
        projects: [
          TestStubs.Project({
            id: '3',
            slug: 'project3',
          }),
        ],
      });

      const projectWithTeam = [teamC, teamD];

      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/teams/?team=2`,
        body: projectWithTeam,
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/projects/`,
        body: [
          TestStubs.Project({
            id: '1',
            slug: 'project1',
            teams: [teamC],
            firstEvent: true,
            stats: [],
          }),
          TestStubs.Project({
            id: '2',
            slug: 'project2',
            teams: [teamC],
            isBookmarked: true,
            firstEvent: true,
            stats: [],
          }),
          TestStubs.Project({
            id: '3',
            slug: 'project3',
            teams: [teamD],
            firstEvent: true,
            stats: [],
          }),
        ],
      });

      render(
        <Dashboard
          teams={projectWithTeam}
          organization={org}
          params={{orgId: org.slug}}
          location={{
            query: {team: '2'},
            search: '?team=2`',
          }}
        />
      );

      expect(screen.getByText('project3')).toBeInTheDocument();
      expect(screen.queryByText('project2')).not.toBeInTheDocument();
    });

    it('renders projects by search', async function () {
      const teamA = TestStubs.Team({slug: 'team1', isMember: true});
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/projects/`,
        body: [],
      });
      const projects = [
        TestStubs.Project({
          id: '1',
          slug: 'project1',
          teams: [teamA],
          firstEvent: true,
        }),
        TestStubs.Project({
          id: '2',
          slug: 'project2',
          teams: [teamA],
          isBookmarked: true,
          firstEvent: true,
        }),
      ];

      const teamsWithTwoProjects = [TestStubs.Team({projects})];

      render(
        <Dashboard
          teams={teamsWithTwoProjects}
          organization={org}
          params={{orgId: org.slug}}
        />
      );
      userEvent.type(
        screen.getByPlaceholderText('Search for projects by name'),
        'project2',
        '{enter}'
      );
      expect(screen.getByText('project2')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByText('project1')).not.toBeInTheDocument();
      });
    });

    it('renders bookmarked projects first in team list', function () {
      const teamA = TestStubs.Team({slug: 'team1', isMember: true});
      const projects = [
        TestStubs.Project({
          id: '11',
          slug: 'm',
          teams: [teamA],
          isBookmarked: false,
          stats: [],
        }),
        TestStubs.Project({
          id: '12',
          slug: 'm-fave',
          teams: [teamA],
          isBookmarked: true,
          stats: [],
        }),
        TestStubs.Project({
          id: '13',
          slug: 'a-fave',
          teams: [teamA],
          isBookmarked: true,
          stats: [],
        }),
        TestStubs.Project({
          id: '14',
          slug: 'z-fave',
          teams: [teamA],
          isBookmarked: true,
          stats: [],
        }),
        TestStubs.Project({
          id: '15',
          slug: 'a',
          teams: [teamA],
          isBookmarked: false,
          stats: [],
        }),
        TestStubs.Project({
          id: '16',
          slug: 'z',
          teams: [teamA],
          isBookmarked: false,
          stats: [],
        }),
      ];

      const teamsWithFavProjects = [TestStubs.Team({projects})];

      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/projects/`,
        body: [
          TestStubs.Project({
            teams,
            stats: [
              [1517281200, 2],
              [1517310000, 1],
            ],
          }),
        ],
      });

      jest.useFakeTimers();
      render(
        <Dashboard
          teams={teamsWithFavProjects}
          organization={org}
          params={{orgId: org.slug}}
        />
      );

      jest.runAllTimers();
      jest.useRealTimers();
      // check that all projects are displayed
      expect(screen.getAllByTestId('badge-display-name')).toHaveLength(6);

      const projectName = screen.getAllByTestId('badge-display-name');
      // check that projects are in the correct order - alphabetical with bookmarked projects in front
      expect(within(projectName[0]).getByText('a-fave')).toBeInTheDocument();
      expect(within(projectName[1]).getByText('m-fave')).toBeInTheDocument();
      expect(within(projectName[2]).getByText('z-fave')).toBeInTheDocument();
      expect(within(projectName[3]).getByText('a')).toBeInTheDocument();
      expect(within(projectName[4]).getByText('m')).toBeInTheDocument();
      expect(within(projectName[5]).getByText('z')).toBeInTheDocument();
    });
  });

  describe('ProjectsStatsStore', function () {
    const teamA = TestStubs.Team({slug: 'team1', isMember: true});
    const projects = [
      TestStubs.Project({
        id: '1',
        slug: 'm',
        teams,
        isBookmarked: false,
      }),
      TestStubs.Project({
        id: '2',
        slug: 'm-fave',
        teams: [teamA],
        isBookmarked: true,
      }),
      TestStubs.Project({
        id: '3',
        slug: 'a-fave',
        teams: [teamA],
        isBookmarked: true,
      }),
      TestStubs.Project({
        id: '4',
        slug: 'z-fave',
        teams: [teamA],
        isBookmarked: true,
      }),
      TestStubs.Project({
        id: '5',
        slug: 'a',
        teams: [teamA],
        isBookmarked: false,
      }),
      TestStubs.Project({
        id: '6',
        slug: 'z',
        teams: [teamA],
        isBookmarked: false,
      }),
    ];

    const teamsWithStatTestProjects = [TestStubs.Team({projects})];

    it('uses ProjectsStatsStore to load stats', async function () {
      jest.useFakeTimers();
      ProjectsStatsStore.onStatsLoadSuccess([{...projects[0], stats: [[1517281200, 2]]}]);
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

      const {unmount} = render(
        <Dashboard
          teams={teamsWithStatTestProjects}
          organization={org}
          params={{orgId: org.slug}}
        />
      );

      expect(loadStatsSpy).toHaveBeenCalledTimes(6);
      expect(mock).not.toHaveBeenCalled();

      const projectSummary = screen.getAllByTestId('summary-links');
      // Has 5 Loading Cards because 1 project has been loaded in store already
      expect(
        within(projectSummary[0]).getByTestId('loading-placeholder')
      ).toBeInTheDocument();
      expect(
        within(projectSummary[1]).getByTestId('loading-placeholder')
      ).toBeInTheDocument();
      expect(
        within(projectSummary[2]).getByTestId('loading-placeholder')
      ).toBeInTheDocument();
      expect(
        within(projectSummary[3]).getByTestId('loading-placeholder')
      ).toBeInTheDocument();
      expect(within(projectSummary[4]).getByText('Errors: 2')).toBeInTheDocument();
      expect(
        within(projectSummary[5]).getByTestId('loading-placeholder')
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
        expect(within(projectSummary[0]).getByText('Errors: 3')).toBeInTheDocument();
      });
      expect(within(projectSummary[1]).getByText('Errors: 3')).toBeInTheDocument();
      expect(within(projectSummary[2]).getByText('Errors: 3')).toBeInTheDocument();
      expect(within(projectSummary[3]).getByText('Errors: 3')).toBeInTheDocument();
      expect(within(projectSummary[4]).getByText('Errors: 3')).toBeInTheDocument();
      expect(within(projectSummary[5]).getByText('Errors: 3')).toBeInTheDocument();

      // Resets store when it unmounts
      unmount();
      expect(ProjectsStatsStore.getAll()).toEqual({});
    });

    it('renders an error from withTeamsForUser', function () {
      render(
        <Dashboard error={Error('uhoh')} organization={org} params={{orgId: org.slug}} />
      );

      expect(
        screen.getByText('An error occurred while fetching your projects')
      ).toBeInTheDocument();
    });
  });
});
