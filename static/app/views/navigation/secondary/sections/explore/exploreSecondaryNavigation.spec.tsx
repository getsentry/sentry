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
      url: '/organizations/org-slug/explore/all-queries/',
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

  function renderExploreNavigation(features: string[]) {
    const {organization: seerOrganization} = initializeOrg({
      organization: {
        features: ['performance-view', 'visibility-explore-view', ...features],
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
        organization: seerOrganization,
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/explore/traces/'},
        },
      }
    );
  }

  it('shows Automations above Investigations without seer-primary-nav', () => {
    renderExploreNavigation(['investigations', 'seer-automations']);

    const automations = screen.getByRole('link', {name: /Automations/});
    const investigations = screen.getByRole('link', {name: /Investigations/});
    expect(automations).toHaveAttribute(
      'href',
      '/organizations/org-slug/seer/automations/'
    );
    expect(investigations).toHaveAttribute(
      'href',
      '/organizations/org-slug/seer/investigations/'
    );
    expect(screen.getAllByLabelText('alpha')).toHaveLength(2);
    expect(
      automations.compareDocumentPosition(investigations) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('hides the Seer tabs when seer-primary-nav is enabled', () => {
    renderExploreNavigation(['investigations', 'seer-automations', 'seer-primary-nav']);

    expect(screen.queryByRole('link', {name: /Automations/})).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name: /Investigations/})).not.toBeInTheDocument();
  });

  it('only shows Seer tabs whose features are enabled', () => {
    renderExploreNavigation(['seer-automations']);

    expect(screen.getByRole('link', {name: /Automations/})).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: /Investigations/})).not.toBeInTheDocument();
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

  it('links Errors to the errors page when discover-basic is enabled', () => {
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

    expect(screen.getByRole('link', {name: 'Errors'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/errors/'
    );
  });

  it('fetches the combined endpoint and lists both products', async () => {
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
        organization,
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
