import {mountWithTheme} from 'sentry-test/enzyme';

import {SwitchOrganization} from 'app/components/sidebar/sidebarDropdown/switchOrganization';

describe('SwitchOrganization', function () {
  const routerContext = TestStubs.routerContext();
  const {organization} = routerContext.context;

  it('can list organizations', function () {
    jest.useFakeTimers();
    const wrapper = mountWithTheme(
      <SwitchOrganization
        organizations={[organization, TestStubs.Organization({slug: 'org2'})]}
      />,
      routerContext
    );

    wrapper.find('SwitchOrganizationMenuActor').simulate('mouseEnter');
    jest.advanceTimersByTime(500);
    wrapper.update();
    expect(wrapper.find('OrganizationList')).toHaveLength(1);
    expect(wrapper.find('OrganizationList SidebarMenuItem')).toHaveLength(2);
    jest.useRealTimers();
  });

  it('shows "Create an Org" if they have permission', function () {
    jest.useFakeTimers();
    const wrapper = mountWithTheme(
      <SwitchOrganization
        organizations={[organization, TestStubs.Organization({slug: 'org2'})]}
        canCreateOrganization
      />,
      routerContext
    );

    wrapper.find('SwitchOrganizationMenuActor').simulate('mouseEnter');
    jest.advanceTimersByTime(500);
    wrapper.update();
    expect(
      wrapper.find('SidebarMenuItem[data-test-id="sidebar-create-org"]')
    ).toHaveLength(1);
    jest.useRealTimers();
  });

  it('does not have "Create an Org" if they do not have permission', function () {
    jest.useFakeTimers();
    const wrapper = mountWithTheme(
      <SwitchOrganization
        organizations={[organization, TestStubs.Organization({slug: 'org2'})]}
        canCreateOrganization={false}
      />,
      routerContext
    );

    wrapper.find('SwitchOrganizationMenuActor').simulate('mouseEnter');
    jest.advanceTimersByTime(500);
    wrapper.update();
    expect(
      wrapper.find('SidebarMenuItem[data-test-id="sidebar-create-org"]')
    ).toHaveLength(0);
    jest.useRealTimers();
  });
});
