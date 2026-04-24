import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Navigation} from 'sentry/views/navigation';
import {PrimaryNavigationContextProvider} from 'sentry/views/navigation/primaryNavigationContext';
import {SecondaryNavigationContextProvider} from 'sentry/views/navigation/secondaryNavigationContext';

describe('ExploreSecondaryNavigation', () => {
  const {organization} = initializeOrg({
    organization: {
      features: ['performance-view', 'visibility-explore-view'],
    },
  });

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/starred/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/explore/saved/',
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/broadcasts/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/assistant/',
      body: [],
    });
  });

  it('renders', () => {
    render(
      <PrimaryNavigationContextProvider>
        <SecondaryNavigationContextProvider>
          <Navigation />
          <div id="main" />
        </SecondaryNavigationContextProvider>
      </PrimaryNavigationContextProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/traces/',
          },
        },
      }
    );

    expect(screen.getByText('Traces')).toBeInTheDocument();
  });

  it('links Discover to homepage when discover-query is enabled', () => {
    const {organization: orgWithQuery} = initializeOrg({
      organization: {
        features: [
          'performance-view',
          'visibility-explore-view',
          'discover-basic',
          'discover-query',
        ],
      },
    });

    render(
      <PrimaryNavigationContextProvider>
        <SecondaryNavigationContextProvider>
          <Navigation />
          <div id="main" />
        </SecondaryNavigationContextProvider>
      </PrimaryNavigationContextProvider>,
      {
        organization: orgWithQuery,
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/explore/traces/'},
        },
      }
    );

    expect(screen.getByRole('link', {name: 'Discover'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/discover/homepage/'
    );
  });

  it('links Discover to results when discover-query is disabled', () => {
    const {organization: orgWithoutQuery} = initializeOrg({
      organization: {
        features: ['performance-view', 'visibility-explore-view', 'discover-basic'],
      },
    });

    render(
      <PrimaryNavigationContextProvider>
        <SecondaryNavigationContextProvider>
          <Navigation />
          <div id="main" />
        </SecondaryNavigationContextProvider>
      </PrimaryNavigationContextProvider>,
      {
        organization: orgWithoutQuery,
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/explore/traces/'},
        },
      }
    );

    expect(screen.getByRole('link', {name: 'Discover'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/discover/results/'
    );
  });
});
