import React from 'react';
import {shallow} from 'enzyme';

import {Dashboard} from 'app/views/organizationDashboard';

describe('OrganizationDashboard', function() {
  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  describe('empty state', function() {
    beforeEach(function() {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/?statsPeriod=24h',
        body: [],
      });
    });

    it('renders', function() {
      const teams = [TestStubs.Team()];
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
      const emptyState = wrapper.find('EmptyState');
      expect(emptyState).toHaveLength(1);
    });
  });

  describe('with projects', function() {
    beforeEach(function() {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/?statsPeriod=24h&query=id:2',
        body: [
          TestStubs.Project({
            teams: [TestStubs.Team()],
            stats: [[1517281200, 2], [1517310000, 1]],
          }),
        ],
      });
    });

    it('renders project cards', function() {
      const teams = [TestStubs.Team()];
      const projects = [TestStubs.Project({teams})];

      const wrapper = shallow(
        <Dashboard
          teams={teams}
          projects={projects}
          organization={TestStubs.Organization()}
          params={{orgId: 'org-slug'}}
        />,
        TestStubs.routerContext()
      );
      const emptyState = wrapper.find('EmptyState');
      const favorites = wrapper.find('[data-test-id="favorites"]');
      const projectCard = wrapper.find('ProjectCardWrapper');
      expect(emptyState).toHaveLength(0);
      expect(favorites).toHaveLength(0);
      expect(projectCard).toHaveLength(1);
    });

    it('renders favorited project in favorites section ', function() {
      const teams = [TestStubs.Team()];
      const projects = [TestStubs.Project({teams, isBookmarked: true})];

      const wrapper = shallow(
        <Dashboard
          teams={teams}
          projects={projects}
          organization={TestStubs.Organization()}
          params={{orgId: 'org-slug'}}
        />,
        TestStubs.routerContext()
      );
      const favorites = wrapper.find('[data-test-id="favorites"]');
      const projectCard = favorites.find('ProjectCardWrapper');
      expect(projectCard).toHaveLength(1);
    });

    it('renders bookmarked projects first in team list', function() {
      const teams = [TestStubs.Team()];
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
        url:
          '/organizations/org-slug/projects/?statsPeriod=24h&query=id:3 id:2 id:4 id:5 id:1 id:6',
        body: projects,
      });

      const wrapper = shallow(
        <Dashboard
          teams={teams}
          projects={projects}
          organization={TestStubs.Organization()}
          params={{orgId: 'org-slug'}}
        />,
        TestStubs.routerContext()
      );

      const projectCards = wrapper.find(
        'TeamSection[data-test-id="team"] ProjectCardWrapper'
      );
      expect(projectCards.at(1).prop('data-test-id')).toBe('m-fave');
      expect(projectCards.at(2).prop('data-test-id')).toBe('z-fave');
      expect(projectCards.at(3).prop('data-test-id')).toBe('a');
      expect(projectCards.at(4).prop('data-test-id')).toBe('m');
      expect(projectCards.at(5).prop('data-test-id')).toBe('z');
    });
  });
});
