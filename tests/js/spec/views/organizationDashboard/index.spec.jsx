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
        <Dashboard teams={teams} projects={projects} params={{orgId: 'org-slug'}} />,
        TestStubs.routerContext()
      );
      const emptyState = wrapper.find('EmptyState');
      expect(emptyState).toHaveLength(1);
    });
  });

  describe('with projects', function() {
    beforeEach(function() {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/?statsPeriod=24h',
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
        <Dashboard teams={teams} projects={projects} params={{orgId: 'org-slug'}} />,
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
        <Dashboard teams={teams} projects={projects} params={{orgId: 'org-slug'}} />,
        TestStubs.routerContext()
      );
      const favorites = wrapper.find('[data-test-id="favorites"]');
      const projectCard = favorites.find('ProjectCardWrapper');
      expect(projectCard).toHaveLength(1);
    });

    it('renders bookmarked projects first in team list', function() {
      const teams = [TestStubs.Team()];
      const proj1 = TestStubs.Project({
        id: '1',
        slug: 'proj-1',
        teams,
        isBookmarked: false,
        stats: [],
      });
      const proj2 = TestStubs.Project({
        id: '2',
        slug: 'proj-2',
        teams,
        isBookmarked: true,
        stats: [],
      });
      const projects = [proj1, proj2];

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/?statsPeriod=24h',
        body: [proj1, proj2],
      });

      const wrapper = shallow(
        <Dashboard teams={teams} projects={projects} params={{orgId: 'org-slug'}} />,
        TestStubs.routerContext()
      );
      const projectCards = wrapper.find('ProjectCardWrapper');
      expect(projectCards.first().prop('data-test-id')).toBe('proj-2');
      expect(projectCards.last().prop('data-test-id')).toBe('proj-1');
    });
  });
});
