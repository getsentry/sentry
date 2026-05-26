import {GroupSearchViewFixture} from 'sentry-fixture/groupSearchView';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {Navigation} from 'sentry/views/navigation';
import {
  NAVIGATION_SECONDARY_SIDEBAR_DATA_ATTRIBUTE,
  NAVIGATION_SIDEBAR_SECONDARY_WIDTH_LOCAL_STORAGE_KEY,
  SECONDARY_SIDEBAR_WIDTH,
} from 'sentry/views/navigation/constants';
import {SecondaryNavigationContextProvider} from 'sentry/views/navigation/secondaryNavigationContext';

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

function setupMocks() {
  localStorage.clear();
  MockApiClient.clearMockResponses();

  ConfigStore.set('user', UserFixture());
  ConfigStore.set('customerDomain', null);

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/broadcasts/',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: '/assistant/',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/group-search-views/starred/',
    body: [GroupSearchViewFixture({name: 'Starred View 1'})],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/issues-count/',
    body: {},
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/explore/saved/',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/dashboards/',
    body: [],
  });
}

describe('SecondarySidebar', () => {
  beforeEach(setupMocks);

  it('uses the default width when no persisted value is in localStorage', () => {
    render(
      <SecondaryNavigationContextProvider>
        <Navigation />
      </SecondaryNavigationContextProvider>,
      {
        organization: OrganizationFixture({features: ALL_AVAILABLE_FEATURES}),
        initialRouterConfig: {location: {pathname: '/organizations/org-slug/issues/'}},
      }
    );

    const secondaryNav = screen.getByRole('navigation', {name: 'Secondary Navigation'});
    const sidebarContainer = secondaryNav.closest(
      `[${NAVIGATION_SECONDARY_SIDEBAR_DATA_ATTRIBUTE}]`
    );

    expect(sidebarContainer).toBeInTheDocument();
    expect(sidebarContainer).toHaveStyle({width: `${SECONDARY_SIDEBAR_WIDTH}px`});
  });

  it('uses the persisted width from localStorage instead of the default constant', () => {
    const persistedWidth = 300;
    localStorage.setItem(
      NAVIGATION_SIDEBAR_SECONDARY_WIDTH_LOCAL_STORAGE_KEY,
      String(persistedWidth)
    );

    render(
      <SecondaryNavigationContextProvider>
        <Navigation />
      </SecondaryNavigationContextProvider>,
      {
        organization: OrganizationFixture({features: ALL_AVAILABLE_FEATURES}),
        initialRouterConfig: {location: {pathname: '/organizations/org-slug/issues/'}},
      }
    );

    const secondaryNav = screen.getByRole('navigation', {name: 'Secondary Navigation'});
    const sidebarContainer = secondaryNav.closest(
      `[${NAVIGATION_SECONDARY_SIDEBAR_DATA_ATTRIBUTE}]`
    );

    expect(sidebarContainer).toBeInTheDocument();
    expect(sidebarContainer).toHaveStyle({width: `${persistedWidth}px`});
    expect(sidebarContainer).not.toHaveStyle({width: `${SECONDARY_SIDEBAR_WIDTH}px`});
  });
});
