import type {UseQueryResult} from '@tanstack/react-query';
import {BroadcastFixture} from 'sentry-fixture/broadcast';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ServiceIncidentFixture} from 'sentry-fixture/serviceIncident';
import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {logout} from 'sentry/actionCreators/account';
import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import SidebarContainer from 'sentry/components/sidebar';
import ConfigStore from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import type {StatuspageIncident} from 'sentry/types/system';
import localStorage from 'sentry/utils/localStorage';
import {useLocation} from 'sentry/utils/useLocation';
import * as incidentsHook from 'sentry/utils/useServiceIncidents';

jest.mock('sentry/actionCreators/account');
jest.mock('sentry/utils/useServiceIncidents');
jest.mock('sentry/utils/useLocation');

const mockUseLocation = jest.mocked(useLocation);

const ALL_AVAILABLE_FEATURES = [
  'insights-entry-points',
  'discover',
  'discover-basic',
  'discover-query',
  'dashboards-basic',
  'dashboards-edit',
  'user-feedback-ui',
  'session-replay-ui',
  'performance-view',
  'performance-trace-explorer',
  'starfish-mobile-ui-module',
  'profiling',
];

describe('Sidebar', function () {
  const organization = OrganizationFixture();
  const broadcast = BroadcastFixture();
  const user = UserFixture();
  const apiMocks = {
    broadcasts: jest.fn(),
    broadcastsMarkAsSeen: jest.fn(),
    sdkUpdates: jest.fn(),
  };

  const getElement = () => (
    <OnboardingContextProvider>
      <SidebarContainer />
    </OnboardingContextProvider>
  );

  const renderSidebar = ({organization: org}: {organization: Organization | null}) =>
    render(getElement(), {organization: org});

  const renderSidebarWithFeatures = (features: string[] = []) => {
    return renderSidebar({
      organization: {
        ...organization,
        features: [...organization.features, ...features],
      },
    });
  };

  beforeEach(function () {
    mockUseLocation.mockReturnValue(LocationFixture());
    jest.spyOn(incidentsHook, 'useServiceIncidents').mockImplementation(
      () =>
        ({
          data: [ServiceIncidentFixture()],
        }) as UseQueryResult<StatuspageIncident[]>
    );

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
      url: `/organizations/${organization.slug}/onboarding-tasks/`,
      method: 'GET',
      body: {
        onboardingTasks: [],
      },
    });
  });

  afterEach(function () {
    mockUseLocation.mockReset();
  });

  it('renders', async function () {
    renderSidebar({organization});
    expect(await screen.findByTestId('sidebar-dropdown')).toBeInTheDocument();
  });

  it('renders without org', async function () {
    renderSidebar({organization: null});

    // no org displays user details
    expect(await screen.findByText(user.name)).toBeInTheDocument();
    expect(screen.getByText(user.email)).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('sidebar-dropdown'));
  });

  it('does not render collapse with navigation-sidebar-v2 flag', async function () {
    renderSidebar({
      organization: {...organization, features: ['navigation-sidebar-v2']},
    });

    // await for the page to be rendered
    expect(await screen.findByText('Issues')).toBeInTheDocument();
    // Check that the user name is no longer visible
    expect(screen.queryByText(user.name)).not.toBeInTheDocument();
    // Check that the organization name is no longer visible
    expect(screen.queryByText(organization.name)).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-collapse')).not.toBeInTheDocument();
  });

  it('has can logout', async function () {
    renderSidebar({
      organization: OrganizationFixture({access: ['member:read']}),
    });

    await userEvent.click(await screen.findByTestId('sidebar-dropdown'));
    await userEvent.click(screen.getByTestId('sidebar-signout'));

    await waitFor(() => expect(logout).toHaveBeenCalled());
  });

  it('can toggle help menu', async function () {
    renderSidebar({organization});
    await userEvent.click(await screen.findByText('Help'));

    expect(screen.getByText('Visit Help Center')).toBeInTheDocument();
  });

  describe('SidebarDropdown', function () {
    it('can open Sidebar org/name dropdown menu', async function () {
      renderSidebar({organization});

      await userEvent.click(await screen.findByTestId('sidebar-dropdown'));

      const orgSettingsLink = screen.getByText('Organization settings');
      expect(orgSettingsLink).toBeInTheDocument();
    });
    it('has link to Members settings with `member:write`', async function () {
      renderSidebar({
        organization: OrganizationFixture({access: ['member:read']}),
      });

      await userEvent.click(await screen.findByTestId('sidebar-dropdown'));

      expect(screen.getByText('Members')).toBeInTheDocument();
    });

    it('can open "Switch Organization" sub-menu', async function () {
      act(() => void ConfigStore.set('features', new Set(['organizations:create'])));

      renderSidebar({organization});

      await userEvent.click(await screen.findByTestId('sidebar-dropdown'));

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
      const {rerender} = renderSidebar({organization});

      await userEvent.click(await screen.findByText("What's new"));
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText("What's new in Sentry")).toBeInTheDocument();

      mockUseLocation.mockReturnValue({...LocationFixture(), pathname: '/other/path'});
      rerender(getElement());
      expect(screen.queryByText("What's new in Sentry")).not.toBeInTheDocument();
    });

    it('can have onboarding feature', async function () {
      renderSidebar({
        organization: {...organization, features: ['onboarding']},
      });

      const quickStart = await screen.findByText('Onboarding');

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
      renderSidebar({organization});

      await userEvent.click(await screen.findByText("What's new"));

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
      renderSidebar({organization});

      expect(apiMocks.broadcasts).toHaveBeenCalled();

      await userEvent.click(await screen.findByText("What's new"), {delay: null});

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText("What's new in Sentry")).toBeInTheDocument();

      const broadcastTitle = screen.getByText(broadcast.title);
      expect(broadcastTitle).toBeInTheDocument();

      // Should mark as seen after a delay
      act(() => jest.advanceTimersByTime(2000));

      await waitFor(() => {
        expect(apiMocks.broadcastsMarkAsSeen).toHaveBeenCalledWith(
          '/broadcasts/',
          expect.objectContaining({
            data: {hasSeen: '1'},
            query: {id: ['8']},
          })
        );
      });
      jest.useRealTimers();

      // Close the sidebar
      await userEvent.click(screen.getByText("What's new"));
      expect(screen.queryByText("What's new in Sentry")).not.toBeInTheDocument();
      await tick();
    });

    it('can unmount Sidebar (and Broadcasts) and kills Broadcast timers', async function () {
      jest.useFakeTimers();
      const {unmount} = renderSidebar({organization});

      // This will start timer to mark as seen
      await userEvent.click(await screen.findByTestId('sidebar-broadcasts'), {
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
      renderSidebar({organization});

      await userEvent.click(await screen.findByText(/Service status/));
      await screen.findByText('Recent service updates');
    });
  });

  it('can toggle collapsed state', async function () {
    renderSidebar({organization});

    expect(await screen.findByText(user.name)).toBeInTheDocument();
    expect(screen.getByText(organization.name)).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('sidebar-collapse'));

    // Check that the organization name is no longer visible
    expect(screen.queryByText(organization.name)).not.toBeInTheDocument();

    // Un-collapse he sidebar and make sure the org name is visible again
    await userEvent.click(screen.getByTestId('sidebar-collapse'));
    expect(await screen.findByText(organization.name)).toBeInTheDocument();
  });

  describe('sidebar links', () => {
    beforeEach(function () {
      ConfigStore.init();
      ConfigStore.set('features', new Set([]));
      ConfigStore.set('user', user);

      mockUseLocation.mockReturnValue({...LocationFixture()});
    });

    it('renders navigation', async function () {
      renderSidebar({organization});

      await waitFor(function () {
        expect(apiMocks.broadcasts).toHaveBeenCalled();
      });

      expect(
        screen.getByRole('navigation', {name: 'Primary Navigation'})
      ).toBeInTheDocument();
    });

    it('in self-hosted-errors-only mode, only shows links to basic features', async function () {
      ConfigStore.set('isSelfHostedErrorsOnly', true);

      renderSidebarWithFeatures(ALL_AVAILABLE_FEATURES);

      await waitFor(function () {
        expect(apiMocks.broadcasts).toHaveBeenCalled();
      });

      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(12);

      [
        'Issues',
        'Projects',
        'Alerts',
        'Discover',
        'Dashboards',
        'Releases',
        'Stats',
        'Settings',
        'Help',
        /What's new/,
        /Service status/,
      ].forEach((title, index) => {
        expect(links[index]).toHaveAccessibleName(title);
      });
    });

    it('in regular mode, also shows links to Performance and Crons', async function () {
      localStorage.setItem('sidebar-accordion-insights:expanded', 'true');
      renderSidebarWithFeatures([...ALL_AVAILABLE_FEATURES]);

      await waitFor(function () {
        expect(apiMocks.broadcasts).toHaveBeenCalled();
      });

      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(25);

      [
        'Issues',
        'Projects',
        /Explore/,
        /Traces/,
        /Metrics/,
        'Profiles',
        'Replays',
        'Discover',
        /Insights/,
        'Frontend',
        'Backend',
        'Mobile',
        'AI',
        'Performance',
        'User Feedback',
        'Crons',
        'Alerts',
        'Dashboards',
        'Releases',
        'Stats',
        'Settings',
        'Help',
        /What's new/,
        /Service status/,
      ].forEach((title, index) => {
        expect(links[index]).toHaveAccessibleName(title);
      });
    });

    it('should not render floating accordion when expanded', async () => {
      renderSidebarWithFeatures(ALL_AVAILABLE_FEATURES);
      await userEvent.click(
        screen.getByTestId('sidebar-accordion-insights-domains-item')
      );
      expect(screen.queryByTestId('floating-accordion')).not.toBeInTheDocument();
    });

    it('should render floating accordion when collapsed', async () => {
      renderSidebarWithFeatures(ALL_AVAILABLE_FEATURES);
      await userEvent.click(screen.getByTestId('sidebar-collapse'));
      await userEvent.click(
        screen.getByTestId('sidebar-accordion-insights-domains-item')
      );
      expect(await screen.findByTestId('floating-accordion')).toBeInTheDocument();
    });
  });
});
