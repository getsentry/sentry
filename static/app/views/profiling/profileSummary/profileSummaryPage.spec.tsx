import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import {mockMatchMedia} from 'sentry-test/utils';

import OrganizationStore from 'sentry/stores/organizationStore';
import ProfileSummaryPage from 'sentry/views/profiling/profileSummary';

window.ResizeObserver =
  window.ResizeObserver ||
  jest.fn().mockImplementation(() => ({
    disconnect: jest.fn(),
    observe: jest.fn(),
    unobserve: jest.fn(),
  }));

describe('ProfileSummaryPage', () => {
  beforeEach(() => {
    mockMatchMedia(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders new page', async () => {
    const organization = OrganizationFixture({features: []});
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

    render(<ProfileSummaryPage />, {
      organization: OrganizationFixture(),
      initialRouterConfig: {
        location: {
          pathname: '/profiling/summary/project-slug',
          query: {transaction: 'fancyservice'},
        },
      },
    });

    expect(await screen.findByTestId(/profile-summary-redesign/i)).toBeInTheDocument();
  });
});
