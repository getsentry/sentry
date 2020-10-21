import {mountWithTheme} from 'sentry-test/enzyme';

import NoProjectMessage from 'app/components/noProjectMessage';

describe('NoProjectMessage', function () {
  const org = TestStubs.Organization();
  it('shows "Create Project" button when there are no projects', function () {
    const wrapper = mountWithTheme(
      <NoProjectMessage organization={org} />,
      TestStubs.routerContext()
    );
    expect(
      wrapper.find('Button[to="/organizations/org-slug/projects/new/"]')
    ).toHaveLength(1);
  });

  it('"Create Project" is disabled when no access to `project:write`', function () {
    const wrapper = mountWithTheme(
      <NoProjectMessage organization={TestStubs.Organization({access: []})} />,
      TestStubs.routerContext()
    );
    expect(
      wrapper.find('Button[to="/organizations/org-slug/projects/new/"]').prop('disabled')
    ).toBe(true);
  });

  it('has no "Join a Team" button when projects are missing', function () {
    const wrapper = mountWithTheme(
      <NoProjectMessage organization={org} />,
      TestStubs.routerContext()
    );
    expect(wrapper.find('Button[to="/settings/org-slug/teams/"]')).toHaveLength(0);
  });

  it('has a "Join a Team" button when no projects but org has projects', function () {
    const wrapper = mountWithTheme(
      <NoProjectMessage
        organization={{...org, projects: [TestStubs.Project({hasAccess: false})]}}
      />,
      TestStubs.routerContext()
    );
    expect(wrapper.find('Button[to="/settings/org-slug/teams/"]')).toHaveLength(1);
  });

  it('has a disabled "Join a Team" button if no access to `team:read`', function () {
    const wrapper = mountWithTheme(
      <NoProjectMessage
        organization={{
          ...org,
          projects: [TestStubs.Project({hasAccess: false})],
          access: [],
        }}
      />,
      TestStubs.routerContext()
    );
    expect(wrapper.find('Button[to="/settings/org-slug/teams/"]').prop('disabled')).toBe(
      true
    );
  });

  it('handles projects from props', function () {
    const lightWeightOrg = TestStubs.Organization();
    delete lightWeightOrg.projects;

    const wrapper = mountWithTheme(
      <NoProjectMessage projects={[]} organization={lightWeightOrg} />,
      TestStubs.routerContext()
    );
    expect(
      wrapper.find('Button[to="/organizations/org-slug/projects/new/"]')
    ).toHaveLength(1);
  });

  it('handles loading projects from props', function () {
    const lightWeightOrg = TestStubs.Organization();
    delete lightWeightOrg.projects;

    const child = <div>child</div>;

    const wrapper = mountWithTheme(
      <NoProjectMessage projects={[]} loadingProjects organization={lightWeightOrg}>
        {child}
      </NoProjectMessage>,
      TestStubs.routerContext()
    );
    // ensure loading projects causes children to render
    expect(wrapper.find('div')).toHaveLength(1);
  });
});
