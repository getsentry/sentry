import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Navigation} from 'sentry/views/navigation';
import {PrimaryNavigationContextProvider} from 'sentry/views/navigation/primaryNavigationContext';

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
      url: `/organizations/org-slug/broadcasts/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/assistant/`,
      body: [],
    });
  });

  it('renders', () => {
    render(
      <PrimaryNavigationContextProvider>
        <Navigation />
        <div id="main" />
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
});
