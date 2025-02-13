import {OrganizationFixture} from 'sentry-fixture/organization';

import {trackAnalytics} from 'sentry/utils/analytics';

jest.mock('sentry/utils/analytics', () => ({
  trackAnalytics: jest.fn(),
}));

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import Nav from 'sentry/components/nav';
import {NAV_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY} from 'sentry/components/nav/constants';
import {NavContextProvider} from 'sentry/components/nav/context';
import {SecondaryNav} from 'sentry/components/nav/secondary';
import {PrimaryNavGroup} from 'sentry/components/nav/types';

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
];

describe('Nav', function () {
  beforeEach(() => {
    localStorage.clear();

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/broadcasts/`,
      body: [],
    });
  });

  function renderNav({
    initialPathname = '/organizations/org-slug/issues/',
  }: {
    initialPathname?: string;
  } = {}) {
    render(
      <NavContextProvider>
        <Nav />
        <SecondaryNav group={PrimaryNavGroup.ISSUES}>
          <SecondaryNav.Item to="/organizations/org-slug/issues/foo/">
            Foo
          </SecondaryNav.Item>
        </SecondaryNav>
        <div id="main" />
      </NavContextProvider>,
      {
        organization: OrganizationFixture({features: ALL_AVAILABLE_FEATURES}),
        disableRouterMocks: true,
        initialRouterConfig: {
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
    it('renders secondary navigation', async function () {
      renderNav();
      expect(
        await screen.findByRole('navigation', {name: 'Secondary Navigation'})
      ).toBeInTheDocument();
    });

    it('includes expected secondary nav items', function () {
      renderNav();
      const container = screen.getByRole('navigation', {name: 'Secondary Navigation'});
      const link = within(container).getByRole('link', {name: 'Foo'});
      expect(link).toHaveAttribute('href', '/organizations/org-slug/issues/foo/');
    });

    it('displays the current secondary route as active', function () {
      renderNav({initialPathname: '/organizations/org-slug/issues/foo/'});

      const link = screen.getByRole('link', {name: 'Foo'});
      expect(link).toHaveAttribute('aria-current', 'page');
      expect(link).toHaveAttribute('aria-selected', 'true');
    });

    describe('collapse behavior', function () {
      it('can collpase and expand secondary sidebar', async function () {
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
        expect(screen.getByTestId('collapsed-secondary-sidebar')).toHaveAttribute(
          'data-visible',
          'true'
        );

        // Moving pointer away should hide the sidebar
        await userEvent.unhover(
          screen.getByRole('navigation', {name: 'Primary Navigation'})
        );
        expect(screen.getByTestId('collapsed-secondary-sidebar')).toHaveAttribute(
          'data-visible',
          'false'
        );
      });
    });
  });

  describe('analytics', function () {
    it('tracks primary sidebar item', async function () {
      renderNav();
      const issues = screen.getByRole('link', {name: 'Issues'});
      await userEvent.click(issues);
      expect(trackAnalytics).toHaveBeenCalledWith(
        'growth.clicked_sidebar',
        expect.objectContaining({
          item: 'issues',
        })
      );
    });
  });

  describe('mobile navigation', function () {
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

    it('renders mobile navigation on small screen sizes', async function () {
      renderNav();

      // Should have a top-level header element with a home link and menu button
      expect(screen.getByRole('link', {name: 'Sentry Home'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Open main menu'})).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Open main menu'}));

      // Should first render the active secondary navigation
      expect(
        await screen.findByRole('navigation', {name: 'Secondary Navigation'})
      ).toBeInTheDocument();
      expect(screen.getByRole('link', {name: 'Foo'})).toBeInTheDocument();

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
});
