import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import Nav from 'sentry/views/nav';
import {NavContextProvider} from 'sentry/views/nav/context';
import PipelineSecondaryNav from 'sentry/views/pipeline/navigation';

jest.mock('sentry/utils/analytics', () => ({
  trackAnalytics: jest.fn(),
}));

const ALL_AVAILABLE_FEATURES = ['codecov-ui'];

describe('PipelineSecondaryNav', () => {
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

  it('renders the passed children', () => {
    render(
      <NavContextProvider>
        <Nav />
        <PipelineSecondaryNav>
          <p>Test content</p>
        </PipelineSecondaryNav>
        <div id="main" />
      </NavContextProvider>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('renders the correct coverage link', () => {
    render(
      <NavContextProvider>
        <Nav />
        <PipelineSecondaryNav>
          <p>Test content</p>
        </PipelineSecondaryNav>
        <div id="main" />
      </NavContextProvider>,
      {
        organization: OrganizationFixture({features: ALL_AVAILABLE_FEATURES}),
        disableRouterMocks: true,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/test-org-slug/pipeline/coverage/',
          },
        },
      }
    );

    const coverageLink = screen.getByText('Coverage');
    expect(coverageLink).toBeInTheDocument();
    // TODO: @nicholas-codecov this link should appear once routes have been added
    expect(coverageLink).not.toHaveAttribute('href');
  });

  it('renders the correct tests link', () => {
    render(
      <NavContextProvider>
        <Nav />
        <PipelineSecondaryNav>
          <p>Test content</p>
        </PipelineSecondaryNav>
        <div id="main" />
      </NavContextProvider>,
      {
        organization: OrganizationFixture({features: ALL_AVAILABLE_FEATURES}),
        disableRouterMocks: true,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/test-org-slug/pipeline/tests/',
          },
        },
      }
    );

    const testsLink = screen.getByText('Tests');
    expect(testsLink).toBeInTheDocument();
    // TODO: @nicholas-codecov this link should appear once routes have been added
    expect(testsLink).not.toHaveAttribute('href');
  });
});
