import React from 'react';
import {shallow, mount} from 'enzyme';

import {Dashboard} from 'app/views/organizationProjectsDashboard';
import ProjectsStatsStore from 'app/stores/projectsStatsStore';
import * as projectsActions from 'app/actionCreators/projects';

jest.unmock('lodash/debounce');
jest.mock('lodash/debounce', () => {
  const debounceMap = new Map();
  const mockDebounce = (fn, timeout) => {
    return (...args) => {
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
  };
  return mockDebounce;
});

describe('OrganizationDashboard', function() {
  const routerContext = TestStubs.routerContext();
  routerContext.context.router = {
    ...routerContext.context.router,
    params: {
      orgId: 'org-slug',
    },
  };
  const teams = [TestStubs.Team()];

  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: '/teams/org-slug/team-slug/members/',
      body: [],
    });
    ProjectsStatsStore.reset();
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  describe('empty state', function() {
    beforeEach(function() {});

    it('renders with no projects', function() {
      const projects = [];

      const wrapper = shallow(
        <Dashboard
          teams={teams}
          projects={projects}
          organization={TestStubs.Organization()}
          params={{orgId: 'org-slug'}}
        />,
        TestStubs.routerContext()
      );
      const emptyState = wrapper.find('NoProjectMessage');
      expect(emptyState).toHaveLength(1);
    });

    it('renders with 1 project, with no first event', function() {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/issues/',
        body: [{id: 'sampleIssueId'}],
      });
      const projects = [TestStubs.Project()];

      const wrapper = mount(
        <Dashboard
          teams={teams}
          projects={projects}
          organization={TestStubs.Organization()}
          params={{orgId: 'org-slug'}}
        />,
        TestStubs.routerContext()
      );
      const emptyState = wrapper.find('ErrorRobot');
      expect(emptyState).toHaveLength(1);

      expect(
        wrapper.find('Link[to="/org-slug/project-slug/issues/sampleIssueId/?sample"]')
      ).toHaveLength(1);
    });
  });

  describe('with projects', function() {
    beforeEach(function() {});

    it('renders TeamSection', function() {
      const projects = [
        TestStubs.Project({
          teams,
          firstEvent: true,
        }),
      ];

      const wrapper = shallow(
        <Dashboard
          teams={teams}
          projects={projects}
          organization={TestStubs.Organization()}
          params={{orgId: 'org-slug'}}
        />,
        TestStubs.routerContext()
      );
      const emptyState = wrapper.find('NoProjectMessage');
      const favorites = wrapper.find('TeamSection[data-test-id="favorites"]');
      const teamSection = wrapper.find('TeamSection');
      expect(emptyState).toHaveLength(0);
      expect(favorites).toHaveLength(0);
      expect(teamSection).toHaveLength(1);
    });

    it('renders favorited project in favorites section ', function() {
      const projects = [
        TestStubs.Project({
          teams,
          isBookmarked: true,
          firstEvent: true,
        }),
      ];

      const wrapper = shallow(
        <Dashboard
          teams={teams}
          projects={projects}
          organization={TestStubs.Organization()}
          params={{orgId: 'org-slug'}}
        />,
        TestStubs.routerContext()
      );
      const favorites = wrapper.find('TeamSection[data-test-id="favorites"]');
      expect(favorites).toHaveLength(1);
    });

    it('renders bookmarked projects first in team list', function() {
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
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: [
          TestStubs.Project({
            teams: [TestStubs.Team()],
            stats: [[1517281200, 2], [1517310000, 1]],
          }),
        ],
      });

      jest.useFakeTimers();
      const wrapper = mount(
        <Dashboard
          teams={teams}
          projects={projects}
          organization={TestStubs.Organization()}
          params={{orgId: 'org-slug'}}
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

    it('renders favorited projects if there is any, even if team list is empty', function() {
      const projects = [
        TestStubs.Project({
          id: '1',
          slug: 'm',
          teams: [],
          isBookmarked: true,
          stats: [],
          firstEvent: true,
        }),
      ];
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: projects,
      });

      const wrapper = mount(
        <Dashboard
          teams={[]}
          projects={projects}
          organization={TestStubs.Organization()}
          params={{orgId: 'org-slug'}}
        />,
        routerContext
      );

      expect(wrapper.find('TeamSection')).toHaveLength(1);
      const projectCards = wrapper.find('ProjectCard');
      expect(projectCards).toHaveLength(1);
      const emptyState = wrapper.find('NoProjectMessage');
      expect(emptyState).toHaveLength(0);
    });
  });

  describe('ProjectsStatsStore', function() {
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

    it('uses ProjectsStatsStore to load stats', async function() {
      jest.useFakeTimers();
      ProjectsStatsStore.onStatsLoadSuccess([{...projects[0], stats: [[1517281200, 2]]}]);
      const loadStatsSpy = jest.spyOn(projectsActions, 'loadStatsForProject');
      const mock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: projects.map(project => ({
          ...project,
          stats: [[1517281200, 2], [1517310000, 1]],
        })),
      });

      const wrapper = mount(
        <Dashboard
          teams={teams}
          projects={projects}
          organization={TestStubs.Organization()}
          params={{orgId: 'org-slug'}}
        />,
        routerContext
      );

      // Favorites = 3 + 6 for first team
      expect(loadStatsSpy).toHaveBeenCalledTimes(9);
      expect(mock).not.toHaveBeenCalled();

      // Has 8 Loading Cards because 1 project has been loaded in store already
      expect(wrapper.find('LoadingCard')).toHaveLength(8);

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
      expect(wrapper.find('Chart')).toHaveLength(9);

      // Resets store when it unmounts
      wrapper.unmount();
      expect(ProjectsStatsStore.getAll()).toEqual({});
    });
  });
});
