import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

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
        data: [
          {'metric.name': 'foo', 'metric.type': 'counter', 'count(metric.name)': 1},
          {'metric.name': 'bar', 'metric.type': 'distribution', 'count(metric.name)': 2},
          {'metric.name': 'baz', 'metric.type': 'gauge', 'count(metric.name)': 3},
        ],
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
      match: [
        MockApiClient.matchQuery({
          dataset: 'tracemetrics',
          referrer: 'api.explore.metric-options',
        }),
      ],
    });

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
      match: [
        MockApiClient.matchQuery({
          dataset: 'tracemetrics',
          referrer: 'api.explore.metric-aggregates-table',
        }),
      ],
    });

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
      match: [
        MockApiClient.matchQuery({
          dataset: 'tracemetrics',
          referrer: 'api.explore.metric-samples-table',
        }),
      ],
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
    render(
      <ProviderWrapper>
        <MetricsTabContent {...datePageFilterProps} />
      </ProviderWrapper>,
      {
        initialRouterConfig,
        organization,
      }
    );

    let toolbars = screen.getAllByTestId('metric-toolbar');
    expect(toolbars).toHaveLength(1);
    // have to wait for the response to load
    await waitFor(() => {
      // selects the first metric available - sorted alphanumerically
      expect(within(toolbars[0]!).getByRole('button', {name: 'bar'})).toBeInTheDocument();
    });
    expect(screen.getAllByTestId('metric-panel')).toHaveLength(1);

    let addButton = screen.getByRole('button', {name: 'Add Metric'});
    expect(addButton).toBeInTheDocument();
    expect(addButton).toBeEnabled();

    await userEvent.click(addButton);

    toolbars = screen.getAllByTestId('metric-toolbar');
    expect(toolbars).toHaveLength(2);
    // copies the last metric as a starting point
    expect(within(toolbars[1]!).getByRole('button', {name: 'bar'})).toBeInTheDocument();
    expect(screen.getAllByTestId('metric-panel')).toHaveLength(2);

    // change the second metric from bar to foo
    await userEvent.click(within(toolbars[1]!).getByRole('button', {name: 'bar'}));
    await userEvent.click(within(toolbars[1]!).getByRole('option', {name: 'foo'}));
    expect(within(toolbars[1]!).getByRole('button', {name: 'foo'})).toBeInTheDocument();

    addButton = screen.getByRole('button', {name: 'Add Metric'});
    expect(addButton).toBeInTheDocument();
    expect(addButton).toBeEnabled();

    await userEvent.click(addButton);

    toolbars = screen.getAllByTestId('metric-toolbar');
    expect(toolbars).toHaveLength(3);
    // copies the last metric as a starting point
    expect(within(toolbars[2]!).getByRole('button', {name: 'foo'})).toBeInTheDocument();
    expect(screen.getAllByTestId('metric-panel')).toHaveLength(3);
  });
});
