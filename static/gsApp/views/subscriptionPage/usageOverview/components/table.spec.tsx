import {OrganizationFixture} from 'sentry-fixture/organization';

import {CustomerUsageFixture} from 'getsentry-test/fixtures/customerUsage';
import {
  SubscriptionFixture,
  SubscriptionWithLegacySeerFixture,
} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';

import {GIGABYTE, UNLIMITED_RESERVED} from 'getsentry/constants';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import UsageOverviewTable from 'getsentry/views/subscriptionPage/usageOverview/components/table';

describe('UsageOverviewTable', () => {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization, plan: 'am3_business'});
  const usageData = CustomerUsageFixture();

  beforeEach(() => {
    organization.features = ['subscriptions-v3', 'seer-billing'];
    organization.access = ['org:billing'];
    SubscriptionStore.set(organization.slug, subscription);
  });

  it('renders columns and buttons for billing users', async () => {
    render(
      <UsageOverviewTable
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        onRowClick={jest.fn()}
        selectedProduct={DataCategory.ERRORS}
      />
    );

    await screen.findByRole('columnheader', {name: 'Feature'});
    expect(screen.getAllByRole('columnheader')).toHaveLength(3);
    expect(screen.getByRole('columnheader', {name: 'Usage'})).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Additional spend'})
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', {name: /^View .+ usage$/i}).length
    ).toBeGreaterThan(0);
  });

  it('renders columns for non-billing users', async () => {
    organization.access = [];
    render(
      <UsageOverviewTable
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        onRowClick={jest.fn()}
        selectedProduct={DataCategory.ERRORS}
      />
    );

    await screen.findByRole('columnheader', {name: 'Feature'});
    expect(screen.getAllByRole('columnheader')).toHaveLength(3);
    expect(screen.getByRole('columnheader', {name: 'Usage'})).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Additional spend'})
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', {name: /^View .+ usage$/i}).length
    ).toBeGreaterThan(0);
  });

  it('renders columns for non-self-serve with PAYG support', async () => {
    const newSubscription = SubscriptionFixture({
      organization,
      plan: 'am3_business',
      supportsOnDemand: true,
      canSelfServe: false,
    });
    SubscriptionStore.set(organization.slug, newSubscription);
    render(
      <UsageOverviewTable
        subscription={newSubscription}
        organization={organization}
        usageData={usageData}
        onRowClick={jest.fn()}
        selectedProduct={DataCategory.ERRORS}
      />
    );

    await screen.findByRole('columnheader', {name: 'Feature'});
    expect(screen.getAllByRole('columnheader')).toHaveLength(3);
    expect(screen.getByRole('columnheader', {name: 'Usage'})).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Additional spend'})
    ).toBeInTheDocument();
  });

  it('does not render spend columns for non-self-serve without PAYG support', async () => {
    const newSubscription = SubscriptionFixture({
      organization,
      plan: 'am3_business',
      supportsOnDemand: false,
      canSelfServe: false,
    });
    SubscriptionStore.set(organization.slug, newSubscription);
    render(
      <UsageOverviewTable
        subscription={newSubscription}
        organization={organization}
        usageData={usageData}
        onRowClick={jest.fn()}
        selectedProduct={DataCategory.ERRORS}
      />
    );

    await screen.findByRole('columnheader', {name: 'Feature'});
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
    expect(screen.getByRole('columnheader', {name: 'Usage'})).toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', {name: 'Additional spend'})
    ).not.toBeInTheDocument();
  });

  it('renders table and panel based on subscription state', async () => {
    subscription.onDemandMaxSpend = 100_00;

    subscription.categories.errors = {
      ...subscription.categories.errors!,
      free: 1000,
      usage: 6000,
      onDemandSpendUsed: 10_00,
      prepaid: 51_000,
    };
    subscription.categories.attachments = {
      ...subscription.categories.attachments!,
      prepaid: 25, // 25 GB
      reserved: 25,
      free: 0,
      usage: GIGABYTE / 2,
    };
    subscription.categories.spans = {
      ...subscription.categories.spans!,
      prepaid: 20_000_000,
      reserved: 20_000_000,
    };
    subscription.categories.replays = {
      ...subscription.categories.replays!,
      prepaid: UNLIMITED_RESERVED,
      usage: 500_000,
    };
    SubscriptionStore.set(organization.slug, subscription);

    render(
      <UsageOverviewTable
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        onRowClick={jest.fn()}
        selectedProduct={DataCategory.ERRORS}
      />
    );

    await screen.findByRole('columnheader', {name: 'Feature'});

    // Errors usage and gifted units
    expect(screen.getByRole('cell', {name: '6K / 51K (1K gifted)'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '$10.00'})).toBeInTheDocument();

    // Attachments usage should be in the correct unit + above platform volume
    expect(screen.getByRole('cell', {name: '500 MB / 25 GB'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '$6.00'})).toBeInTheDocument();

    // Reserved spans above platform volume
    expect(screen.getByRole('cell', {name: '0 / 20M'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '$32.00'})).toBeInTheDocument();

    // Unlimited usage for Replays
    expect(screen.getByRole('cell', {name: 'Unlimited'})).toBeInTheDocument();
  });

  it('renders table based on add-on state', async () => {
    organization.features.push('seer-user-billing');
    const subWithSeer = SubscriptionWithLegacySeerFixture({organization});
    SubscriptionStore.set(organization.slug, subWithSeer);
    render(
      <UsageOverviewTable
        subscription={subWithSeer}
        organization={organization}
        usageData={usageData}
        onRowClick={jest.fn()}
        selectedProduct={DataCategory.ERRORS}
      />
    );

    await screen.findByRole('columnheader', {name: 'Feature'});

    // Org has Seer user flag but did not buy Seer add on, only legacy add-on
    expect(screen.getAllByRole('cell', {name: 'Seer'})).toHaveLength(1);
    expect(screen.getByRole('cell', {name: 'Issue Fixes'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'Issue Scans'})).toBeInTheDocument();

    // We test it this way to ensure we don't show the cell with the proper display name or the raw DataCategory
    expect(screen.queryByRole('cell', {name: /Seer*Users/})).not.toBeInTheDocument();
    expect(screen.queryByRole('cell', {name: /Prevent*Reviews/})).not.toBeInTheDocument();
  });

  it('renders add-on sub-categories if unlimited', async () => {
    const sub = SubscriptionFixture({organization});
    sub.categories.seerAutofix = {
      ...sub.categories.seerAutofix!,
      reserved: UNLIMITED_RESERVED,
      prepaid: UNLIMITED_RESERVED,
    };

    render(
      <UsageOverviewTable
        subscription={sub}
        organization={organization}
        usageData={usageData}
        onRowClick={jest.fn()}
        selectedProduct={DataCategory.ERRORS}
      />
    );

    await screen.findByRole('columnheader', {name: 'Feature'});

    // issue fixes is unlimited
    expect(screen.getByRole('cell', {name: 'Issue Fixes'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'Unlimited'})).toBeInTheDocument();

    // issue scans is 0 so is not rendered
    expect(screen.queryByRole('cell', {name: 'Issue Scans'})).not.toBeInTheDocument();

    // add-on is not rendered since at least one of its sub-categories is unlimited
    expect(screen.queryByRole('cell', {name: 'Seer'})).not.toBeInTheDocument();
  });
});
