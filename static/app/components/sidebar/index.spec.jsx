import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as incidentActions from 'sentry/actionCreators/serviceIncidents';
import SidebarContainer from 'sentry/components/sidebar';
import ConfigStore from 'sentry/stores/configStore';
import {PersistedStoreProvider} from 'sentry/stores/persistedStore';

jest.mock('sentry/actionCreators/serviceIncidents');

describe('Sidebar', function () {
  const {organization, router} = initializeOrg();
  const broadcast = TestStubs.Broadcast();
  const user = TestStubs.User();
  const apiMocks = {};

  const location = {...router.location, ...{pathname: '/test/'}};

  const getElement = props => (
    <PersistedStoreProvider>
      <SidebarContainer organization={organization} location={location} {...props} />
    </PersistedStoreProvider>
  );

  const renderSidebar = props => render(getElement(props));

  beforeEach(function () {
    apiMocks.broadcasts = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/broadcasts/`,
      body: [broadcast],
    });
    apiMocks.broadcastsMarkAsSeen = MockApiClient.addMockResponse({
      url: '/broadcasts/',
      method: 'PUT',
    });
    apiMocks.sdkUpdates = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdk-updates/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/client-state/`,
      body: {},
    });
  });

  it('renders', async function () {
    const {container} = renderSidebar();
    await waitFor(() => container);
    expect(screen.getByTestId('sidebar-dropdown')).toBeInTheDocument();
  });

  it('renders without org', function () {
    const {container} = renderSidebar({organization: null});

    // no org displays user details
    expect(screen.getByText(user.name)).toBeInTheDocument();
    expect(screen.getByText(user.email)).toBeInTheDocument();

    userEvent.click(screen.getByTestId('sidebar-dropdown'));
    expect(container).toSnapshot();
  });

  it('has can logout', async function () {
    const mock = MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
      status: 204,
    });
    jest.spyOn(window.location, 'assign').mockImplementation(() => {});

    renderSidebar({
      organization: TestStubs.Organization({access: ['member:read']}),
    });

    userEvent.click(screen.getByTestId('sidebar-dropdown'));
    userEvent.click(screen.getByTestId('sidebar-signout'));

    await waitFor(() => expect(mock).toHaveBeenCalled());

    expect(window.location.assign).toHaveBeenCalledWith('/auth/login/');
    window.location.assign.mockRestore();
  });

  it('can toggle help menu', async function () {
    const {container} = renderSidebar();
    await waitFor(() => container);

    userEvent.click(screen.getByText('Help'));

    expect(screen.getByText('Visit Help Center')).toBeInTheDocument();
    expect(container).toSnapshot();
  });

  describe('SidebarDropdown', function () {
    it('can open Sidebar org/name dropdown menu', async function () {
      const {container} = renderSidebar();
      await waitFor(() => container);

      userEvent.click(screen.getByTestId('sidebar-dropdown'));

      const orgSettingsLink = screen.getByText('Organization settings');
      expect(orgSettingsLink).toBeInTheDocument();
      expect(container).toSnapshot();
    });
    it('has link to Members settings with `member:write`', async function () {
      const {container} = renderSidebar({
        organization: TestStubs.Organization({access: ['member:read']}),
      });
      await waitFor(() => container);

      userEvent.click(screen.getByTestId('sidebar-dropdown'));

      expect(screen.getByText('Members')).toBeInTheDocument();
    });

    it('can open "Switch Organization" sub-menu', async function () {
      act(() => void ConfigStore.set('features', new Set(['organizations:create'])));

      const {container} = renderSidebar();
      await waitFor(() => container);

      userEvent.click(screen.getByTestId('sidebar-dropdown'));

      jest.useFakeTimers();
      userEvent.type(screen.getByText('Switch organization'), '{enter}');
      act(() => jest.advanceTimersByTime(500));
      jest.useRealTimers();

      const createOrg = screen.getByText('Create a new organization');
      expect(createOrg).toBeInTheDocument();

      expect(container).toSnapshot();
    });
  });

  describe('SidebarPanel', function () {
    it('hides when path changes', async function () {
      const {rerender} = renderSidebar();

      userEvent.click(screen.getByText("What's new"));
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText("What's new in Sentry")).toBeInTheDocument();

      rerender(getElement({location: {...router.location, pathname: 'new-path-name'}}));
      expect(screen.queryByText("What's new in Sentry")).not.toBeInTheDocument();
      await tick();
    });

    it('can have onboarding feature', async function () {
      renderSidebar({
        organization: {...organization, features: ['onboarding']},
      });

      const quickStart = screen.getByText('Quick Start');

      expect(quickStart).toBeInTheDocument();
      userEvent.click(quickStart);

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Capture your first error')).toBeInTheDocument();

      userEvent.click(quickStart);
      expect(screen.queryByText('Capture your first error')).not.toBeInTheDocument();
      await tick();
    });

    it('displays empty panel when there are no Broadcasts', async function () {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/broadcasts/`,
        body: [],
      });
      renderSidebar();

      userEvent.click(screen.getByText("What's new"));

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText("What's new in Sentry")).toBeInTheDocument();
      expect(
        screen.getByText('No recent updates from the Sentry team.')
      ).toBeInTheDocument();

      // Close the sidebar
      userEvent.click(screen.getByText("What's new"));
      expect(screen.queryByText("What's new in Sentry")).not.toBeInTheDocument();
      await tick();
    });

    it('can display Broadcasts panel and mark as seen', async function () {
      jest.useFakeTimers();
      const {container} = renderSidebar();

      expect(apiMocks.broadcasts).toHaveBeenCalled();

      userEvent.click(screen.getByText("What's new"));

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText("What's new in Sentry")).toBeInTheDocument();

      const broadcastTitle = screen.getByText(broadcast.title);
      expect(broadcastTitle).toBeInTheDocument();
      expect(container).toSnapshot();

      // Should mark as seen after a delay
      act(() => jest.advanceTimersByTime(2000));

      expect(apiMocks.broadcastsMarkAsSeen).toHaveBeenCalledWith(
        '/broadcasts/',
        expect.objectContaining({
          data: {hasSeen: '1'},
          query: {id: ['8']},
        })
      );
      jest.useRealTimers();

      // Close the sidebar
      userEvent.click(screen.getByText("What's new"));
      expect(screen.queryByText("What's new in Sentry")).not.toBeInTheDocument();
      await tick();
    });

    it('can unmount Sidebar (and Broadcasts) and kills Broadcast timers', async function () {
      jest.useFakeTimers();
      const {unmount} = renderSidebar();

      // This will start timer to mark as seen
      userEvent.click(screen.getByRole('link', {name: "What's new"}));
      expect(await screen.findByText("What's new in Sentry")).toBeInTheDocument();

      act(() => jest.advanceTimersByTime(500));

      // Unmounting will cancel timers
      unmount();

      // This advances timers enough so that mark as seen should be called if
      // it wasn't unmounted
      act(() => jest.advanceTimersByTime(600));
      expect(apiMocks.broadcastsMarkAsSeen).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('can show Incidents in Sidebar Panel', async function () {
      incidentActions.loadIncidents = jest.fn(() => ({
        incidents: [TestStubs.ServiceIncident()],
      }));

      const {container} = renderSidebar();

      userEvent.click(await screen.findByText('Service status'));
      await screen.findByText('Recent service updates');

      expect(container).toSnapshot();
    });
  });

  it('can toggle collapsed state', async function () {
    const container = renderSidebar();
    await waitFor(() => container);

    expect(screen.getByText(user.name)).toBeInTheDocument();
    expect(screen.getByText(organization.name)).toBeInTheDocument();

    userEvent.click(screen.getByTestId('sidebar-collapse'));

    // Check that the organization name is no longer visible
    expect(screen.queryByText(organization.name)).not.toBeInTheDocument();

    // Un-collapse he sidebar and make sure the org name is visible again
    userEvent.click(screen.getByTestId('sidebar-collapse'));
    expect(await screen.findByText(organization.name)).toBeInTheDocument();
  });
});
