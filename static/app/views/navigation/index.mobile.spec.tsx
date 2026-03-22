import {GroupSearchViewFixture} from 'sentry-fixture/groupSearchView';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  screen,
  userEvent,
  within,
  type RouterConfig,
} from 'sentry-test/reactTestingLibrary';
import {mockMatchMedia} from 'sentry-test/utils';

import {ConfigStore} from 'sentry/stores/configStore';
import {Navigation} from 'sentry/views/navigation';
import {PrimaryNavigationContextProvider} from 'sentry/views/navigation/primaryNavigationContext';

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
  'profiling',
  'visibility-explore-view',
  'workflow-engine-ui',
];

function navigationContext({
  organization,
  initialRouterConfig,
}: {
  initialRouterConfig?: RouterConfig;
  organization?: Parameters<typeof OrganizationFixture>[0];
} = {}) {
  return {
    organization: OrganizationFixture({
      features: ALL_AVAILABLE_FEATURES,
      ...organization,
    }),
    initialRouterConfig: {
      location: {pathname: '/organizations/org-slug/issues/'},
      ...initialRouterConfig,
    },
  };
}

function setupMocks() {
  localStorage.clear();
  MockApiClient.clearMockResponses();

  // MobileNavigation requires a #main element to manage inert/overflow attributes
  const mainEl = document.createElement('div');
  mainEl.id = 'main';
  document.body.appendChild(mainEl);

  ConfigStore.set('user', UserFixture());
  ConfigStore.set('customerDomain', null);

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

  // Simulate a mobile viewport — matchMedia returns true for the mobile breakpoint query
  mockMatchMedia(true);
}

describe('mobile navigation', () => {
  beforeEach(setupMocks);

  afterEach(() => {
    document.getElementById('main')?.remove();
  });

  describe('accessibility', () => {
    it('does not render a skip link', () => {
      render(
        <PrimaryNavigationContextProvider>
          <Navigation />
        </PrimaryNavigationContextProvider>,
        navigationContext()
      );
      expect(
        screen.queryByRole('link', {name: 'Skip to main content'})
      ).not.toBeInTheDocument();
    });

    it('primary navigation marks exactly one link as active for the current route', async () => {
      render(
        <PrimaryNavigationContextProvider>
          <Navigation />
        </PrimaryNavigationContextProvider>,
        navigationContext()
      );

      // Mobile nav opens to secondary by default; navigate back to see primary
      await userEvent.click(screen.getByRole('button', {name: 'Open main menu'}));
      await userEvent.click(
        screen.getByRole('button', {name: 'Back to primary navigation'})
      );

      const primaryNav = screen.getByRole('navigation', {name: 'Primary Navigation'});
      const links = within(primaryNav).getAllByRole('link');
      const activeLinks = links.filter(
        l => l.getAttribute('aria-current') === 'location'
      );
      const inactiveLinks = links.filter(
        l => l.getAttribute('aria-current') !== 'location'
      );

      expect(activeLinks).toHaveLength(1);
      activeLinks.forEach(link => {
        expect(link).toHaveAttribute('aria-current', 'location');
        expect(link).not.toHaveAttribute('aria-selected');
      });
      inactiveLinks.forEach(link => {
        expect(link).not.toHaveAttribute('aria-current');
        expect(link).not.toHaveAttribute('aria-selected');
      });
    });

    it('secondary navigation marks exactly one link as active for the current route', async () => {
      render(
        <PrimaryNavigationContextProvider>
          <Navigation />
        </PrimaryNavigationContextProvider>,
        navigationContext()
      );

      await userEvent.click(screen.getByRole('button', {name: 'Open main menu'}));

      const secondaryNav = screen.getByRole('navigation', {name: 'Secondary Navigation'});
      await within(secondaryNav).findByRole('link', {name: /Starred View 1/});

      const links = within(secondaryNav).getAllByRole('link');
      const activeLinks = links.filter(l => l.getAttribute('aria-current') === 'page');
      const inactiveLinks = links.filter(l => l.getAttribute('aria-current') !== 'page');

      expect(activeLinks).toHaveLength(1);
      activeLinks.forEach(link => {
        expect(link).toHaveAttribute('aria-current', 'page');
        expect(link).not.toHaveAttribute('aria-selected');
      });
      inactiveLinks.forEach(link => {
        expect(link).not.toHaveAttribute('aria-current');
        expect(link).not.toHaveAttribute('aria-selected');
      });
    });
  });

  describe('secondary nav route inference', () => {
    it('opens secondary navigation by default when on a sub-view', async () => {
      render(
        <PrimaryNavigationContextProvider>
          <Navigation />
        </PrimaryNavigationContextProvider>,
        navigationContext()
      );

      await userEvent.click(screen.getByRole('button', {name: 'Open main menu'}));

      expect(
        screen.getByRole('navigation', {name: 'Secondary Navigation'})
      ).toBeInTheDocument();
    });

    it('clicking back navigates to primary navigation', async () => {
      render(
        <PrimaryNavigationContextProvider>
          <Navigation />
        </PrimaryNavigationContextProvider>,
        navigationContext()
      );

      await userEvent.click(screen.getByRole('button', {name: 'Open main menu'}));

      expect(
        screen.getByRole('navigation', {name: 'Secondary Navigation'})
      ).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', {name: 'Back to primary navigation'})
      );

      expect(
        screen.getByRole('navigation', {name: 'Primary Navigation'})
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('navigation', {name: 'Secondary Navigation'})
      ).not.toBeInTheDocument();
    });
  });
});
