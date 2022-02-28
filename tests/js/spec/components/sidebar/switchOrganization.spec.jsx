import {mountWithTheme} from 'sentry-test/enzyme';

import {SwitchOrganization} from 'sentry/components/sidebar/sidebarDropdown/switchOrganization';

describe('SwitchOrganization', function () {
  it('can list organizations', function () {
    jest.useFakeTimers();
    const wrapper = mountWithTheme(
      <SwitchOrganization
        organizations={[TestStubs.Organization(), TestStubs.Organization({slug: 'org2'})]}
      />
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
        organizations={[TestStubs.Organization(), TestStubs.Organization({slug: 'org2'})]}
        canCreateOrganization
      />
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
        organizations={[TestStubs.Organization(), TestStubs.Organization({slug: 'org2'})]}
        canCreateOrganization={false}
      />
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
