import {shallow} from 'sentry-test/enzyme';
import React from 'react';

import NoProjectMessage from 'app/components/noProjectMessage';

describe('NoProjectMessage', function() {
  const org = TestStubs.Organization();
  it('shows "Create Project" button when there are no projects', function() {
    const wrapper = shallow(
      <NoProjectMessage organization={org} />,
      TestStubs.routerContext()
    );
    expect(
      wrapper.find('Button[to="/organizations/org-slug/projects/new/"]')
    ).toHaveLength(1);
  });

  it('"Create Project" is disabled when no access to `project:write`', function() {
    const wrapper = shallow(
      <NoProjectMessage organization={TestStubs.Organization({access: []})} />,
      TestStubs.routerContext()
    );
    expect(
      wrapper.find('Button[to="/organizations/org-slug/projects/new/"]').prop('disabled')
    ).toBe(true);
  });

  it('has "Join a Team" button', function() {
    const wrapper = shallow(
      <NoProjectMessage organization={org} />,
      TestStubs.routerContext()
    );
    expect(wrapper.find('Button[to="/settings/org-slug/teams/"]')).toHaveLength(1);
  });

  it('has a disabled "Join a Team" button if no access to `team:read`', function() {
    const wrapper = shallow(
      <NoProjectMessage organization={TestStubs.Organization({access: []})} />,
      TestStubs.routerContext()
    );
    expect(wrapper.find('Button[to="/settings/org-slug/teams/"]').prop('disabled')).toBe(
      true
    );
  });

  it('handles projects from props', function() {
    const lightWeightOrg = TestStubs.Organization();
    delete lightWeightOrg.projects;

    const wrapper = shallow(
      <NoProjectMessage projects={[]} organization={lightWeightOrg} />,
      TestStubs.routerContext()
    );
    expect(
      wrapper.find('Button[to="/organizations/org-slug/projects/new/"]')
    ).toHaveLength(1);
  });
});
