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
import PreferenceStore from 'sentry/stores/preferencesStore';
import type {Organization} from 'sentry/types/organization';
import type {StatuspageIncident} from 'sentry/types/system';
import {isDemoModeActive} from 'sentry/utils/demoMode';
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
  'profiling',
  'visibility-explore-view',
];

jest.mock('sentry/utils/demoMode');

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
      organization: {...organization, features: [...organization.features, ...features]},
    });
  };

  beforeEach(function () {
    ConfigStore.set('user', user);
    mockUseLocation.mockReturnValue(LocationFixture());
    jest
      .spyOn(incidentsHook, 'useServiceIncidents')
      .mockImplementation(
        () => ({data: [ServiceIncidentFixture()]}) as UseQueryResult<StatuspageIncident[]>
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
      body: {onboardingTasks: []},
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

  it('has can logout', async function () {
    renderSidebar({organization: OrganizationFixture({access: ['member:read']})});

    await userEvent.click(await screen.findByTestId('sidebar-dropdown'));
    await userEvent.click(screen.getByTestId('sidebar-signout'));

    await waitFor(() => expect(logout).toHaveBeenCalled());
  });

  it('can toggle help menu', async function () {
    renderSidebar({organization});
    await userEvent.click(await screen.findByText('Help'));

    expect(screen.getByText('Visit Help Center')).toBeInTheDocument();
  });

  it('does not render help center in demo mode', async () => {
    (isDemoModeActive as jest.Mock).mockReturnValue(true);

    renderSidebar({organization});
    await userEvent.click(await screen.findByText('Help'));

    expect(screen.queryByText('Visit Help Center')).not.toBeInTheDocument();

    (isDemoModeActive as jest.Mock).mockReset();
  });

  describe('SidebarDropdown', function () {
    it('can open Sidebar org/name dropdown menu', async function () {
      renderSidebar({organization});

      await userEvent.click(await screen.findByTestId('sidebar-dropdown'));

      const orgSettingsLink = screen.getByText('Organization settings');
      expect(orgSettingsLink).toBeInTheDocument();
    });
    it('has link to Members settings with `member:write`', async function () {
      renderSidebar({organization: OrganizationFixture({access: ['member:read']})});

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
      renderSidebar({organization: {...organization, features: ['onboarding']}});

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
          expect.objectContaining({data: {hasSeen: '1'}, query: {id: ['8']}})
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
      expect(links).toHaveLength(23);

      [
        'Issues',
        'Projects',
        /Explore/,
        /Traces/,
        'Profiles',
        'Replays',
        'Discover',
        /Insights/,
        'Frontend',
        'Backend',
        'Mobile',
        'AI',
        'Crons',
        'User Feedback',
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

  describe('New navigation UI prompts', () => {
    beforeEach(() => {
      PreferenceStore.showSidebar();
    });

    it('should render the sidebar banner with no dismissed prompts and the feature flag enabled', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/prompts-activity/`,
        body: {data: null},
      });

      renderSidebarWithFeatures([
        'navigation-sidebar-v2',
        'navigation-sidebar-v2-banner',
      ]);

      expect(await screen.findByText(/New Navigation/)).toBeInTheDocument();
    });

    it('will not render sidebar banner when collapsed', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/prompts-activity/`,
        body: {data: null},
      });

      renderSidebarWithFeatures([
        'navigation-sidebar-v2',
        'navigation-sidebar-v2-banner',
      ]);

      await userEvent.click(screen.getByTestId('sidebar-collapse'));

      await waitFor(() => {
        expect(screen.queryByText(/Try New Navigation/)).not.toBeInTheDocument();
      });
    });

    it('should show dot on help menu after dismissing sidebar banner', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/prompts-activity/`,
        body: {data: null},
      });

      const dismissMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/prompts-activity/`,
        method: 'PUT',
        body: {},
      });

      renderSidebarWithFeatures([
        'navigation-sidebar-v2',
        'navigation-sidebar-v2-banner',
      ]);

      await userEvent.click(await screen.findByRole('button', {name: /Dismiss/}));

      expect(await screen.findByTestId('help-menu-dot')).toBeInTheDocument();
      expect(screen.queryByText(/Try New Navigation/)).not.toBeInTheDocument();
      expect(dismissMock).toHaveBeenCalled();

      // Opening the help dropdown will remove the dot
      await userEvent.click(screen.getByRole('link', {name: /Help/}));
      await waitFor(() => {
        expect(screen.queryByTestId('help-menu-dot')).not.toBeInTheDocument();
      });

      expect(dismissMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('Chonk UI prompts', () => {
    it('user does not have chonk-ui feature', () => {
      renderSidebarWithFeatures([]);
      expect(screen.queryByText(/Sentry has a new look/)).not.toBeInTheDocument();
    });

    // Nothing is shown, this is the new default state
    it('user has chonk enabled and has not dismissed banner', () => {
      ConfigStore.set('user', {
        ...user,
        options: {...user.options, prefersChonkUI: true},
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/prompts-activity/`,
        body: {data: null},
      });

      renderSidebarWithFeatures(['chonk-ui']);
      expect(screen.queryByText(/Sentry has a new look/)).not.toBeInTheDocument();
    });

    // Nothing is shown, this is the new default state
    it('user has chonk enabled and has dismissed banner', () => {
      ConfigStore.set('user', {
        ...user,
        options: {...user.options, prefersChonkUI: true},
      });

      const promptMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/prompts-activity/`,
        body: {data: {feature: 'chonk_ui_banner', dismissed_ts: Date.now()}},
      });

      renderSidebarWithFeatures(['chonk-ui']);
      expect(screen.queryByText(/Sentry has a new look/)).not.toBeInTheDocument();

      expect(promptMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/prompts-activity/`,
        expect.objectContaining({
          method: 'GET',
          query: expect.objectContaining({feature: 'chonk_ui_banner'}),
        })
      );

      expect(promptMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/prompts-activity/`,
        expect.objectContaining({
          method: 'GET',
          query: expect.objectContaining({feature: 'chonk_ui_dot_indicator'}),
        })
      );
    });

    // Enabling chonk-ui disables both the banner and dot indicator
    it('user enables chonk-ui', async () => {
      ConfigStore.set('user', {
        ...user,
        options: {...user.options, prefersChonkUI: false},
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/prompts-activity/`,
        body: {data: null},
      });

      const dismiss = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/prompts-activity/`,
        method: 'PUT',
      });

      const optionsRequest = MockApiClient.addMockResponse({
        url: '/users/me/',
        method: 'PUT',
      });

      renderSidebarWithFeatures(['chonk-ui']);
      expect(await screen.findByText(/Sentry has a new look/)).toBeInTheDocument();
      await userEvent.click(screen.getByText('Try It Out'));

      expect(optionsRequest).toHaveBeenCalledWith(
        '/users/me/',
        expect.objectContaining({
          method: 'PUT',
          data: expect.objectContaining({
            options: expect.objectContaining({prefersChonkUI: true}),
          }),
        })
      );

      expect(dismiss).toHaveBeenNthCalledWith(
        1,
        '/organizations/org-slug/prompts-activity/',
        expect.objectContaining({
          method: 'PUT',
          data: expect.objectContaining({
            feature: 'chonk_ui_banner',
            status: 'dismissed',
          }),
        })
      );

      expect(dismiss).toHaveBeenNthCalledWith(
        2,
        '/organizations/org-slug/prompts-activity/',
        expect.objectContaining({
          method: 'PUT',
          data: expect.objectContaining({
            feature: 'chonk_ui_dot_indicator',
            status: 'dismissed',
          }),
        })
      );

      expect(screen.queryByText(/Sentry has a new look/)).not.toBeInTheDocument();
    });

    // Dismissing the banner enables the dot indicator
    it('user dismisses chonk-ui banner', async () => {
      ConfigStore.set('user', {
        ...user,
        options: {...user.options, prefersChonkUI: false},
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/prompts-activity/`,
        body: {data: null},
      });

      const dismiss = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/prompts-activity/`,
        method: 'PUT',
      });

      const optionsRequest = MockApiClient.addMockResponse({
        url: '/users/me/',
        method: 'PUT',
      });

      renderSidebarWithFeatures(['chonk-ui']);

      // The dot is not visible initially - banner takes precedence
      expect(screen.queryByTestId('help-menu-dot')).not.toBeInTheDocument();
      expect(await screen.findByText(/Sentry has a new look/)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', {name: /Dismiss/}));

      expect(optionsRequest).not.toHaveBeenCalled();
      expect(dismiss).toHaveBeenCalledWith(
        '/organizations/org-slug/prompts-activity/',
        expect.objectContaining({
          method: 'PUT',
          data: expect.objectContaining({
            feature: 'chonk_ui_banner',
            status: 'dismissed',
          }),
        })
      );
      expect(dismiss).toHaveBeenCalledTimes(1);

      expect(screen.queryByText(/Sentry has a new look/)).not.toBeInTheDocument();
      // The dot becomes visible after the banner is dismissed
      expect(screen.getByTestId('help-menu-dot')).toBeInTheDocument();

      // Clicking the help button will remove the dot
      await userEvent.click(screen.getByRole('link', {name: /Help/}));
      await waitFor(() => {
        expect(screen.queryByTestId('help-menu-dot')).not.toBeInTheDocument();
      });

      expect(dismiss).toHaveBeenCalledTimes(2);
      expect(dismiss).toHaveBeenNthCalledWith(
        2,
        '/organizations/org-slug/prompts-activity/',
        expect.objectContaining({
          method: 'PUT',
          data: expect.objectContaining({
            feature: 'chonk_ui_dot_indicator',
            status: 'dismissed',
          }),
        })
      );
    });
  });
});
