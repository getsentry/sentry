import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  fireEvent,
  mountWithTheme,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import * as incidentActions from 'app/actionCreators/serviceIncidents';
import SidebarContainer from 'app/components/sidebar';
import ConfigStore from 'app/stores/configStore';

jest.mock('app/actionCreators/serviceIncidents');

describe('Sidebar', function () {
  const {organization, router} = initializeOrg();
  const broadcast = TestStubs.Broadcast();
  const user = TestStubs.User();
  const apiMocks = {};

  const location = {...router.location, ...{pathname: '/test/'}};

  const getElement = props => (
    <SidebarContainer organization={organization} location={location} {...props} />
  );

  const renderSidebar = props => mountWithTheme(getElement(props));

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
  });

  it('renders', function () {
    renderSidebar();
    expect(screen.getByTestId('sidebar-dropdown')).toBeInTheDocument();
  });

  it('renders without org', function () {
    const {container} = renderSidebar({organization: null});

    // no org displays user details
    expect(screen.getByText(user.name)).toBeInTheDocument();
    expect(screen.getByText(user.email)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('sidebar-dropdown'));
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

    fireEvent.click(screen.getByTestId('sidebar-dropdown'));
    fireEvent.click(screen.getByTestId('sidebar-signout'));

    await waitFor(() => expect(mock).toHaveBeenCalled());

    expect(window.location.assign).toHaveBeenCalledWith('/auth/login/');
    window.location.assign.mockRestore();
  });

  it('can toggle collapsed state', async function () {
    renderSidebar();

    expect(screen.getByText(user.name)).toBeInTheDocument();
    expect(screen.getByText(organization.name)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('sidebar-collapse'));

    // Check that the organization name is no longer visible
    await waitFor(() =>
      expect(screen.queryByText(organization.name)).not.toBeInTheDocument()
    );

    // Un-collapse he sidebar and make sure the org name is visible again
    fireEvent.click(screen.getByTestId('sidebar-collapse'));
    expect(await screen.findByText(organization.name)).toBeInTheDocument();
  });

  it('can toggle help menu', function () {
    const {container} = renderSidebar();

    fireEvent.click(screen.getByText('Help'));

    expect(screen.getByText('Visit Help Center')).toBeInTheDocument();
    expect(container).toSnapshot();
  });

  describe('SidebarDropdown', function () {
    it('can open Sidebar org/name dropdown menu', function () {
      const {container} = renderSidebar();

      fireEvent.click(screen.getByTestId('sidebar-dropdown'));

      const orgSettingsLink = screen.getByText('Organization settings');
      expect(orgSettingsLink).toBeInTheDocument();
      expect(container).toSnapshot();
    });

    it('has link to Members settings with `member:write`', function () {
      renderSidebar({
        organization: TestStubs.Organization({access: ['member:read']}),
      });

      fireEvent.click(screen.getByTestId('sidebar-dropdown'));

      expect(screen.getByText('Members')).toBeInTheDocument();
    });

    it('can open "Switch Organization" sub-menu', function () {
      act(() => void ConfigStore.set('features', new Set(['organizations:create'])));

      const {container} = renderSidebar();

      fireEvent.click(screen.getByTestId('sidebar-dropdown'));

      jest.useFakeTimers();
      fireEvent.mouseEnter(screen.getByText('Switch organization'));
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

      fireEvent.click(screen.getByText("What's new"));
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText("What's new in Sentry")).toBeInTheDocument();

      rerender(getElement({location: {...router.location, pathname: 'new-path-name'}}));

      await waitForElementToBeRemoved(() => screen.queryByText("What's new in Sentry"));
    });

    it('can have onboarding feature', async function () {
      renderSidebar({
        organization: {...organization, features: ['onboarding']},
      });

      const quickStart = screen.getByText('Quick Start');

      expect(quickStart).toBeInTheDocument();
      fireEvent.click(quickStart);

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Capture your first error')).toBeInTheDocument();
    });

    it('displays empty panel when there are no Broadcasts', async function () {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/broadcasts/`,
        body: [],
      });
      renderSidebar();

      fireEvent.click(screen.getByText("What's new"));

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText("What's new in Sentry")).toBeInTheDocument();
      expect(
        screen.getByText('No recent updates from the Sentry team.')
      ).toBeInTheDocument();

      // Close the sidebar
      fireEvent.click(screen.getByText("What's new"));
      await waitForElementToBeRemoved(() => screen.queryByText("What's new in Sentry"));
    });

    it('can display Broadcasts panel and mark as seen', async function () {
      jest.useFakeTimers();
      const {container} = renderSidebar();

      expect(apiMocks.broadcasts).toHaveBeenCalled();

      fireEvent.click(screen.getByText("What's new"));

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
      fireEvent.click(screen.getByText("What's new"));
      await waitForElementToBeRemoved(() => screen.queryByText("What's new in Sentry"));
    });

    it('can unmount Sidebar (and Broadcasts) and kills Broadcast timers', async function () {
      jest.useFakeTimers();
      const {unmount} = renderSidebar();

      // This will start timer to mark as seen
      fireEvent.click(screen.getByRole('link', {name: "What's new"}));
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

      fireEvent.click(await screen.findByText('Service status'));

      expect(container).toSnapshot();
    });
  });
});
