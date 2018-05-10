import React from 'react';
import {shallow} from 'enzyme';

import EmptyState from 'app/views/organizationDashboard/emptyState';

describe('EmptyState', function() {
  const org = TestStubs.Organization();
  it('shows "Create Project" button when there are no projects', function() {
    let wrapper = shallow(
      <EmptyState organization={org} projects={[]} />,
      TestStubs.routerContext()
    );
    expect(
      wrapper.find('Button[to="/organizations/org-slug/projects/new/"]')
    ).toHaveLength(1);
  });

  it('"Create Project" is disabled when no access to `project:write`', function() {
    let wrapper = shallow(
      <EmptyState organization={TestStubs.Organization({access: []})} projects={[]} />,
      TestStubs.routerContext()
    );
    expect(
      wrapper.find('Button[to="/organizations/org-slug/projects/new/"]').prop('disabled')
    ).toBe(true);
  });

  it('has "Join a Team" button', function() {
    let wrapper = shallow(
      <EmptyState organization={org} projects={[]} />,
      TestStubs.routerContext()
    );
    expect(wrapper.find('Button[to="/settings/org-slug/teams/"]')).toHaveLength(1);
  });

  it('has a disabled "Join a Team" button if no access to `team:read`', function() {
    let wrapper = shallow(
      <EmptyState organization={TestStubs.Organization({access: []})} projects={[]} />,
      TestStubs.routerContext()
    );
    expect(wrapper.find('Button[to="/settings/org-slug/teams/"]').prop('disabled')).toBe(
      true
    );
  });
});
