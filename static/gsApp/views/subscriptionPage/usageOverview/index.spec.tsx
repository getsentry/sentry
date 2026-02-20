import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingHistoryFixture} from 'getsentry-test/fixtures/billingHistory';
import {CustomerUsageFixture} from 'getsentry-test/fixtures/customerUsage';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';
import useMedia from 'sentry/utils/useMedia';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import UsageOverview from 'getsentry/views/subscriptionPage/usageOverview';

jest.mock('sentry/utils/useMedia', () => {
  const actual = jest.requireActual('sentry/utils/useMedia');
  return {
    __esModule: true,
    default: jest.fn(actual.default),
  };
});

const actualUseMedia = jest.requireActual<typeof import('sentry/utils/useMedia')>(
  'sentry/utils/useMedia'
).default;
const mockUseMedia = jest.mocked(useMedia);

describe('UsageOverview', () => {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({
    organization,
    plan: 'am3_business',
    onDemandPeriodStart: '2021-05-02',
    onDemandPeriodEnd: '2021-06-01',
  });
  const usageData = CustomerUsageFixture();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMedia.mockImplementation(actualUseMedia);
    organization.features = ['seer-billing'];
    organization.access = ['org:billing'];
    SubscriptionStore.set(organization.slug, subscription);
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/history/current/`,
      method: 'GET',
      body: BillingHistoryFixture(),
    });
  });

  it('renders actions for billing users', async () => {
    render(
      <UsageOverview
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />
    );

    await screen.findByRole('heading', {name: 'Usage: May 2 - Jun 1, 2021'});
    expect(screen.getByRole('button', {name: 'View all usage'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Download as CSV'})).toBeInTheDocument();
  });

  it('does not render actions for non-billing users', async () => {
    organization.access = [];
    render(
      <UsageOverview
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />
    );

    await screen.findByRole('heading', {name: 'Usage: May 2 - Jun 1, 2021'});
    expect(
      screen.queryByRole('button', {name: 'View all usage'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Download as CSV'})
    ).not.toBeInTheDocument();
  });

  it('opens panel based with no query params', async () => {
    mockUseMedia.mockImplementation(query => query.includes('min-width'));
    render(
      <UsageOverview
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />
    );

    await screen.findByRole('heading', {name: 'Errors'});
  });

  it('opens panel based on query params', async () => {
    mockUseMedia.mockImplementation(query => query.includes('min-width'));
    render(
      <UsageOverview
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />,
      {
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/subscription/usage-overview',
            query: {product: DataCategory.REPLAYS},
          },
        },
      }
    );

    await screen.findByRole('heading', {name: 'Replays'});
    expect(screen.queryByRole('heading', {name: 'Errors'})).not.toBeInTheDocument();
  });

  it('defaults to last selected when query param is invalid', async () => {
    mockUseMedia.mockImplementation(query => query.includes('min-width'));
    render(
      <UsageOverview
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />,
      {
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/subscription/usage-overview',
            query: {product: 'transactions'},
          },
        },
      }
    );

    await screen.findByRole('heading', {name: 'Errors'});
    expect(screen.queryByRole('heading', {name: 'Transactions'})).not.toBeInTheDocument();
  });

  it('can switch panel by clicking table rows', async () => {
    mockUseMedia.mockImplementation(query => query.includes('min-width'));
    render(
      <UsageOverview
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />
    );

    await screen.findByRole('heading', {name: 'Errors'});
    expect(screen.queryByRole('heading', {name: 'Replays'})).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'View Replays usage'}));
    await screen.findByRole('heading', {name: 'Replays'});
    expect(screen.queryByRole('heading', {name: 'Errors'})).not.toBeInTheDocument();
  });
});
