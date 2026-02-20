import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import Nav from 'sentry/views/nav';
import {NavContextProvider} from 'sentry/views/nav/context';

jest.mock('sentry/utils/analytics', () => ({
  trackAnalytics: jest.fn(),
}));

describe('PreventSecondaryNav', () => {
  beforeEach(() => {
    localStorage.clear();
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/starred/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [],
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

  it('renders the correct tests link', async () => {
    render(
      <NavContextProvider>
        <Nav />
        <div id="main" />
      </NavContextProvider>,
      {
        organization: OrganizationFixture({features: ['prevent-test-analytics']}),
        initialRouterConfig: {
          route: '/organizations/:orgId/prevent/tests/',
          location: {
            pathname: '/organizations/org-slug/prevent/tests/',
          },
        },
      }
    );

    const testsLink = await screen.findByRole('link', {name: 'Tests'});
    expect(testsLink).toBeInTheDocument();
    expect(testsLink).toHaveAttribute('href', '/organizations/org-slug/prevent/tests/');
  });

  it('renders the correct tokens link', async () => {
    render(
      <NavContextProvider>
        <Nav />
        <div id="main" />
      </NavContextProvider>,
      {
        organization: OrganizationFixture({features: ['prevent-test-analytics']}),
        initialRouterConfig: {
          route: '/organizations/:orgId/prevent/tokens/',
          location: {
            pathname: '/organizations/org-slug/prevent/tokens/',
          },
        },
      }
    );

    const tokensLink = await screen.findByRole('link', {name: 'Tokens'});
    expect(tokensLink).toBeInTheDocument();
    expect(tokensLink).toHaveAttribute('href', '/organizations/org-slug/prevent/tokens/');
  });
});
