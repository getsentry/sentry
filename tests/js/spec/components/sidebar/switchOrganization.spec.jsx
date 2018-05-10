import React from 'react';

import {mount} from 'enzyme';
import {SwitchOrganization} from 'app/components/sidebar/sidebarDropdown/switchOrganization';

describe('SwitchOrganization', function() {
  let routerContext = TestStubs.routerContext();
  let {organization} = routerContext.context;

  it('can list organizations', async function() {
    jest.useFakeTimers();
    let wrapper = mount(
      <SwitchOrganization
        organizations={[organization, TestStubs.Organization({slug: 'org2'})]}
      />,
      routerContext
    );

    wrapper.find('span[data-test-id="sidebar-switch-org"]').simulate('mouseEnter');
    jest.advanceTimersByTime(500);
    wrapper.update();
    expect(wrapper.find('OrganizationList')).toHaveLength(1);
    expect(wrapper.find('OrganizationList SidebarMenuItem')).toHaveLength(2);
    jest.useRealTimers();
  });
});
