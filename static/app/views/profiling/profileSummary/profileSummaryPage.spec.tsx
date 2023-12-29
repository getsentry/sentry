import {Location} from 'history';
import {GlobalSelection} from 'sentry-fixture/globalSelection';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';

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
  it('renders new page', async () => {
    const organization = Organization({
      features: [],
      projects: [ProjectFixture()],
    });
    OrganizationStore.onUpdate(organization);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [ProjectFixture()],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/profiling/filters/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/profiling/flamegraph/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [{'last_seen()': new Date()}],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/profiling/function-trends/`,
      body: [],
    });

    render(
      <ProfileSummaryPage
        view="flamegraph"
        params={{}}
        selection={GlobalSelection()}
        location={
          {
            query: {transaction: 'fancyservice'},
          } as unknown as Location
        }
      />,
      {
        organization: Organization({
          features: ['profiling-summary-redesign'],
        }),
        context: RouterContextFixture(),
      }
    );

    expect(await screen.findByTestId(/profile-summary-redesign/i)).toBeInTheDocument();
  });
});
