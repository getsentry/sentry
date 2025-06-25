import {OrganizationFixture} from 'sentry-fixture/organization';

import {trackAnalytics} from 'sentry/utils/analytics';

jest.mock('sentry/utils/analytics', () => ({
  ...jest.requireActual('sentry/utils/analytics'),
  trackAnalytics: jest.fn(),
}));

import {GroupSearchViewFixture} from 'sentry-fixture/groupSearchView';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import Nav from 'sentry/views/nav';
import {NAV_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY} from 'sentry/views/nav/constants';
import {NavContextProvider} from 'sentry/views/nav/context';

const ALL_AVAILABLE_FEATURES = [
  'insights-entry-points',
  'discover',
  'discover-basic',
  'discover-query',
  'dashboards-basic',
  'dashboards-edit',
  'user-feedback-ui',
  'session-replay-ui',
  'ourlogs-enabled',
  'performance-view',
  'performance-trace-explorer',
  'profiling',
  'enforce-stacked-navigation',
];

const mockUsingCustomerDomain = jest.fn();

jest.mock('sentry/constants', () => {
  const sentryConstant = jest.requireActual('sentry/constants');
  return {
    ...sentryConstant,

    get USING_CUSTOMER_DOMAIN() {
      return mockUsingCustomerDomain();
    },
  };
});

describe('Nav', function () {
  beforeEach(() => {
    localStorage.clear();
    MockApiClient.clearMockResponses();
    ConfigStore.set('user', UserFixture());

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/broadcasts/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/assistant/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/group-search-views/starred/`,
      body: [GroupSearchViewFixture({name: 'Starred View 1'})],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues-count/`,
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/explore/saved/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/dashboards/`,
      body: [],
    });

    ConfigStore.set('user', {
      ...ConfigStore.get('user'),
      options: {
        ...ConfigStore.get('user').options,
        prefersStackedNavigation: true,
      },
    });
    mockUsingCustomerDomain.mockReturnValue(true);
  });

  function renderNav({
    initialPathname = '/organizations/org-slug/issues/',
    route,
    features = ALL_AVAILABLE_FEATURES,
  }: {
    features?: string[];
    initialPathname?: string;
    route?: string;
  } = {}) {
    return render(
      <NavContextProvider>
        <Nav />
        <div id="main" />
      </NavContextProvider>,
      {
        organization: OrganizationFixture({features}),

        initialRouterConfig: {
          route,
          location: {
            pathname: initialPathname,
            query: {query: 'is:unresolved'},
          },
        },
      }
    );
  }

  describe('primary navigation', function () {
    it('displays primary navigation items', function () {
      renderNav();

      const links = within(
        screen.getByRole('navigation', {name: 'Primary Navigation'})
      ).getAllByRole('link');
      expect(links).toHaveLength(5);

      ['Issues', 'Explore', 'Dashboards', 'Insights', 'Settings'].forEach(
        (title, index) => {
          expect(links[index]).toHaveAccessibleName(title);
        }
      );
    });

    it('displays the current primary route as active', function () {
      renderNav();

      const link = screen.getByRole('link', {name: 'Issues'});
      expect(link).toHaveAttribute('href', '/organizations/org-slug/issues/');
      expect(link).toHaveAttribute('aria-current', 'page');
      expect(link).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('secondary navigation', function () {
    it('includes expected secondary nav items', function () {
      renderNav();
      const container = screen.getByRole('navigation', {name: 'Secondary Navigation'});
      const link = within(container).getByRole('link', {name: 'Feed'});
      expect(link).toHaveAttribute('href', '/organizations/org-slug/issues/');
    });

    it('displays the current secondary route as active', function () {
      renderNav({initialPathname: '/organizations/org-slug/issues/'});

      const link = screen.getByRole('link', {name: 'Feed'});
      expect(link).toHaveAttribute('aria-current', 'page');
      expect(link).toHaveAttribute('aria-selected', 'true');
    });

    it('can collapse sections with titles', async function () {
      renderNav();
      const container = screen.getByRole('navigation', {name: 'Secondary Navigation'});

      expect(
        await within(container).findByRole('link', {name: /Starred View 1/})
      ).toBeInTheDocument();

      // Click "Starred Views" button to collapse the section
      await userEvent.click(
        within(container).getByRole('button', {name: 'Starred Views'})
      );

      // Section should be collapsed and no longer show starred view
      expect(
        within(container).queryByRole('link', {name: /Starred View 1/})
      ).not.toBeInTheDocument();

      // Can expand to show again
      await userEvent.click(
        within(container).getByRole('button', {name: 'Starred Views'})
      );
      expect(
        within(container).getByRole('link', {name: /Starred View 1/})
      ).toBeInTheDocument();
    });

    it('previews secondary nav when hovering over other primary items', async function () {
      renderNav();

      await userEvent.hover(screen.getByRole('link', {name: 'Explore'}));
      await screen.findByRole('link', {name: 'Traces'});

      await userEvent.hover(screen.getByRole('link', {name: 'Dashboards'}));
      await screen.findByRole('link', {name: 'All Dashboards'});
    });

    describe('sections', function () {
      it('renders organization/account settings secondary nav when on settings routes', function () {
        renderNav({initialPathname: '/settings/organization/'});

        const secondaryNav = screen.getByRole('navigation', {
          name: 'Secondary Navigation',
        });

        expect(
          within(secondaryNav).getByRole('link', {name: 'Account Details'})
        ).toBeInTheDocument();
        expect(
          within(secondaryNav).getByRole('link', {name: 'Security'})
        ).toBeInTheDocument();
        expect(
          within(secondaryNav).getByRole('link', {name: 'General Settings'})
        ).toBeInTheDocument();
        expect(
          within(secondaryNav).getByRole('link', {name: 'Teams'})
        ).toBeInTheDocument();
        expect(
          within(secondaryNav).getByRole('link', {name: 'Members'})
        ).toBeInTheDocument();
      });

      // Settings renders different secondary nav when on project routes
      it('renders project settings secondary nav when on setting project routes', function () {
        renderNav({
          initialPathname: '/settings/projects/project-slug/',
          route: '/settings/projects/:projectId/',
        });

        const secondaryNav = screen.getByRole('navigation', {
          name: 'Secondary Navigation',
        });

        expect(
          within(secondaryNav).getByRole('link', {name: 'General Settings'})
        ).toBeInTheDocument();
        expect(
          within(secondaryNav).getByRole('link', {name: 'Project Teams'})
        ).toBeInTheDocument();
        expect(
          within(secondaryNav).getByRole('link', {name: 'Inbound Filters'})
        ).toBeInTheDocument();
      });
    });

    describe('collapse behavior', function () {
      it('can collapse and expand secondary sidebar', async function () {
        renderNav();

        expect(
          screen.getByRole('navigation', {name: 'Secondary Navigation'})
        ).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Collapse'}));

        expect(screen.getByTestId('collapsed-secondary-sidebar')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Expand'}));

        expect(
          screen.queryByTestId('collapsed-secondary-sidebar')
        ).not.toBeInTheDocument();
      });

      it('remembers collapsed state', async function () {
        localStorage.setItem(NAV_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY, 'true');

        renderNav();

        expect(
          await screen.findByTestId('collapsed-secondary-sidebar')
        ).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Expand'})).toBeInTheDocument();
      });

      it('expands on hover', async function () {
        localStorage.setItem(NAV_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY, 'true');

        renderNav();

        expect(
          await screen.findByTestId('collapsed-secondary-sidebar')
        ).toBeInTheDocument();

        expect(screen.getByTestId('collapsed-secondary-sidebar')).toHaveAttribute(
          'data-visible',
          'false'
        );

        // Moving pointer over the primary navigation should expand the sidebar
        await userEvent.hover(
          screen.getByRole('navigation', {name: 'Primary Navigation'})
        );
        await waitFor(() => {
          expect(screen.getByTestId('collapsed-secondary-sidebar')).toHaveAttribute(
            'data-visible',
            'true'
          );
        });

        // Moving pointer away should hide the sidebar
        await userEvent.unhover(
          screen.getByRole('navigation', {name: 'Primary Navigation'})
        );
        await waitFor(() => {
          expect(screen.getByTestId('collapsed-secondary-sidebar')).toHaveAttribute(
            'data-visible',
            'false'
          );
        });
      });
    });
  });

  describe('analytics', function () {
    it('tracks primary sidebar item', async function () {
      renderNav();
      const issues = screen.getByRole('link', {name: 'Issues'});
      await userEvent.click(issues);
      expect(trackAnalytics).toHaveBeenCalledWith(
        'navigation.primary_item_clicked',
        expect.objectContaining({
          item: 'issues',
        })
      );
    });
  });

  describe('mobile navigation', function () {
    const initialMatchMedia = window.matchMedia;
    beforeEach(() => {
      // Need useMedia() to return true for isMobile query
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));
    });

    afterEach(() => {
      window.matchMedia = initialMatchMedia;
    });

    it('renders mobile navigation on small screen sizes', async function () {
      renderNav();

      // Should have a top-level header element with a home link and menu button
      expect(
        screen.getByRole('button', {name: 'Toggle organization menu'})
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Open main menu'})).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Open main menu'}));

      // Should first render the active secondary navigation
      expect(
        await screen.findByRole('navigation', {name: 'Secondary Navigation'})
      ).toBeInTheDocument();
      expect(screen.getByRole('link', {name: 'Feed'})).toBeInTheDocument();

      // Clicking back should render the primary navigation
      await userEvent.click(
        screen.getByRole('button', {name: 'Back to primary navigation'})
      );
      expect(
        screen.getByRole('navigation', {name: 'Primary Navigation'})
      ).toBeInTheDocument();
      expect(screen.getByRole('link', {name: 'Issues'})).toBeInTheDocument();
      expect(screen.getByRole('link', {name: 'Explore'})).toBeInTheDocument();
      expect(screen.getByRole('link', {name: 'Dashboards'})).toBeInTheDocument();
      expect(screen.getByRole('link', {name: 'Insights'})).toBeInTheDocument();
      expect(screen.getByRole('link', {name: 'Settings'})).toBeInTheDocument();

      // Tapping one of the primary navigation items should close the menu
      await userEvent.click(screen.getByRole('link', {name: 'Explore'}));
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    });
  });

  describe('tour', function () {
    it('shows the tour modal when the user has not completed the tour', async function () {
      MockApiClient.addMockResponse({
        url: `/assistant/`,
        body: [{guide: 'tour.stacked_navigation', seen: false}],
      });
      MockApiClient.addMockResponse({
        url: `/assistant/`,
        method: 'PUT',
        body: {},
      });

      renderGlobalModal();
      const {router} = renderNav();

      // Shows the tour modal
      const modal = await screen.findByRole('dialog');
      expect(within(modal).getByText('Welcome to a simpler Sentry')).toBeInTheDocument();
      await userEvent.click(within(modal).getByRole('button', {name: 'Take a tour'}));

      // Starts tour with the issues step
      await screen.findByText('See what broke');
      await userEvent.click(screen.getByRole('button', {name: 'Next'}));

      // Navigates to the explore page on step 2
      await screen.findByText('Dig into data');
      await waitFor(() => {
        expect(router.location.pathname).toBe('/organizations/org-slug/explore/traces/');
      });

      // Dissmissing tour should navigate back to the initial page
      await userEvent.click(screen.getByRole('button', {name: 'Close'}));
      await waitFor(() => {
        expect(router.location.pathname).toBe('/organizations/org-slug/issues/');
      });

      // Shows the reminder on help menu
      await screen.findByText('Come back anytime');
    });

    it('does not show the tour modal for new users who are forced into the new stacked navigation', async function () {
      ConfigStore.set('user', {
        ...ConfigStore.get('user'),
        dateJoined: '2025-06-20',
      });

      MockApiClient.addMockResponse({
        url: `/assistant/`,
        body: [{guide: 'tour.stacked_navigation', seen: false}],
      });
      MockApiClient.addMockResponse({
        url: `/assistant/`,
        method: 'PUT',
        body: {},
      });

      renderGlobalModal();
      renderNav({
        features: ALL_AVAILABLE_FEATURES.concat('enforce-stacked-navigation'),
      });
      await screen.findByRole('navigation', {name: 'Primary Navigation'});
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('chonk-ui', function () {
    describe('switching themes', function () {
      beforeEach(() => {
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/prompts-activity/',
          body: {data: {dismissed_ts: null}},
        });

        ConfigStore.set('user', {
          ...ConfigStore.get('user'),
          options: {
            ...ConfigStore.get('user').options,
            prefersChonkUI: false,
          },
        });
      });

      describe('when feature flag is enabled', function () {
        it('shows the chonk-ui toggle in the help menu', async function () {
          const dismissRequest = MockApiClient.addMockResponse({
            url: '/organizations/org-slug/prompts-activity/',
            method: 'PUT',
          });

          renderNav({features: ALL_AVAILABLE_FEATURES.concat('chonk-ui')});
          const helpMenu = screen.getByRole('button', {name: 'Help'});
          await userEvent.click(helpMenu);

          expect(screen.getByText('Try our new look')).toBeInTheDocument();

          // Once for banner, once for dot indicator
          expect(dismissRequest).toHaveBeenCalledTimes(2);
        });

        it('shows the chonk-ui toggle to old theme', async function () {
          ConfigStore.set('user', {
            ...ConfigStore.get('user'),
            options: {
              ...ConfigStore.get('user').options,
              prefersChonkUI: true,
            },
          });

          renderNav({features: ALL_AVAILABLE_FEATURES.concat('chonk-ui')});
          const helpMenu = screen.getByRole('button', {name: 'Help'});
          await userEvent.click(helpMenu);

          expect(screen.getByText('Switch back to our old look')).toBeInTheDocument();
        });
      });

      describe('when feature flag is disabled', function () {
        it('does not show the chonk-ui toggle in the help menu', async function () {
          MockApiClient.addMockResponse({
            url: '/organizations/org-slug/prompts-activity/',
            body: {data: {dismissed_ts: null}},
          });

          renderNav({features: ALL_AVAILABLE_FEATURES});
          const helpMenu = screen.getByRole('button', {name: 'Help'});
          await userEvent.click(helpMenu);

          expect(screen.queryByText('Try our new look')).not.toBeInTheDocument();
        });
      });
    });

    describe('opt-in banner', function () {
      it('shows the opt-in banner if user has feature and has not opted in yet', async function () {
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/prompts-activity/',
          body: {data: {dismissed_ts: null}},
        });

        renderNav({features: ALL_AVAILABLE_FEATURES.concat('chonk-ui')});
        expect(await screen.findByText(/Sentry has a new look/)).toBeInTheDocument();
      });

      it('dismissing the banner', async function () {
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/prompts-activity/',
          body: {data: {dismissed_ts: null}},
        });

        const dismissRequest = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/prompts-activity/',
          method: 'PUT',
          status: 200,
        });

        renderNav({features: ALL_AVAILABLE_FEATURES.concat('chonk-ui')});
        expect(await screen.findByText(/Sentry has a new look/)).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Dismiss'}));

        expect(dismissRequest).toHaveBeenCalled();

        await waitFor(() => {
          expect(dismissRequest).toHaveBeenCalledWith(
            '/organizations/org-slug/prompts-activity/',
            expect.objectContaining({
              method: 'PUT',
              data: expect.objectContaining({
                feature: 'chonk_ui_banner',
                status: 'dismissed',
              }),
            })
          );
        });

        expect(screen.queryByText(/Sentry has a new look/)).not.toBeInTheDocument();
      });

      it('enabling new theme dismisses banner and dot indicator', async function () {
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/prompts-activity/',
          body: {data: {dismissed_ts: null}},
        });

        const optInRequest = MockApiClient.addMockResponse({
          url: '/users/me/',
          method: 'PUT',
        });

        const dismissRequest = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/prompts-activity/',
          method: 'PUT',
        });

        renderNav({features: ALL_AVAILABLE_FEATURES.concat('chonk-ui')});
        expect(await screen.findByText(/Sentry has a new look/)).toBeInTheDocument();

        // Enables user option and disables all prompts
        await userEvent.click(screen.getByText('Try It Out'));

        expect(optInRequest).toHaveBeenCalledWith(
          '/users/me/',
          expect.objectContaining({
            method: 'PUT',
            data: expect.objectContaining({
              options: expect.objectContaining({
                prefersChonkUI: true,
              }),
            }),
          })
        );

        expect(dismissRequest).toHaveBeenNthCalledWith(
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

        expect(dismissRequest).toHaveBeenNthCalledWith(
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

        // The banner is no longer visible
        expect(screen.queryByText(/Sentry has a new look/)).not.toBeInTheDocument();
      });
    });
  });
});
