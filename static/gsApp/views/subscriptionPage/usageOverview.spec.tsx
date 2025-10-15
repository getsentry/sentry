import moment from 'moment-timezone';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingHistoryFixture} from 'getsentry-test/fixtures/billingHistory';
import {CustomerUsageFixture} from 'getsentry-test/fixtures/customerUsage';
import {
  SubscriptionFixture,
  SubscriptionWithSeerFixture,
} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import {DataCategory} from 'sentry/types/core';

import {GIGABYTE} from 'getsentry/constants';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import Overview from 'getsentry/views/subscriptionPage/overview';
import UsageOverview from 'getsentry/views/subscriptionPage/usageOverview';

describe('UsageOverview', () => {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization, plan: 'am3_business'});
  const usageData = CustomerUsageFixture();

  beforeEach(() => {
    organization.features = ['subscriptions-v3', 'seer-billing'];
    setMockDate(new Date('2021-05-07'));
    MockApiClient.clearMockResponses();
    organization.access = ['org:billing'];
    SubscriptionStore.set(organization.slug, subscription);
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/history/current/`,
      method: 'GET',
      body: BillingHistoryFixture(),
    });
  });

  afterEach(() => {
    resetMockDate();
  });

  it('renders columns and buttons for billing users', () => {
    render(
      <UsageOverview
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />
    );
    expect(screen.getByRole('columnheader', {name: 'Product'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Total usage'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Reserved'})).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Reserved spend'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Pay-as-you-go spend'})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'View usage history'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Download as CSV'})).toBeInTheDocument();
    expect(screen.getAllByRole('row', {name: /^View .+ usage$/i}).length).toBeGreaterThan(
      0
    );
  });

  it('renders columns for non-billing users', () => {
    organization.access = [];
    render(
      <UsageOverview
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />
    );
    expect(screen.getByRole('columnheader', {name: 'Product'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Total usage'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Reserved'})).toBeInTheDocument();
    expect(screen.queryByText('Reserved spend')).not.toBeInTheDocument();
    expect(screen.queryByText('Pay-as-you-go spend')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'View usage history'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Download as CSV'})
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('row', {name: /^View .+ usage$/i}).length).toBeGreaterThan(
      0
    );
  });

  it('renders table based on subscription state', () => {
    subscription.onDemandMaxSpend = 100_00;
    subscription.productTrials = [
      {
        category: DataCategory.PROFILE_DURATION,
        isStarted: false,
        reasonCode: 1001,
        startDate: undefined,
        endDate: moment().utc().add(20, 'years').format(),
      },
      {
        category: DataCategory.REPLAYS,
        isStarted: true,
        reasonCode: 1001,
        startDate: moment().utc().subtract(10, 'days').format(),
        endDate: moment().utc().add(20, 'days').format(),
      },
    ];
    subscription.categories.errors = {
      ...subscription.categories.errors!,
      free: 1000,
      usage: 6000,
      onDemandSpendUsed: 10_00,
    };
    subscription.categories.attachments = {
      ...subscription.categories.attachments!,
      reserved: 25, // 25 GB
      prepaid: 25, // 25 GB
      free: 0,
      usage: GIGABYTE / 2,
    };
    subscription.categories.spans = {
      ...subscription.categories.spans!,
      reserved: 20_000_000,
    };

    render(
      <UsageOverview
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />
    );

    // Continuous profile hours product trial available
    expect(
      screen.getByRole('button', {
        name: 'Start 14 day free Continuous Profile Hours trial',
      })
    ).toBeInTheDocument();
    expect(screen.queryByText('Trial available')).not.toBeInTheDocument();

    // Replays product trial active
    expect(screen.getByRole('cell', {name: '20 days left'})).toBeInTheDocument();

    // Errors usage and gifted units
    expect(screen.getByRole('cell', {name: '6,000'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '$10.00'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '12% of 51,000'})).toBeInTheDocument();

    // Attachments usage should be in the correct unit + above platform volume
    expect(screen.getByRole('cell', {name: '500 MB'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '2% of 25 GB'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '$6.00'})).toBeInTheDocument();

    // Reserved spans above platform volume
    expect(screen.getAllByRole('cell', {name: '0'}).length).toBeGreaterThan(0);
    expect(screen.getByRole('cell', {name: '$32.00'})).toBeInTheDocument();
  });

  it('renders table based on add-on state', () => {
    organization.features.push('prevent-billing');
    const subWithSeer = SubscriptionWithSeerFixture({organization});
    SubscriptionStore.set(organization.slug, subWithSeer);
    render(
      <UsageOverview
        subscription={subWithSeer}
        organization={organization}
        usageData={usageData}
      />
    );
    expect(screen.getByRole('cell', {name: 'Seer'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Collapse Seer details'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'Issue Fixes'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'Issue Scans'})).toBeInTheDocument();

    // Org has Prevent flag but did not buy Prevent add on
    expect(screen.getByRole('cell', {name: 'Prevent'})).toBeInTheDocument();
    expect(
      screen.queryByRole('row', {name: 'Collapse Prevent details'})
    ).not.toBeInTheDocument();
    // We test it this way to ensure we don't show the cell with the proper display name or the raw DataCategory
    expect(screen.queryByRole('cell', {name: /Prevent*Users/})).not.toBeInTheDocument();
    expect(screen.queryByRole('cell', {name: /Prevent*Reviews/})).not.toBeInTheDocument();
  });

  it('can open drawer for data categories but not add ons', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/usage/`,
      method: 'GET',
      body: CustomerUsageFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/plan-migrations/`,
      query: {scheduled: 1, applied: 0},
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/next-bill/`,
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/recurring-credits/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/history/`,
      method: 'GET',
    });
    const subWithSeer = SubscriptionWithSeerFixture({organization});
    const mockLocation = LocationFixture();
    SubscriptionStore.set(organization.slug, subWithSeer);

    // use Overview component here so we can test the drawers
    render(<Overview location={mockLocation} />, {organization});

    await screen.findByText('Usage Overview');
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('row', {name: 'View Errors usage'}));
    expect(
      screen.getByRole('complementary', {name: 'Usage for Errors'})
    ).toBeInTheDocument();

    // cannot open drawer for seat-based categories
    expect(
      screen.queryByRole('row', {name: 'View Cron Monitors usage'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('row', {name: 'View Uptime monitors usage'})
    ).not.toBeInTheDocument();

    // cannot open drawer for add-ons, but can open for an add-on's data categories
    expect(screen.queryByRole('row', {name: 'View Seer usage'})).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('row', {name: 'View Issue Fixes usage'}));
    expect(
      screen.getByRole('complementary', {name: 'Usage for Issue Fixes'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', {name: 'Usage for Errors'})
    ).not.toBeInTheDocument();
  });
});
