import {GroupSearchViewFixture} from 'sentry-fixture/groupSearchView';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import {mockMatchMedia} from 'sentry-test/utils';

import {FrontendVersionProvider} from 'sentry/components/frontendVersionContext';
import ConfigStore from 'sentry/stores/configStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import Nav from 'sentry/views/nav';
import {NAV_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY} from 'sentry/views/nav/constants';
import {NavContextProvider} from 'sentry/views/nav/context';

jest.mock('sentry/utils/analytics', () => ({
  ...jest.requireActual('sentry/utils/analytics'),
  trackAnalytics: jest.fn(),
}));

const ALL_AVAILABLE_FEATURES = [
  'insight-modules',
  'discover',
  'discover-basic',
  'discover-query',
  'dashboards-basic',
  'dashboards-edit',
  'session-replay-ui',
  'ourlogs-enabled',
  'performance-view',
  'performance-trace-explorer',
  'profiling',
  'visibility-explore-view',
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

describe('Nav', () => {
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

  describe('primary navigation', () => {
    it('displays primary navigation items', () => {
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

    it('displays the current primary route as active', () => {
      renderNav();

      const link = screen.getByRole('link', {name: 'Issues'});
      expect(link).toHaveAttribute('href', '/organizations/org-slug/issues/');
      expect(link).toHaveAttribute('aria-current', 'page');
      expect(link).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('secondary navigation', () => {
    it('includes expected secondary nav items', () => {
      renderNav();
      const container = screen.getByRole('navigation', {name: 'Secondary Navigation'});
      const link = within(container).getByRole('link', {name: 'Feed'});
      expect(link).toHaveAttribute('href', '/organizations/org-slug/issues/');
    });

    it('displays the current secondary route as active', () => {
      renderNav({initialPathname: '/organizations/org-slug/issues/'});

      const link = screen.getByRole('link', {name: 'Feed'});
      expect(link).toHaveAttribute('aria-current', 'page');
      expect(link).toHaveAttribute('aria-selected', 'true');
    });

    it('can collapse sections with titles', async () => {
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
      await waitFor(() => {
        expect(
          within(container).queryByRole('link', {name: /Starred View 1/})
        ).not.toBeInTheDocument();
      });

      // Can expand to show again
      await userEvent.click(
        within(container).getByRole('button', {name: 'Starred Views'})
      );
      expect(
        await within(container).findByRole('link', {name: /Starred View 1/})
      ).toBeInTheDocument();
    });

    it('previews secondary nav when hovering over other primary items', async () => {
      renderNav();

      await userEvent.hover(screen.getByRole('link', {name: 'Explore'}));
      await screen.findByRole('link', {name: 'Traces'});

      await userEvent.hover(screen.getByRole('link', {name: 'Dashboards'}));
      await screen.findByRole('link', {name: 'All Dashboards'});
    });

    describe('sections', () => {
      it('renders organization/account settings secondary nav when on settings routes', () => {
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
      it('renders project settings secondary nav when on setting project routes', () => {
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

    describe('collapse behavior', () => {
      it('can collapse and expand secondary sidebar', async () => {
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

      it('remembers collapsed state', async () => {
        localStorage.setItem(NAV_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY, 'true');

        renderNav();

        expect(
          await screen.findByTestId('collapsed-secondary-sidebar')
        ).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Expand'})).toBeInTheDocument();
      });

      it('expands on hover', async () => {
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

  describe('analytics', () => {
    it('tracks primary sidebar item', async () => {
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

  describe('frontend version handling', () => {
    it('does not reload page on navigation when frontend is current', () => {
      render(
        <FrontendVersionProvider releaseVersion="frontend@abc123" force="current">
          <NavContextProvider>
            <Nav />
            <div id="main" />
          </NavContextProvider>
        </FrontendVersionProvider>,
        {
          organization: OrganizationFixture({features: ALL_AVAILABLE_FEATURES}),
          initialRouterConfig: {
            location: {
              pathname: '/organizations/org-slug/issues/',
              query: {query: 'is:unresolved'},
            },
          },
        }
      );

      const exploreLink = screen.getByRole('link', {name: 'Explore'});

      const event = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
      });
      act(() => exploreLink.dispatchEvent(event));

      // React Router prevented default - normal navigation
      expect(event.defaultPrevented).toBe(true);
    });

    it('reloads page on primary navigation when frontend is stale', async () => {
      render(
        <FrontendVersionProvider releaseVersion="frontend@abc123" force="stale">
          <NavContextProvider>
            <Nav />
            <div id="main" />
          </NavContextProvider>
        </FrontendVersionProvider>,
        {
          organization: OrganizationFixture({features: ALL_AVAILABLE_FEATURES}),
          initialRouterConfig: {
            location: {
              pathname: '/organizations/org-slug/issues/',
              query: {query: 'is:unresolved'},
            },
          },
        }
      );

      const exploreLink = screen.getByRole('link', {name: 'Explore'});

      // XXX(epurkhiser): Clicking the anchor is going to trigger a jsdom
      // error: Error: Not implemented: navigation (except hash changes). I'm
      // having a really hard time figuring out how to stop it from doing this
      // unfortunately.
      //
      // This test is mostly a copy from
      // https://github.com/remix-run/react-router/blob/20d8307d4a51c219f6e13e0b66461e7162d944e4/packages/react-router/__tests__/dom/link-click-test.tsx#L246-L278
      jest.spyOn(console, 'error').mockImplementation(jest.fn());

      const event = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
      });
      act(() => exploreLink.dispatchEvent(event));
      await tick();

      // React Router did not prevent default - page will reload
      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('mobile navigation', () => {
    beforeEach(() => {
      mockMatchMedia(true);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('renders mobile navigation on small screen sizes', async () => {
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

  describe('tour', () => {
    it('shows the tour modal when the user has not completed the tour', async () => {
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

    it('does not show the tour modal for new users who are forced into the new stacked navigation', async () => {
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
      renderNav();
      await screen.findByRole('navigation', {name: 'Primary Navigation'});
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
