import moment from 'moment-timezone';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingHistoryFixture} from 'getsentry-test/fixtures/billingHistory';
import {CustomerUsageFixture} from 'getsentry-test/fixtures/customerUsage';
import {
  SubscriptionFixture,
  SubscriptionWithLegacySeerFixture,
} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import {DataCategory} from 'sentry/types/core';

import {GIGABYTE, UNLIMITED, UNLIMITED_RESERVED} from 'getsentry/constants';
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
    expect(screen.getAllByRole('columnheader')).toHaveLength(6);
    expect(screen.getByRole('columnheader', {name: 'Product'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Total usage'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Reserved'})).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Reserved spend'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Pay-as-you-go spend'})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'View all usage'})).toBeInTheDocument();
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
    expect(screen.getAllByRole('columnheader')).toHaveLength(6);
    expect(screen.getByRole('columnheader', {name: 'Product'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Total usage'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Reserved'})).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Reserved spend'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Pay-as-you-go spend'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'View all usage'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Download as CSV'})
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('row', {name: /^View .+ usage$/i}).length).toBeGreaterThan(
      0
    );
  });

  it('renders some spend columns for non-self-serve with PAYG support', () => {
    const newSubscription = SubscriptionFixture({
      organization,
      plan: 'am3_business',
      supportsOnDemand: true,
      canSelfServe: false,
    });
    SubscriptionStore.set(organization.slug, newSubscription);
    render(
      <UsageOverview
        subscription={newSubscription}
        organization={organization}
        usageData={usageData}
      />
    );
    expect(screen.getAllByRole('columnheader')).toHaveLength(5);
    expect(
      screen.queryByRole('columnheader', {name: 'Reserved spend'})
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Pay-as-you-go spend'})
    ).toBeInTheDocument();
  });

  it('does not render spend columns for non-self-serve without PAYG support', () => {
    const newSubscription = SubscriptionFixture({
      organization,
      plan: 'am3_business',
      supportsOnDemand: false,
      canSelfServe: false,
    });
    SubscriptionStore.set(organization.slug, newSubscription);
    render(
      <UsageOverview
        subscription={newSubscription}
        organization={organization}
        usageData={usageData}
      />
    );
    expect(screen.getAllByRole('columnheader')).toHaveLength(4);
    expect(
      screen.queryByRole('columnheader', {name: 'Reserved spend'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', {name: 'Pay-as-you-go spend'})
    ).not.toBeInTheDocument();
  });

  it('renders table based on subscription state', () => {
    subscription.onDemandPeriodStart = '2025-05-02';
    subscription.onDemandPeriodEnd = '2025-06-01';
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
    subscription.categories.replays = {
      ...subscription.categories.replays!,
      reserved: UNLIMITED_RESERVED,
      usage: 500_000,
    };

    render(
      <UsageOverview
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />
    );

    expect(screen.getByText('May 2 - Jun 1, 2025')).toBeInTheDocument();

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

    // Unlimited usage for Replays
    expect(screen.getAllByRole('cell', {name: UNLIMITED})).toHaveLength(2);
  });

  it('renders table based on add-on state', () => {
    organization.features.push('seer-user-billing');
    const subWithSeer = SubscriptionWithLegacySeerFixture({organization});
    SubscriptionStore.set(organization.slug, subWithSeer);
    render(
      <UsageOverview
        subscription={subWithSeer}
        organization={organization}
        usageData={usageData}
      />
    );
    // Org has Seer user flag but did not buy Seer add on, only legacy add-on
    expect(screen.getAllByRole('cell', {name: 'Seer'})).toHaveLength(1);
    expect(screen.getAllByRole('row', {name: 'Collapse Seer details'})).toHaveLength(1);
    expect(screen.getByRole('cell', {name: 'Issue Fixes'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'Issue Scans'})).toBeInTheDocument();

    // We test it this way to ensure we don't show the cell with the proper display name or the raw DataCategory
    expect(screen.queryByRole('cell', {name: /Seer*Users/})).not.toBeInTheDocument();
    expect(screen.queryByRole('cell', {name: /Prevent*Reviews/})).not.toBeInTheDocument();
  });

  it('renders add-on sub-categories if unlimited', () => {
    const sub = SubscriptionFixture({organization});
    sub.categories.seerAutofix = {
      ...sub.categories.seerAutofix!,
      reserved: UNLIMITED_RESERVED,
    };

    render(
      <UsageOverview
        subscription={sub}
        organization={organization}
        usageData={usageData}
      />
    );

    // issue fixes is unlimited
    expect(screen.getByRole('cell', {name: 'Issue Fixes'})).toBeInTheDocument();
    expect(screen.getAllByRole('cell', {name: UNLIMITED})).toHaveLength(2);
    // issue scans is 0
    expect(screen.getByRole('cell', {name: 'Issue Scans'})).toBeInTheDocument();
    expect(screen.getAllByRole('cell', {name: '0'}).length).toBeGreaterThan(0);

    // add-on is not rendered since at least one of its sub-categories is unlimited
    expect(screen.queryByRole('cell', {name: 'Seer'})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('row', {name: 'Expand Seer details'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('row', {name: 'Collapse Seer details'})
    ).not.toBeInTheDocument();

    expect(screen.getByRole('cell', {name: 'Issue Scans'})).toBeInTheDocument();
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
    const subWithSeer = SubscriptionWithLegacySeerFixture({organization});
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

  it('renders PAYG tags only if PAYG is supported', () => {
    const sub = SubscriptionFixture({
      plan: 'am3_f',
      organization,
      supportsOnDemand: true,
    });

    render(
      <UsageOverview
        subscription={sub}
        organization={organization}
        usageData={usageData}
      />
    );
    expect(
      screen.getAllByRole('cell', {name: 'Pay-as-you-go only'}).length
    ).toBeGreaterThan(0);
  });

  it('does not render PAYG tags if PAYG is not supported', () => {
    const sub = SubscriptionFixture({
      plan: 'am3_f',
      organization,
      supportsOnDemand: false,
    });

    render(
      <UsageOverview
        subscription={sub}
        organization={organization}
        usageData={usageData}
      />
    );
    expect(
      screen.queryByRole('cell', {name: 'Pay-as-you-go only'})
    ).not.toBeInTheDocument();
  });
});
