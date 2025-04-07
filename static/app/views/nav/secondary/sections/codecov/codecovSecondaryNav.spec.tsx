import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import Nav from 'sentry/views/nav';
import {NavContextProvider} from 'sentry/views/nav/context';

jest.mock('sentry/utils/analytics', () => ({
  trackAnalytics: jest.fn(),
}));

const ALL_AVAILABLE_FEATURES = ['codecov-ui'];

describe('CodecovSecondaryNav', () => {
  beforeEach(() => {
    localStorage.clear();
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/broadcasts/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/assistant/`,
      body: [],
    });
  });

  it('renders the correct coverage link', () => {
    render(
      <NavContextProvider>
        <Nav />
        <div id="main" />
      </NavContextProvider>,
      {
        organization: OrganizationFixture({features: ALL_AVAILABLE_FEATURES}),
        enableRouterMocks: false,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/codecov/coverage/commits/',
          },
        },
      }
    );

    const coverageLink = screen.getByRole('link', {name: 'Coverage'});
    expect(coverageLink).toBeInTheDocument();
    expect(coverageLink).toHaveAttribute(
      'href',
      '/organizations/org-slug/codecov/coverage/commits/'
    );
  });

  it('renders the correct tests link', () => {
    render(
      <NavContextProvider>
        <Nav />
        <div id="main" />
      </NavContextProvider>,
      {
        organization: OrganizationFixture({features: ALL_AVAILABLE_FEATURES}),
        enableRouterMocks: false,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/codecov/tests/',
          },
        },
      }
    );

    const testsLink = screen.getByRole('link', {name: 'Tests'});
    expect(testsLink).toBeInTheDocument();
    expect(testsLink).toHaveAttribute('href', '/organizations/org-slug/codecov/tests/');
  });
});
