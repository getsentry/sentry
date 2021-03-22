import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import * as incidentActions from 'app/actionCreators/serviceIncidents';
import SidebarContainer from 'app/components/sidebar';
import ConfigStore from 'app/stores/configStore';

jest.mock('app/actionCreators/serviceIncidents');

describe('Sidebar', function () {
  let wrapper;
  const routerContext = TestStubs.routerContext();
  const {organization, router} = routerContext.context;
  const user = TestStubs.User();
  const apiMocks = {};

  const createWrapper = props =>
    mountWithTheme(
      <SidebarContainer
        organization={organization}
        user={user}
        router={router}
        location={{...router.location, ...{pathname: '/test/'}}}
        {...props}
      />,
      routerContext
    );

  beforeEach(function () {
    apiMocks.broadcasts = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/broadcasts/`,
      body: [TestStubs.Broadcast()],
    });
    apiMocks.broadcastsMarkAsSeen = MockApiClient.addMockResponse({
      url: '/broadcasts/',
      method: 'PUT',
    });
    apiMocks.sdkUpdates = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdk-updates/`,
      body: [],
    });
  });

  it('renders', function () {
    wrapper = mountWithTheme(
      <SidebarContainer organization={organization} user={user} router={router} />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('StyledSidebar')).toHaveLength(1);
  });

  it('renders without org and router', function () {
    wrapper = createWrapper({
      organization: null,
      router: null,
    });

    // no org displays user details
    expect(wrapper.find('OrgOrUserName').text()).toContain(user.name);
    expect(wrapper.find('UserNameOrEmail').text()).toContain(user.email);

    wrapper.find('SidebarDropdownActor').simulate('click');
    expect(wrapper).toSnapshot();
  });

  it('can toggle collapsed state', async function () {
    wrapper = mountWithTheme(
      <SidebarContainer organization={organization} user={user} router={router} />,
      routerContext
    );

    expect(wrapper.find('OrgOrUserName').text()).toContain(organization.name);
    expect(wrapper.find('UserNameOrEmail').text()).toContain(user.name);

    wrapper.find('SidebarCollapseItem StyledSidebarItem').simulate('click');
    await tick();
    wrapper.update();

    // Because of HoCs, we can't access the collapsed prop
    // Instead check for `SidebarItemLabel` which doesn't exist in collapsed state
    expect(wrapper.find('SidebarItemLabel')).toHaveLength(0);

    wrapper.find('SidebarCollapseItem StyledSidebarItem').simulate('click');
    await tick();
    wrapper.update();
    expect(wrapper.find('SidebarItemLabel').length).toBeGreaterThan(0);
  });

  it('can have onboarding feature', async function () {
    wrapper = mountWithTheme(
      <SidebarContainer
        organization={{...organization, features: ['onboarding']}}
        user={user}
        router={router}
      />,
      routerContext
    );

    expect(wrapper.find('OnboardingStatus ProgressRing')).toHaveLength(1);

    wrapper.find('OnboardingStatus ProgressRing').simulate('click');
    await tick();
    wrapper.update();

    expect(wrapper.find('OnboardingStatus TaskSidebarPanel').exists()).toBe(true);
  });

  describe('SidebarHelp', function () {
    it('can toggle help menu', function () {
      wrapper = createWrapper();
      wrapper.find('HelpActor').simulate('click');
      const menu = wrapper.find('HelpMenu');
      expect(menu).toHaveLength(1);
      expect(wrapper).toSnapshot();
      expect(menu.find('SidebarMenuItem')).toHaveLength(4);
      wrapper.find('HelpActor').simulate('click');
      expect(wrapper.find('HelpMenu')).toHaveLength(0);
    });
  });

  describe('SidebarDropdown', function () {
    it('can open Sidebar org/name dropdown menu', function () {
      wrapper = createWrapper();
      wrapper.find('SidebarDropdownActor').simulate('click');
      expect(wrapper.find('OrgAndUserMenu')).toHaveLength(1);
      expect(wrapper).toSnapshot();
    });

    it('has link to Members settings with `member:write`', function () {
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

    it('can open "Switch Organization" sub-menu', function () {
      ConfigStore.set('features', new Set(['organizations:create']));
      jest.useFakeTimers();
      wrapper = createWrapper();
      wrapper.find('SidebarDropdownActor').simulate('click');
      wrapper.find('SwitchOrganizationMenuActor').simulate('mouseEnter');
      jest.advanceTimersByTime(500);
      wrapper.update();
      expect(wrapper.find('SwitchOrganizationMenu')).toHaveLength(1);
      expect(wrapper).toSnapshot();
      jest.useRealTimers();
    });

    it('has can logout', async function () {
      const mock = MockApiClient.addMockResponse({
        url: '/auth/',
        method: 'DELETE',
        status: 204,
      });
      jest.spyOn(window.location, 'assign').mockImplementation(() => {});

      let org = TestStubs.Organization();
      org = {
        ...org,
        access: [...org.access, 'member:read'],
      };

      wrapper = createWrapper({
        organization: org,
        user: TestStubs.User(),
      });
      wrapper.find('SidebarDropdownActor').simulate('click');
      wrapper.find('SidebarMenuItem[data-test-id="sidebarSignout"]').simulate('click');
      expect(mock).toHaveBeenCalled();

      await tick();
      expect(window.location.assign).toHaveBeenCalledWith('/auth/login/');
      window.location.assign.mockRestore();
    });
  });

  describe('SidebarPanel', function () {
    it('displays empty panel when there are no Broadcasts', async function () {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/broadcasts/`,
        body: [],
      });
      wrapper = createWrapper();

      wrapper.find('Broadcasts SidebarItem').simulate('click');

      await tick();
      wrapper.update();
      expect(wrapper.find('SidebarPanel')).toHaveLength(1);

      expect(wrapper.find('SidebarPanelItem')).toHaveLength(0);
      expect(wrapper.find('SidebarPanelEmpty')).toHaveLength(1);

      // Close the sidebar
      wrapper.find('Broadcasts SidebarItem').simulate('click');
      await tick();
      wrapper.update();
    });

    it('can display Broadcasts panel and mark as seen', async function () {
      jest.useFakeTimers();
      wrapper = createWrapper();
      expect(apiMocks.broadcasts).toHaveBeenCalled();

      wrapper.find('Broadcasts SidebarItem').simulate('click');

      // XXX: Need to do this for reflux since we're using fake timers
      jest.advanceTimersByTime(0);
      await Promise.resolve();
      wrapper.update();

      expect(wrapper.find('SidebarPanel')).toHaveLength(1);

      expect(wrapper.find('SidebarPanelItem')).toHaveLength(1);
      expect(wrapper.find('SidebarPanelItem').prop('hasSeen')).toBe(false);

      expect(wrapper.find('SidebarPanelItem')).toSnapshot();

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

      // Close the sidebar
      wrapper.find('Broadcasts SidebarItem').simulate('click');
    });

    it('can toggle display of Broadcasts SidebarPanel', async function () {
      wrapper = createWrapper();
      wrapper.update();

      // Show Broadcasts Panel
      wrapper.find('Broadcasts SidebarItem').simulate('click');
      await tick();
      wrapper.update();
      expect(wrapper.find('SidebarPanel')).toHaveLength(1);

      // Hide Broadcasts Panel
      wrapper.find('Broadcasts SidebarItem').simulate('click');
      await tick();
      wrapper.update();
      expect(wrapper.find('SidebarPanel')).toHaveLength(0);

      // Close the sidebar
      wrapper.find('Broadcasts SidebarItem').simulate('click');
    });

    it('can unmount Sidebar (and Broadcasts) and kills Broadcast timers', async function () {
      jest.useFakeTimers();
      wrapper = createWrapper();
      const broadcasts = wrapper.find('Broadcasts').instance();

      // This will start timer to mark as seen
      await wrapper.find('Broadcasts SidebarItem').simulate('click');
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
      jest.useRealTimers();
    });

    it('can show Incidents in Sidebar Panel', async function () {
      incidentActions.loadIncidents = jest.fn(() => ({
        incidents: [TestStubs.ServiceIncident()],
      }));

      wrapper = createWrapper();
      await tick();

      wrapper.find('ServiceIncidents').simulate('click');
      await tick();
      wrapper.update();
      expect(wrapper.find('SidebarPanel')).toHaveLength(1);

      expect(wrapper.find('IncidentList')).toSnapshot();
    });

    it('hides when path changes', async function () {
      wrapper = createWrapper();
      wrapper.update();

      wrapper.find('Broadcasts SidebarItem').simulate('click');
      await tick();
      wrapper.update();
      expect(wrapper.find('SidebarPanel')).toHaveLength(1);

      const prevProps = wrapper.props();

      wrapper.setProps({
        location: {...router.location, pathname: 'new-path-name'},
      });

      // XXX(epurkhsier): Due to a bug in enzyme [0], componentDidUpdate is not
      // called after props have updated, it still receives _old_ `this.props`.
      // We manually call it here after the props have been correctly updated.
      //
      // [0]: https://github.com/enzymejs/enzyme/issues/2197
      wrapper.find('Sidebar').instance().componentDidUpdate(prevProps);

      await tick();
      wrapper.update();
      expect(wrapper.find('SidebarPanel')).toHaveLength(0);
    });
  });
});
