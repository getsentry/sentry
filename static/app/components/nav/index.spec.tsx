import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {trackAnalytics} from 'sentry/utils/analytics';

jest.mock('sentry/utils/analytics', () => ({
  trackAnalytics: jest.fn(),
}));

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import Nav from 'sentry/components/nav';

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
  'performance-view',
  'performance-trace-explorer',
  'starfish-mobile-ui-module',
  'profiling',
];

describe('Nav', function () {
  describe('default', function () {
    function renderNav() {
      render(<Nav />, {
        router: RouterFixture({
          location: LocationFixture({pathname: '/organizations/org-slug/issues/'}),
        }),
        organization: OrganizationFixture({features: ALL_AVAILABLE_FEATURES}),
      });
    }

    it('renders primary navigation', async function () {
      renderNav();
      expect(
        await screen.findByRole('navigation', {name: 'Primary Navigation'})
      ).toBeInTheDocument();
    });
    it('renders secondary navigation', async function () {
      renderNav();
      expect(
        await screen.findByRole('navigation', {name: 'Secondary Navigation'})
      ).toBeInTheDocument();
    });

    it('renders expected primary nav items', function () {
      renderNav();
      const links = within(
        screen.getByRole('navigation', {name: 'Primary Navigation'})
      ).getAllByRole('link');
      expect(links).toHaveLength(8);

      [
        'Issues',
        'Projects',
        'Explore',
        'Insights',
        'Perf.',
        'Boards',
        'Alerts',
        'Settings',
      ].forEach((title, index) => {
        expect(links[index]).toHaveAccessibleName(title);
      });
    });
  });

  describe('issues', function () {
    function renderNav() {
      render(<Nav />, {
        router: RouterFixture({
          location: LocationFixture({
            pathname: '/organizations/org-slug/issues/',
            search: '?query=is:unresolved',
          }),
        }),
        organization: OrganizationFixture({features: ALL_AVAILABLE_FEATURES}),
      });
    }

    it('renders secondary navigation', async function () {
      renderNav();
      expect(
        await screen.findByRole('navigation', {name: 'Secondary Navigation'})
      ).toBeInTheDocument();
    });

    it('includes expected submenu items', function () {
      renderNav();
      const container = screen.getByRole('navigation', {name: 'Secondary Navigation'});
      const links = within(container).getAllByRole('link');
      expect(links).toHaveLength(6);

      ['All', 'Error & Outage', 'Trend', 'Craftsmanship', 'Security', 'Feedback'].forEach(
        (title, index) => {
          expect(links[index]).toHaveAccessibleName(title);
        }
      );
    });
  });

  describe('insights', function () {
    function renderNav() {
      render(<Nav />, {
        router: RouterFixture({
          location: LocationFixture({
            pathname: '/organizations/org-slug/insights/backend/',
          }),
        }),
        organization: OrganizationFixture({features: ALL_AVAILABLE_FEATURES}),
      });
    }

    it('renders secondary navigation', async function () {
      renderNav();
      expect(
        await screen.findByRole('navigation', {name: 'Secondary Navigation'})
      ).toBeInTheDocument();
    });

    it('includes expected submenu items', function () {
      renderNav();
      const container = screen.getByRole('navigation', {name: 'Secondary Navigation'});
      const links = within(container).getAllByRole('link');
      expect(links).toHaveLength(4);
      ['Frontend', 'Backend', 'Mobile', 'AI'].forEach((title, index) => {
        expect(links[index]).toHaveAccessibleName(title);
      });
    });
  });

  describe('explore', function () {
    function renderNav() {
      render(<Nav />, {
        router: RouterFixture({
          location: LocationFixture({pathname: '/organizations/org-slug/traces/'}),
        }),
        organization: OrganizationFixture({features: ALL_AVAILABLE_FEATURES}),
      });
    }

    it('renders secondary navigation', async function () {
      renderNav();
      expect(
        await screen.findByRole('navigation', {name: 'Secondary Navigation'})
      ).toBeInTheDocument();
    });

    it('includes expected submenu items', function () {
      renderNav();
      const container = screen.getByRole('navigation', {name: 'Secondary Navigation'});
      const links = within(container).getAllByRole('link');
      expect(links).toHaveLength(7);
      [
        'Traces',
        'Metrics',
        'Profiles',
        'Replays',
        'Discover',
        'Releases',
        'Crons',
      ].forEach((title, index) => {
        expect(links[index]).toHaveAccessibleName(title);
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
});
