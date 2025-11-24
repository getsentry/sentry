import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {MetricsTabContent} from 'sentry/views/explore/metrics/metricsTab';
import {MultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import type {PickableDays} from 'sentry/views/explore/utils';

const datePageFilterProps: PickableDays = {
  defaultPeriod: '7d' as const,
  maxPickableDays: 7,
  relativeOptions: ({arbitraryOptions}) => ({
    ...arbitraryOptions,
    '1h': 'Last hour',
    '24h': 'Last 24 hours',
    '7d': 'Last 7 days',
  }),
};

describe('MetricsTabContent', () => {
  const organization = OrganizationFixture({
    features: ['tracemetrics-enabled'],
  });
  const project = ProjectFixture({id: '1'});

  function ProviderWrapper({children}: {children: React.ReactNode}) {
    return <MultiMetricsQueryParamsProvider>{children}</MultiMetricsQueryParamsProvider>;
  }

  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/explore/metrics/`,
      query: {
        start: '2025-04-10T14%3A37%3A55',
        end: '2025-04-10T20%3A04%3A51',
        project: project.id,
      },
    },
    route: '/organizations/:orgId/explore/metrics/',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [],
        meta: {
          fields: {},
          units: {},
          isMetricsData: false,
          isMetricsExtractedData: false,
          tips: {},
          datasetReason: 'unchanged',
          dataset: 'tracemetrics',
          dataScanned: 'full',
          accuracy: {
            confidence: [],
          },
        },
        confidence: [],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      method: 'GET',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/stats_v2/`,
      method: 'GET',
      body: {},
    });
  });

  it('should add a metric when Add Metric button is clicked', async () => {
    const router = RouterFixture({
      location: initialRouterConfig.location,
    });

    render(
      <ProviderWrapper>
        <MetricsTabContent {...datePageFilterProps} />
      </ProviderWrapper>,
      {
        router,
        organization,
        deprecatedRouterMocks: true,
      }
    );

    expect(screen.getAllByTestId('metric-toolbar')).toHaveLength(1);
    expect(screen.getAllByTestId('metric-panel')).toHaveLength(1);

    const addButton = screen.getByRole('button', {name: 'Add Metric'});
    expect(addButton).toBeInTheDocument();
    expect(addButton).toBeEnabled();

    await userEvent.click(addButton);

    expect(screen.getAllByTestId('metric-toolbar')).toHaveLength(2);
    expect(screen.getAllByTestId('metric-panel')).toHaveLength(2);

    expect(screen.getByRole('button', {name: 'Add Metric'})).toBeInTheDocument();
  });
});
