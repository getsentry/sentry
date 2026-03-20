import {GroupSearchViewFixture} from 'sentry-fixture/groupSearchView';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  screen,
  userEvent,
  type RouterConfig,
} from 'sentry-test/reactTestingLibrary';
import {mockMatchMedia} from 'sentry-test/utils';

import {ConfigStore} from 'sentry/stores/configStore';
import {Navigation} from 'sentry/views/navigation';

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
      render(<Navigation />, navigationContext());
      expect(
        screen.queryByRole('link', {name: 'Skip to main content'})
      ).not.toBeInTheDocument();
    });
  });

  describe('secondary nav route inference', () => {
    it('opens secondary navigation by default when on a sub-view', async () => {
      render(<Navigation />, navigationContext());

      await userEvent.click(screen.getByRole('button', {name: 'Open main menu'}));

      expect(
        screen.getByRole('navigation', {name: 'Secondary Navigation'})
      ).toBeInTheDocument();
    });

    it('clicking back navigates to primary navigation', async () => {
      render(<Navigation />, navigationContext());

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
