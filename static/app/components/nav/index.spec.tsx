import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {trackAnalytics} from 'sentry/utils/analytics';

jest.mock('sentry/utils/analytics', () => ({
  trackAnalytics: jest.fn(),
}));

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import Nav from 'sentry/components/nav';
import {NavContextProvider} from 'sentry/components/nav/context';
import {SecondaryNav} from 'sentry/components/nav/secondary';

const ALL_AVAILABLE_FEATURES = [
  'insights-entry-points',
  'discover',
  'discover-basic',
  'discover-query',
  'dashboards-basic',
  'dashboards-edit',
  'custom-metrics',
  'user-feedback-ui',
  'session-replay-ui',
  'ourlogs-enabled',
  'performance-view',
  'performance-trace-explorer',
  'profiling',
];

describe('Nav', function () {
  function renderNav({
    initialPathname = '/organizations/org-slug/issues/',
  }: {
    initialPathname?: string;
  } = {}) {
    render(
      <NavContextProvider>
        <Nav />
        <SecondaryNav>
          <SecondaryNav.Item to="/organizations/org-slug/issues/foo/">
            Foo
          </SecondaryNav.Item>
        </SecondaryNav>
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
      expect(links).toHaveLength(6);

      ['Issues', 'Explore', 'Boards', 'Insights', 'Stats', 'Settings'].forEach(
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
  });
});

describe('analytics', function () {
  function renderNav() {
    render(<Nav />, {
      router: RouterFixture({
        location: LocationFixture({pathname: '/organizations/org-slug/traces/'}),
      }),
      organization: OrganizationFixture({features: ALL_AVAILABLE_FEATURES}),
    });
  }

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
