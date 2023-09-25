import {render, screen} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import ProfileSummaryPage from 'sentry/views/profiling/profileSummary';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Replace the webgl renderer with a dom renderer for tests
jest.mock('sentry/utils/profiling/renderers/flamegraphRendererWebGL', () => {
  const {
    FlamegraphRendererDOM,
  } = require('sentry/utils/profiling/renderers/flamegraphRendererDOM');

  return {
    FlamegraphRendererWebGL: FlamegraphRendererDOM,
  };
});

window.ResizeObserver =
  window.ResizeObserver ||
  jest.fn().mockImplementation(() => ({
    disconnect: jest.fn(),
    observe: jest.fn(),
    unobserve: jest.fn(),
  }));

describe('ProfileSummaryPage', () => {
  it('renders legacy page', async () => {
    const organization = TestStubs.Organization({
      features: [],
      projects: [TestStubs.Project()],
    });
    OrganizationStore.onUpdate(organization);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [TestStubs.Project()],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/profiling/filters/`,
      body: [],
    });

    render(
      <ProfileSummaryPage
        params={{}}
        selection={TestStubs.GlobalSelection()}
        location={TestStubs.location()}
      />,
      {
        organization,
        context: TestStubs.routerContext(),
      }
    );

    expect(await screen.findByTestId(/profile-summary-legacy/i)).toBeInTheDocument();
  });

  it('renders new page', async () => {
    const organization = TestStubs.Organization({
      features: [],
      projects: [TestStubs.Project()],
    });
    OrganizationStore.onUpdate(organization);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/profiling/filters/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/profiling/flamegraph/`,
      body: [],
    });

    render(
      <ProfileSummaryPage
        params={{}}
        selection={TestStubs.GlobalSelection()}
        location={TestStubs.location()}
      />,
      {
        organization: TestStubs.Organization({
          features: ['profiling-summary-redesign'],
        }),
        context: TestStubs.routerContext(),
      }
    );

    expect(await screen.findByTestId(/profile-summary-redesign/i)).toBeInTheDocument();
  });
});
