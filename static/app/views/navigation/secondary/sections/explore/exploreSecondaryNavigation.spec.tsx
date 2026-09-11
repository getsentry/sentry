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
    expect(screen.queryByText('Investigations')).not.toBeInTheDocument();
  });

  it('shows Investigations when the feature is enabled', () => {
    const {organization: investigationsOrganization} = initializeOrg({
      organization: {
        features: ['performance-view', 'visibility-explore-view', 'investigations'],
        openMembership: true,
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
        organization: investigationsOrganization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/investigations/',
          },
        },
      }
    );

    expect(screen.getByRole('link', {name: /Investigations/})).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/investigations/'
    );
    expect(screen.getByLabelText('beta')).toBeInTheDocument();
  });

  it('keeps Explore and Investigations active on investigation detail pages', () => {
    const {organization: investigationsOrganization} = initializeOrg({
      organization: {
        features: ['performance-view', 'visibility-explore-view', 'investigations'],
        openMembership: true,
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
        organization: investigationsOrganization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/investigations/investigation-1/',
          },
        },
      }
    );

    expect(screen.getByRole('link', {name: 'Explore'})).toHaveAttribute(
      'aria-current',
      'location'
    );
    expect(screen.getByRole('link', {name: /Investigations/})).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('hides Investigations for a closed-membership organization', () => {
    const {organization: closedMembershipOrganization} = initializeOrg({
      organization: {
        features: ['performance-view', 'visibility-explore-view', 'investigations'],
        openMembership: false,
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
        organization: closedMembershipOrganization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/traces/',
          },
        },
      }
    );

    expect(screen.queryByText('Investigations')).not.toBeInTheDocument();
  });

  it('marks Releases as active on preprod pages', () => {
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
            pathname: '/organizations/org-slug/preprod/snapshots/123/',
          },
        },
      }
    );

    expect(screen.getByRole('link', {name: 'Releases'})).toHaveAttribute(
      'aria-current',
      'page'
    );
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
});
