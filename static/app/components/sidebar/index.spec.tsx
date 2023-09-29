import {Broadcast} from 'sentry-fixture/broadcast';
import {ServiceIncident} from 'sentry-fixture/serviceIncident';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as incidentActions from 'sentry/actionCreators/serviceIncidents';
import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import SidebarContainer from 'sentry/components/sidebar';
import ConfigStore from 'sentry/stores/configStore';
import {SentryServiceStatus} from 'sentry/types';

jest.mock('sentry/actionCreators/serviceIncidents');

describe('Sidebar', function () {
  const {organization, router, routerContext} = initializeOrg();
  const broadcast = Broadcast();
  const user = TestStubs.User();
  const apiMocks: {
    broadcasts: jest.Mock;
    broadcastsMarkAsSeen: jest.Mock;
    sdkUpdates: jest.Mock;
  } = {
    broadcasts: jest.fn(),
    broadcastsMarkAsSeen: jest.fn(),
    sdkUpdates: jest.fn(),
  };

  const location = {...router.location, ...{pathname: '/test/'}};

  const getElement = props => (
    <OnboardingContextProvider>
      <SidebarContainer organization={organization} location={location} {...props} />
    </OnboardingContextProvider>
  );

  const renderSidebar = (props = {}) =>
    render(getElement(props), {context: routerContext});

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

  it('renders', async function () {
    const {container} = renderSidebar();
    await waitFor(() => container);
    expect(screen.getByTestId('sidebar-dropdown')).toBeInTheDocument();
  });

  it('renders without org', async function () {
    renderSidebar({organization: null});

    // no org displays user details
    expect(screen.getByText(user.name)).toBeInTheDocument();
    expect(screen.getByText(user.email)).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('sidebar-dropdown'));
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

    await userEvent.click(screen.getByTestId('sidebar-dropdown'));
    await userEvent.click(screen.getByTestId('sidebar-signout'));

    await waitFor(() => expect(mock).toHaveBeenCalled());

    expect(window.location.assign).toHaveBeenCalledWith('/auth/login/');
  });

  it('can toggle help menu', async function () {
    const {container} = renderSidebar();
    await waitFor(() => container);

    await userEvent.click(screen.getByText('Help'));

    expect(screen.getByText('Visit Help Center')).toBeInTheDocument();
  });

  describe('SidebarDropdown', function () {
    it('can open Sidebar org/name dropdown menu', async function () {
      const {container} = renderSidebar();
      await waitFor(() => container);

      await userEvent.click(screen.getByTestId('sidebar-dropdown'));

      const orgSettingsLink = screen.getByText('Organization settings');
      expect(orgSettingsLink).toBeInTheDocument();
    });
    it('has link to Members settings with `member:write`', async function () {
      const {container} = renderSidebar({
        organization: TestStubs.Organization({access: ['member:read']}),
      });
      await waitFor(() => container);

      await userEvent.click(screen.getByTestId('sidebar-dropdown'));

      expect(screen.getByText('Members')).toBeInTheDocument();
    });

    it('can open "Switch Organization" sub-menu', async function () {
      act(() => void ConfigStore.set('features', new Set(['organizations:create'])));

      const {container} = renderSidebar();
      await waitFor(() => container);

      await userEvent.click(screen.getByTestId('sidebar-dropdown'));

      jest.useFakeTimers();
      await userEvent.hover(screen.getByText('Switch organization'), {delay: null});
      act(() => jest.advanceTimersByTime(500));
      jest.useRealTimers();

      const createOrg = screen.getByText('Create a new organization');
      expect(createOrg).toBeInTheDocument();
    });
  });

  describe('SidebarPanel', function () {
    it('hides when path changes', async function () {
      const {rerender} = renderSidebar();

      await userEvent.click(screen.getByText("What's new"));
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
      await userEvent.click(quickStart);

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Capture your first error')).toBeInTheDocument();

      await userEvent.click(quickStart);
      expect(screen.queryByText('Capture your first error')).not.toBeInTheDocument();
      await tick();
    });

    it('displays empty panel when there are no Broadcasts', async function () {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/broadcasts/`,
        body: [],
      });
      renderSidebar();

      await userEvent.click(screen.getByText("What's new"));

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText("What's new in Sentry")).toBeInTheDocument();
      expect(
        screen.getByText('No recent updates from the Sentry team.')
      ).toBeInTheDocument();

      // Close the sidebar
      await userEvent.click(screen.getByText("What's new"));
      expect(screen.queryByText("What's new in Sentry")).not.toBeInTheDocument();
      await tick();
    });

    it('can display Broadcasts panel and mark as seen', async function () {
      jest.useFakeTimers();
      renderSidebar();

      expect(apiMocks.broadcasts).toHaveBeenCalled();

      await userEvent.click(screen.getByText("What's new"), {delay: null});

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText("What's new in Sentry")).toBeInTheDocument();

      const broadcastTitle = screen.getByText(broadcast.title);
      expect(broadcastTitle).toBeInTheDocument();

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
      await userEvent.click(screen.getByText("What's new"));
      expect(screen.queryByText("What's new in Sentry")).not.toBeInTheDocument();
      await tick();
    });

    it('can unmount Sidebar (and Broadcasts) and kills Broadcast timers', async function () {
      jest.useFakeTimers();
      const {unmount} = renderSidebar();

      // This will start timer to mark as seen
      await userEvent.click(screen.getByRole('link', {name: "What's new"}), {
        delay: null,
      });
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
      jest
        .spyOn(incidentActions, 'loadIncidents')
        .mockImplementation((): Promise<SentryServiceStatus | null> => {
          return Promise.resolve({
            incidents: [ServiceIncident()],
            indicator: 'none',
            url: '',
          });
        });

      renderSidebar();

      await userEvent.click(await screen.findByText('Service status'));
      await screen.findByText('Recent service updates');
    });
  });

  it('can toggle collapsed state', async function () {
    const container = renderSidebar();
    await waitFor(() => container);

    expect(screen.getByText(user.name)).toBeInTheDocument();
    expect(screen.getByText(organization.name)).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('sidebar-collapse'));

    // Check that the organization name is no longer visible
    expect(screen.queryByText(organization.name)).not.toBeInTheDocument();

    // Un-collapse he sidebar and make sure the org name is visible again
    await userEvent.click(screen.getByTestId('sidebar-collapse'));
    expect(await screen.findByText(organization.name)).toBeInTheDocument();
  });
});
