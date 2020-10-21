import {mountWithTheme} from 'sentry-test/enzyme';

import {Dashboard} from 'app/views/projectsDashboard';
import ProjectsStatsStore from 'app/stores/projectsStatsStore';
import * as projectsActions from 'app/actionCreators/projects';

jest.unmock('lodash/debounce');
jest.mock('lodash/debounce', () => {
  const debounceMap = new Map();
  const mockDebounce = (fn, timeout) => (...args) => {
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
  const routerContext = TestStubs.routerContext([
    {router: TestStubs.router({params: {orgId: org.slug}})},
  ]);

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
      const noProjectTeams = [TestStubs.Team({projects: []})];

      const wrapper = mountWithTheme(
        <Dashboard
          teams={noProjectTeams}
          organization={org}
          params={{orgId: org.slug}}
        />,
        routerContext
      );

      expect(wrapper.find('Button[data-test-id="create-project"]').exists()).toBe(false);
      expect(wrapper.find('NoProjectMessage').exists()).toBe(true);
    });

    it('renders with 1 project, with no first event', function () {
      const projects = [TestStubs.Project({teams})];

      const teamsWithOneProject = [TestStubs.Team({projects})];

      const wrapper = mountWithTheme(
        <Dashboard
          teams={teamsWithOneProject}
          organization={org}
          params={{orgId: org.slug}}
        />,
        routerContext
      );

      expect(wrapper.find('Button[data-test-id="create-project"]').exists()).toBe(true);
      expect(wrapper.find('TeamSection').exists()).toBe(true);
      expect(wrapper.find('Resources').exists()).toBe(true);
    });
  });

  describe('with projects', function () {
    it('renders TeamSection with two projects', function () {
      const projects = [
        TestStubs.Project({
          teams,
          firstEvent: true,
        }),

        TestStubs.Project({
          slug: 'project2',
          teams,
          isBookmarked: true,
          firstEvent: true,
        }),
      ];

      const teamsWithTwoProjects = [TestStubs.Team({projects})];

      const wrapper = mountWithTheme(
        <Dashboard
          teams={teamsWithTwoProjects}
          organization={org}
          params={{orgId: org.slug}}
        />,
        routerContext
      );

      expect(wrapper.find('Button[data-test-id="create-project"]').exists()).toBe(true);
      expect(wrapper.find('NoProjectMessage').exists()).toBe(false);
      expect(wrapper.find('TeamSection').exists()).toBe(true);
      expect(wrapper.find('Resources').exists()).toBe(false);
    });

    it('renders bookmarked projects first in team list', function () {
      const projects = [
        TestStubs.Project({
          id: '1',
          slug: 'm',
          teams,
          isBookmarked: false,
          stats: [],
        }),
        TestStubs.Project({
          id: '2',
          slug: 'm-fave',
          teams,
          isBookmarked: true,
          stats: [],
        }),
        TestStubs.Project({
          id: '3',
          slug: 'a-fave',
          teams,
          isBookmarked: true,
          stats: [],
        }),
        TestStubs.Project({
          id: '4',
          slug: 'z-fave',
          teams,
          isBookmarked: true,
          stats: [],
        }),
        TestStubs.Project({
          id: '5',
          slug: 'a',
          teams,
          isBookmarked: false,
          stats: [],
        }),
        TestStubs.Project({
          id: '6',
          slug: 'z',
          teams,
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
      const wrapper = mountWithTheme(
        <Dashboard
          teams={teamsWithFavProjects}
          organization={org}
          params={{orgId: org.slug}}
        />,
        routerContext
      );

      jest.runAllTimers();
      jest.useRealTimers();

      const projectCards = wrapper.find('LazyLoadMock ProjectCard');
      expect(projectCards.at(0).prop('data-test-id')).toBe('a-fave');
      expect(projectCards.at(1).prop('data-test-id')).toBe('m-fave');
      expect(projectCards.at(2).prop('data-test-id')).toBe('z-fave');
      expect(projectCards.at(3).prop('data-test-id')).toBe('a');
      expect(projectCards.at(4).prop('data-test-id')).toBe('m');
      expect(projectCards.at(5).prop('data-test-id')).toBe('z');
    });
  });

  describe('ProjectsStatsStore', function () {
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
        teams,
        isBookmarked: true,
      }),
      TestStubs.Project({
        id: '3',
        slug: 'a-fave',
        teams,
        isBookmarked: true,
      }),
      TestStubs.Project({
        id: '4',
        slug: 'z-fave',
        teams,
        isBookmarked: true,
      }),
      TestStubs.Project({
        id: '5',
        slug: 'a',
        teams,
        isBookmarked: false,
      }),
      TestStubs.Project({
        id: '6',
        slug: 'z',
        teams,
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

      const wrapper = mountWithTheme(
        <Dashboard
          teams={teamsWithStatTestProjects}
          organization={org}
          params={{orgId: org.slug}}
        />,
        routerContext
      );

      expect(loadStatsSpy).toHaveBeenCalledTimes(6);
      expect(mock).not.toHaveBeenCalled();

      // Has 5 Loading Cards because 1 project has been loaded in store already
      expect(wrapper.find('LoadingCard')).toHaveLength(5);

      // Advance timers so that batched request fires
      jest.advanceTimersByTime(51);
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
      await tick();
      await tick();
      wrapper.update();
      expect(wrapper.find('LoadingCard')).toHaveLength(0);
      expect(wrapper.find('Chart')).toHaveLength(6);

      // Resets store when it unmounts
      wrapper.unmount();
      expect(ProjectsStatsStore.getAll()).toEqual({});
    });

    it('renders an error from withTeamsForUser', function () {
      const wrapper = mountWithTheme(
        <Dashboard error={Error('uhoh')} organization={org} params={{orgId: org.slug}} />,
        routerContext
      );

      expect(wrapper.find('LoadingError').exists()).toBe(true);
    });
  });
});
