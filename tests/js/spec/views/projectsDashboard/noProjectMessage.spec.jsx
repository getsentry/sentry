import {Component} from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {act} from 'sentry-test/reactTestingLibrary';

import NoProjectMessage from 'sentry/components/noProjectMessage';
import ConfigStore from 'sentry/stores/configStore';
import ProjectsStore from 'sentry/stores/projectsStore';

describe('NoProjectMessage', function () {
  beforeEach(function () {
    act(() => ProjectsStore.reset());
  });

  const org = TestStubs.Organization();

  it('renders', async function () {
    const project1 = TestStubs.Project();
    const project2 = TestStubs.Project();
    const organization = TestStubs.Organization({slug: 'org-slug'});
    delete organization.projects;
    act(() => ProjectsStore.loadInitialData([project1, project2]));
    const wrapper = mountWithTheme(
      <NoProjectMessage organization={organization}>{null}</NoProjectMessage>
    );
    expect(wrapper.prop('children')).toBe(null);
    expect(wrapper.find('NoProjectMessage').exists()).toBe(true);
  });

  it('shows "Create Project" button when there are no projects', function () {
    act(() => ProjectsStore.loadInitialData([]));
    const wrapper = mountWithTheme(<NoProjectMessage organization={org} />);
    expect(
      wrapper.find('Button[to="/organizations/org-slug/projects/new/"]')
    ).toHaveLength(1);
  });

  it('"Create Project" is disabled when no access to `project:write`', function () {
    act(() => ProjectsStore.loadInitialData([]));
    const wrapper = mountWithTheme(
      <NoProjectMessage organization={TestStubs.Organization({access: []})} />
    );
    expect(
      wrapper.find('Button[to="/organizations/org-slug/projects/new/"]').prop('disabled')
    ).toBe(true);
  });

  it('has no "Join a Team" button when projects are missing', function () {
    const wrapper = mountWithTheme(<NoProjectMessage organization={org} />);
    expect(wrapper.find('Button[to="/settings/org-slug/teams/"]')).toHaveLength(0);
  });

  it('has a "Join a Team" button when no projects but org has projects', function () {
    act(() => ProjectsStore.loadInitialData([TestStubs.Project({hasAccess: false})]));
    const wrapper = mountWithTheme(<NoProjectMessage organization={org} />);
    expect(wrapper.find('Button[to="/settings/org-slug/teams/"]')).toHaveLength(1);
  });

  it('has a disabled "Join a Team" button if no access to `team:read`', function () {
    act(() => ProjectsStore.loadInitialData([TestStubs.Project({hasAccess: false})]));
    const wrapper = mountWithTheme(
      <NoProjectMessage organization={{...org, access: []}} />
    );
    expect(wrapper.find('Button[to="/settings/org-slug/teams/"]').prop('disabled')).toBe(
      true
    );
  });

  it('shows empty message to superusers that are not members', function () {
    act(() =>
      ProjectsStore.loadInitialData([
        TestStubs.Project({hasAccess: true, isMember: false}),
      ])
    );
    ConfigStore.config.user = {isSuperuser: true};
    const wrapper = mountWithTheme(
      <NoProjectMessage organization={org} superuserNeedsToBeProjectMember>
        {null}
      </NoProjectMessage>
    );
    expect(wrapper.find('HelpMessage')).toHaveLength(1);
  });

  it('does not remount when the projects store loads', async function () {
    const mount = jest.fn();
    const unmount = jest.fn();
    class MockComponent extends Component {
      componentWillMount() {
        mount();
      }
      componentWillUnmount() {
        unmount();
      }
      render() {
        return <div>children</div>;
      }
    }

    const project1 = TestStubs.Project();
    const project2 = TestStubs.Project();
    const organization = TestStubs.Organization({slug: 'org-slug'});
    delete organization.projects;
    const wrapper = mountWithTheme(
      <NoProjectMessage organization={organization}>
        <MockComponent />
      </NoProjectMessage>
    );

    // verify MockComponent is mounted once
    expect(mount).toHaveBeenCalledTimes(1);
    expect(wrapper.find('NoProjectMessage')).toHaveLength(1);
    act(() => ProjectsStore.loadInitialData([project1, project2]));
    // await for trigger from projects store to resolve
    await tick();
    wrapper.update();

    // verify MockComponent is not unmounted and is still mounted once
    expect(unmount).toHaveBeenCalledTimes(0);
    expect(mount).toHaveBeenCalledTimes(1);
    expect(wrapper.find('NoProjectMessage')).toHaveLength(1);
  });
});
