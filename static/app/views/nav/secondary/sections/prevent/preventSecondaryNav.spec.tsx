import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import Nav from 'sentry/views/nav';
import {NavContextProvider} from 'sentry/views/nav/context';

jest.mock('sentry/utils/analytics', () => ({
  trackAnalytics: jest.fn(),
}));

const ALL_AVAILABLE_FEATURES = ['prevent-test-analytics'];

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

  it('renders the correct tests link', () => {
    render(
      <NavContextProvider>
        <Nav />
        <div id="main" />
      </NavContextProvider>,
      {
        organization: OrganizationFixture({features: ALL_AVAILABLE_FEATURES}),
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/prevent/tests/',
          },
        },
      }
    );

    const testsLink = screen.getByRole('link', {name: 'Tests'});
    expect(testsLink).toBeInTheDocument();
    expect(testsLink).toHaveAttribute('href', '/organizations/org-slug/prevent/tests/');
  });

  it('renders the correct tokens link', () => {
    render(
      <NavContextProvider>
        <Nav />
        <div id="main" />
      </NavContextProvider>,
      {
        organization: OrganizationFixture({features: ALL_AVAILABLE_FEATURES}),
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/prevent/tokens/',
          },
        },
      }
    );

    const tokensLink = screen.getByRole('link', {name: 'Tokens'});
    expect(tokensLink).toBeInTheDocument();
    expect(tokensLink).toHaveAttribute('href', '/organizations/org-slug/prevent/tokens/');
  });

  it('renders the correct prevent AI link', () => {
    render(
      <NavContextProvider>
        <Nav />
        <div id="main" />
      </NavContextProvider>,
      {
        organization: OrganizationFixture({features: ALL_AVAILABLE_FEATURES}),
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/prevent/ai-code-review/new/',
          },
        },
      }
    );

    const preventAILink = screen.getByRole('link', {name: 'AI Code Review'});
    expect(preventAILink).toBeInTheDocument();
    expect(preventAILink).toHaveAttribute(
      'href',
      '/organizations/org-slug/prevent/ai-code-review/new/'
    );
  });
});
