import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';

import {QuotaExceededAlert} from './quotaExceededAlert';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');

describe('Renders QuotaExceededAlert correctly', function () {
  const {organization} = initializeOrg();
  const subscription = SubscriptionFixture({
    organization,
    renewalDate: '2024-12-31',
    onDemandBudgets: {
      enabled: true,
    } as any,
    planTier: 'am1' as any,
    categories: {
      spans: {
        usageExceeded: true,
      },
    } as any,
  });
  beforeEach(function () {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-12-14'));
    jest.mocked(usePageFilters).mockReturnValue({
      isReady: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(),
      shouldPersist: true,
      selection: {
        datetime: {
          period: '7d',
          start: null,
          end: null,
          utc: false,
        },
        environments: [],
        projects: [2],
      },
    });

    jest.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {statsPeriod: '7d'},
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders alert when quota is exceeded', async function () {
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

    render(<QuotaExceededAlert subscription={subscription} referrer="trace-view" />, {
      organization,
    });

    expect(await screen.findByText(/You[''\u2019]ve exceeded your/i)).toBeInTheDocument();

    const onDemandTexts = screen.getAllByText(/on-demand budget/i);
    expect(onDemandTexts).toHaveLength(2);

    expect(
      screen.getByText(
        /during this date range and results will be skewed. We can’t collect more spans until/
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Dec 31, 2024/)).toBeInTheDocument();
    expect(screen.getByText(/or adjust your date range prior to/)).toBeInTheDocument();
    expect(screen.getByText(/Dec 07, 2024/)).toBeInTheDocument();

    expect(
      screen.getByRole('link', {name: /increase your on-demand budget/})
    ).toHaveAttribute(
      'href',
      '/settings/billing/checkout/?referrer=trace-view&skipBundles=true'
    );
  });
});
