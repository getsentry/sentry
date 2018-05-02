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
      const projectCard = wrapper.find('ProjectCardWrapper');
      expect(emptyState).toHaveLength(0);
      expect(projectCard).toHaveLength(1);
    });
  });
});
