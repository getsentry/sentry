import React from 'react';
import {mount} from 'enzyme';

import {Dashboard} from 'app/views/organizationDashboard';

describe('OrganizationDashboard', function() {
  it('renders empty state', function() {
    const teams = [TestStubs.Team()];
    const projects = [];

    const wrapper = mount(
      <Dashboard teams={teams} projects={projects} params={{orgId: 'org-slug'}} />,
      TestStubs.routerContext()
    );
    const emptyState = wrapper.find('EmptyState');
    expect(emptyState).toHaveLength(1);
  });
});
