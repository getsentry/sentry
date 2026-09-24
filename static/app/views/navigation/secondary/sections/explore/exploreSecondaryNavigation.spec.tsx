import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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
      body: [],
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

  it('shows Investigations when the feature is enabled', async () => {
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
    await userEvent.hover(screen.getByLabelText('experimental'));
    expect(
      await screen.findByText(
        'This feature is experimental! Try it out and let us know what you think. No promises!'
      )
    ).toBeInTheDocument();
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

  it('fetches the combined endpoint and lists both products when discover-queries-in-all-queries is on', async () => {
    const {organization: combinedOrganization} = initializeOrg({
      organization: {
        features: [
          'performance-view',
          'visibility-explore-view',
          'discover-queries-in-all-queries',
        ],
      },
    });

    const getQueriesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/explore/all-queries/',
      body: [
        {
          id: 1,
          queryType: 'explore',
          name: 'Starred Explore Query',
          dataset: 'spans',
          projects: [],
          starred: true,
          position: 1,
          query: [{query: '', fields: [], groupby: [], visualize: []}],
        },
        {
          // Same id as the explore row above, from discover's own sequence.
          id: 1,
          queryType: 'discover',
          name: 'Starred Discover Query',
          queryDataset: 'error-events',
          projects: [],
          starred: true,
          position: 2,
          fields: ['title'],
          query: '',
          orderby: '',
        },
      ],
    });

    render(
      <PrimaryNavigationContextProvider>
        <SecondaryNavigationContextProvider>
          <Navigation />
          <div id="main" />
        </SecondaryNavigationContextProvider>
      </PrimaryNavigationContextProvider>,
      {
        organization: combinedOrganization,
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/explore/traces/'},
        },
      }
    );

    expect(await screen.findByText('Starred Explore Query')).toBeInTheDocument();
    expect(screen.getByText('Starred Discover Query')).toBeInTheDocument();
    expect(getQueriesMock).toHaveBeenCalled();
  });
});
