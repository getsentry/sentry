import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';

import {QuotaExceededAlert} from './quotaExceededAlert';

describe('Renders QuotaExceededAlert correctly for spans', () => {
  const organization = OrganizationFixture();
  const initialRouterConfig = {
    location: {
      pathname: '/organizations/org-slug/performance/quota-exceeded-alert',
      query: {statsPeriod: '7d'},
    },
    route: '/organizations/:orgId/performance/quota-exceeded-alert',
  };
  const getSubscription = ({
    spansUsageExceeded,
    logsUsageExceeded,
  }: {
    logsUsageExceeded: boolean;
    spansUsageExceeded: boolean;
  }) => {
    return SubscriptionFixture({
      organization,
      onDemandPeriodEnd: '2024-12-30',
      onDemandBudgets: {
        enabled: true,
      } as any,
      planTier: 'am1' as any,
      categories: {
        spans: {
          usageExceeded: spansUsageExceeded,
        },
        logBytes: {
          usageExceeded: logsUsageExceeded,
        },
      } as any,
    });
  };
  beforeEach(() => {
    setMockDate(new Date('2024-12-14').getTime());
    PageFiltersStore.onInitializeUrlState({
      projects: [2],
      environments: [],
      datetime: {
        period: '7d',
        start: null,
        end: null,
        utc: false,
      },
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    resetMockDate();
  });

  it('renders alert when quota is exceeded for spans', async () => {
    // Mock performance usage stats endpoint
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/stats_v2/`,
      method: 'GET',
      body: {
        groups: [
          {
            by: {
              reason: 'span_usage_exceeded',
            },
            totals: {
              'sum(quantity)': 1000,
            },
          },
        ],
      },
    });

    render(
      <QuotaExceededAlert
        subscription={getSubscription({
          logsUsageExceeded: false,
          spansUsageExceeded: true,
        })}
        traceItemDataset="spans"
        referrer="trace-view"
      />,
      {
        organization,
        initialRouterConfig,
      }
    );

    expect(await screen.findByText(/You['\u2019]ve exceeded your/i)).toBeInTheDocument();

    const onDemandTexts = screen.getAllByText(/on-demand budget/i);
    expect(onDemandTexts).toHaveLength(2);

    expect(
      screen.getByText(
        /during this date range and results will be skewed. We can’t collect more spans until/
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Dec 31, 2024/)).toBeInTheDocument();
    expect(screen.getByText(/or adjust your date range prior to/)).toBeInTheDocument();
    expect(screen.getByText(/Dec 7, 2024/)).toBeInTheDocument();

    expect(
      screen.getByRole('link', {name: /increase your on-demand budget/})
    ).toHaveAttribute('href', '/checkout/?referrer=trace-view&skipBundles=true');
  });

  it('renders alert when quota is exceeded for logs', async () => {
    // Mock performance usage stats endpoint
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/stats_v2/`,
      method: 'GET',
      body: {
        groups: [
          {
            by: {
              reason: 'log_bytes_usage_exceeded',
            },
            totals: {
              'sum(quantity)': 1000,
            },
          },
        ],
      },
    });

    render(
      <QuotaExceededAlert
        subscription={getSubscription({
          logsUsageExceeded: true,
          spansUsageExceeded: false,
        })}
        traceItemDataset="logs"
        referrer="trace-view"
      />,
      {
        organization,
        initialRouterConfig,
      }
    );

    expect(await screen.findByText(/You['\u2019]ve exceeded your/i)).toBeInTheDocument();

    const onDemandTexts = screen.getAllByText(/on-demand budget/i);
    expect(onDemandTexts).toHaveLength(2);

    expect(
      screen.getByText(
        /during this date range and results will be skewed. We can’t collect more logs until/
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Dec 31, 2024/)).toBeInTheDocument();
    expect(screen.getByText(/or adjust your date range prior to/)).toBeInTheDocument();
    expect(screen.getByText(/Dec 7, 2024/)).toBeInTheDocument();

    expect(
      screen.getByRole('link', {name: /increase your on-demand budget/})
    ).toHaveAttribute('href', '/checkout/?referrer=trace-view&skipBundles=true');
  });
});
