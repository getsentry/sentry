import React from 'react';

import {mount, shallow} from 'enzyme';
import IncidentStore from 'app/stores/incidentStore';
import SidebarContainer, {Sidebar} from 'app/components/sidebar';

describe('Sidebar', function() {
  let wrapper;
  let routerContext = TestStubs.routerContext();
  let {organization, router} = routerContext.context;
  let user = TestStubs.User();
  let apiMocks = {};

  let createWrapper = props =>
    mount(
      <Sidebar
        organization={organization}
        user={user}
        router={router}
        location={router.location}
        {...props}
      />,
      routerContext
    );

  beforeEach(function() {
    apiMocks.broadcasts = MockApiClient.addMockResponse({
      url: '/broadcasts/',
      body: [TestStubs.Broadcast()],
    });
    apiMocks.broadcastsMarkAsSeen = MockApiClient.addMockResponse({
      url: '/broadcasts/',
      method: 'PUT',
    });
  });

  it('renders', function() {
    wrapper = shallow(
      <Sidebar organization={organization} user={user} router={router} />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('StyledSidebar')).toHaveLength(1);
  });

  it('renders without org and router', function() {
    wrapper = createWrapper({
      organization: null,
      router: null,
    });

    wrapper.find('SidebarDropdownActor').simulate('click');
    expect(wrapper.find('OrgAndUserMenu')).toMatchSnapshot();
  });

  it('can toggle collapsed state', async function() {
    wrapper = mount(
      <SidebarContainer organization={organization} user={user} router={router} />,
      routerContext
    );

    wrapper.find('SidebarCollapseItem').simulate('click');
    await tick();
    wrapper.update();

    // Because of HoCs, we can't access the collapsed prop
    // Instead check for `SidebarItemLabel` which doesn't exist in collapsed state
    expect(wrapper.find('SidebarItemLabel')).toHaveLength(0);

    wrapper.find('SidebarCollapseItem').simulate('click');
    await tick();
    wrapper.update();
    expect(wrapper.find('SidebarItemLabel').length).toBeGreaterThan(0);
  });

  it('can have onboarding feature', function() {
    wrapper = mount(
      <SidebarContainer
        organization={{...organization, features: ['onboarding']}}
        user={user}
        router={router}
      />,
      routerContext
    );

    expect(wrapper.find('[data-test-id="onboarding-progress-bar"]')).toHaveLength(1);

    wrapper.find('[data-test-id="onboarding-progress-bar"]').simulate('click');
    wrapper.update();
    expect(wrapper.find('OnboardingStatus SidebarPanel')).toMatchSnapshot();
  });

  describe('SidebarDropdown', function() {
    it('can open Sidebar org/name dropdown menu', function() {
      wrapper = createWrapper();
      wrapper.find('SidebarDropdownActor').simulate('click');
      expect(wrapper.find('OrgAndUserMenu')).toHaveLength(1);
      expect(wrapper.find('OrgAndUserMenu')).toMatchSnapshot();
    });

    it('has link to Members settings with `member:write`', function() {
      let org = TestStubs.Organization();
      org = {
        ...org,
        access: [...org.access, 'member:read'],
      };

      wrapper = createWrapper({
        organization: org,
      });
      wrapper.find('SidebarDropdownActor').simulate('click');
      expect(wrapper.find('OrgAndUserMenu')).toHaveLength(1);
      expect(
        wrapper.find('SidebarMenuItem[to="/settings/org-slug/members/"]')
      ).toHaveLength(1);
    });

    it('can open "Switch Organization" sub-menu', function() {
      jest.useFakeTimers();
      wrapper = createWrapper();
      wrapper.find('SidebarDropdownActor').simulate('click');
      wrapper.find('SwitchOrganizationMenuActor').simulate('mouseEnter');
      jest.advanceTimersByTime(500);
      wrapper.update();
      expect(wrapper.find('SwitchOrganizationMenu')).toHaveLength(1);
      expect(wrapper.find('SwitchOrganizationMenu')).toMatchSnapshot();
      jest.useRealTimers();
    });
  });

  describe('SidebarPanel', function() {
    it('displays empty panel when there are no Broadcasts', function() {
      MockApiClient.addMockResponse({
        url: '/broadcasts/',
        body: [],
      });
      wrapper = createWrapper();

      wrapper.find('Broadcasts SidebarItem').simulate('click');
      wrapper.update();
      expect(wrapper.find('SidebarPanel')).toHaveLength(1);

      expect(wrapper.find('SidebarPanelItem')).toHaveLength(0);
      expect(wrapper.find('SidebarPanelEmpty')).toHaveLength(1);
    });

    it('can display Broadcasts panel and mark as seen', function() {
      jest.useFakeTimers();
      wrapper = createWrapper();
      expect(apiMocks.broadcasts).toHaveBeenCalled();

      wrapper.find('Broadcasts SidebarItem').simulate('click');
      wrapper.update();
      expect(wrapper.find('SidebarPanel')).toHaveLength(1);

      expect(wrapper.find('SidebarPanelItem')).toHaveLength(1);
      expect(wrapper.find('SidebarPanelItem').prop('hasSeen')).toBe(false);

      expect(wrapper.find('SidebarPanelItem')).toMatchSnapshot();

      // Should mark as seen after a delay
      jest.advanceTimersByTime(2000);
      expect(apiMocks.broadcastsMarkAsSeen).toHaveBeenCalledWith(
        '/broadcasts/',
        expect.objectContaining({
          data: {
            hasSeen: '1',
          },
          query: {
            id: ['8'],
          },
        })
      );
      jest.useRealTimers();
    });

    it('can toggle display of Broadcasts SidebarPanel', function() {
      wrapper = createWrapper();

      // Show Broadcasts Panel
      wrapper.find('Broadcasts SidebarItem').simulate('click');
      wrapper.update();
      expect(wrapper.find('SidebarPanel')).toHaveLength(1);

      // Hide Broadcasts Panel
      wrapper.find('Broadcasts SidebarItem').simulate('click');
      wrapper.update();
      expect(wrapper.find('SidebarPanel')).toHaveLength(0);
    });

    it('can unmount Sidebar (and Broadcasts) and kills Broadcast timers', function() {
      jest.useFakeTimers();
      wrapper = createWrapper();
      let broadcasts = wrapper.find('Broadcasts').instance();

      // This will start timer to mark as seen
      wrapper.find('Broadcasts SidebarItem').simulate('click');
      wrapper.update();

      jest.advanceTimersByTime(500);
      expect(broadcasts.poller).toBeDefined();
      expect(broadcasts.timer).toBeDefined();

      // Unmounting will cancel timers
      wrapper.unmount();
      expect(broadcasts.poller).toBe(null);
      expect(broadcasts.timer).toBe(null);

      // This advances timers enough so that mark as seen should be called if it wasn't unmounted
      jest.advanceTimersByTime(600);
      expect(apiMocks.broadcastsMarkAsSeen).not.toHaveBeenCalled();
    });

    it('can show Incidents in Sidebar Panel', async function() {
      wrapper = createWrapper();
      IncidentStore.onUpdateSuccess({
        status: {incidents: [TestStubs.Incident()]},
      });
      wrapper.update();

      wrapper.find('Incidents').simulate('click');
      wrapper.update();
      expect(wrapper.find('SidebarPanel')).toHaveLength(1);

      expect(wrapper.find('IncidentList')).toMatchSnapshot();
    });

    it('hides when path changes', async function() {
      wrapper = createWrapper();
      wrapper.update();

      wrapper.find('Broadcasts SidebarItem').simulate('click');
      wrapper.update();
      expect(wrapper.find('SidebarPanel')).toHaveLength(1);

      wrapper.setProps({
        location: {
          pathname: 'new-path-name',
        },
      });
      wrapper.update();
      expect(wrapper.find('SidebarPanel')).toHaveLength(0);
    });
  });
});
