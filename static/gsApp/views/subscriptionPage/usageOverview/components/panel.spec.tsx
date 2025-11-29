import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {CustomerUsageFixture} from 'getsentry-test/fixtures/customerUsage';
import {
  SubscriptionFixture,
  SubscriptionWithLegacySeerFixture,
} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import {DataCategory} from 'sentry/types/core';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {AddOnCategory, OnDemandBudgetMode, type Subscription} from 'getsentry/types';
import ProductBreakdownPanel from 'getsentry/views/subscriptionPage/usageOverview/components/panel';

describe('ProductBreakdownPanel', () => {
  const organization = OrganizationFixture();
  let subscription: Subscription;
  const usageData = CustomerUsageFixture();

  beforeEach(() => {
    setMockDate(new Date('2021-05-07'));
    organization.features = ['subscriptions-v3', 'seer-billing'];
    organization.access = ['org:billing'];
    subscription = SubscriptionFixture({organization, plan: 'am3_business'});
    SubscriptionStore.set(organization.slug, subscription);
  });

  afterEach(() => {
    resetMockDate();
  });

  it('renders for data category with shared PAYG set', async () => {
    subscription.categories.errors = {
      ...subscription.categories.errors!,
      reserved: 500_000,
      prepaid: 505_000,
      free: 5_000,
      onDemandSpendUsed: 10_00,
    };
    subscription.onDemandBudgets = {
      enabled: true,
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 100_00,
      onDemandSpendUsed: 0,
    };
    render(
      <ProductBreakdownPanel
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={DataCategory.ERRORS}
      />
    );

    await screen.findByRole('heading', {name: 'Errors'});
    expect(screen.getByText('Included volume')).toBeInTheDocument();
    expect(screen.getByText('Business plan')).toBeInTheDocument();
    expect(screen.getByText('50,000')).toBeInTheDocument();
    expect(screen.getByText('Additional reserved')).toBeInTheDocument();
    expect(screen.getByText('450,000')).toBeInTheDocument();
    expect(screen.getByText('Gifted')).toBeInTheDocument();
    expect(screen.getByText('5,000')).toBeInTheDocument();
    expect(screen.getByText('Additional spend')).toBeInTheDocument();
    expect(screen.getByText('Pay-as-you-go')).toBeInTheDocument();
    expect(screen.getByText('$10.00')).toBeInTheDocument();
    expect(screen.getByText('Reserved spend')).toBeInTheDocument();
    expect(screen.getByText('$245.00')).toBeInTheDocument();
  });

  it('renders for data category with per-category PAYG set', async () => {
    subscription.categories.errors = {
      ...subscription.categories.errors!,
      reserved: 500_000,
      prepaid: 505_000,
      free: 5_000,
      onDemandSpendUsed: 10_00,
      onDemandBudget: 100_00,
    };
    subscription.onDemandBudgets = {
      enabled: true,
      budgetMode: OnDemandBudgetMode.PER_CATEGORY,
      budgets: {
        errors: 100_00,
      },
      usedSpends: {
        errors: 10_00,
      },
    };
    render(
      <ProductBreakdownPanel
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={DataCategory.ERRORS}
      />
    );

    await screen.findByRole('heading', {name: 'Errors'});
    expect(screen.getByText('Included volume')).toBeInTheDocument();
    expect(screen.getByText('Business plan')).toBeInTheDocument();
    expect(screen.getByText('50,000')).toBeInTheDocument();
    expect(screen.getByText('Additional reserved')).toBeInTheDocument();
    expect(screen.getByText('450,000')).toBeInTheDocument();
    expect(screen.getByText('Gifted')).toBeInTheDocument();
    expect(screen.getByText('5,000')).toBeInTheDocument();
    expect(screen.getByText('Additional spend')).toBeInTheDocument();
    expect(screen.getByText('Pay-as-you-go')).toBeInTheDocument();
    expect(screen.getByText('$10.00 /')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument(); // shows per-category individual budget
    expect(screen.getByText('Reserved spend')).toBeInTheDocument();
    expect(screen.getByText('$245.00')).toBeInTheDocument();
  });

  it('renders for reserved budget add-on', async () => {
    const legacySeerSubscription = SubscriptionWithLegacySeerFixture({
      organization,
      plan: 'am3_business',
    });
    legacySeerSubscription.reservedBudgets![0] = {
      ...legacySeerSubscription.reservedBudgets![0]!,
      freeBudget: 1_00,
    };
    legacySeerSubscription.categories.seerAutofix = {
      ...legacySeerSubscription.categories.seerAutofix!,
      onDemandSpendUsed: 1_00,
    };
    legacySeerSubscription.categories.seerScanner = {
      ...legacySeerSubscription.categories.seerScanner!,
      onDemandSpendUsed: 1_00,
    };
    SubscriptionStore.set(organization.slug, legacySeerSubscription);
    render(
      <ProductBreakdownPanel
        subscription={legacySeerSubscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={AddOnCategory.LEGACY_SEER}
      />
    );

    await screen.findByRole('heading', {name: 'Seer'});
    expect(screen.getByText('Included volume')).toBeInTheDocument();
    expect(screen.queryByText('Business plan')).not.toBeInTheDocument();
    expect(screen.queryByText('Additional reserved')).not.toBeInTheDocument();
    expect(screen.getByText('Seer monthly credits')).toBeInTheDocument();
    expect(screen.getByText('$25.00')).toBeInTheDocument();
    expect(screen.getByText('Gifted')).toBeInTheDocument();
    expect(screen.getByText('$1.00')).toBeInTheDocument();
    expect(screen.getByText('Additional spend')).toBeInTheDocument();
    expect(screen.getByText('Pay-as-you-go')).toBeInTheDocument();
    expect(screen.getByText('$2.00')).toBeInTheDocument();
    expect(screen.getByText('Reserved spend')).toBeInTheDocument();
    expect(screen.getByText('$20.00')).toBeInTheDocument();
  });

  it('renders for reserved budget add-on data category', async () => {
    const legacySeerSubscription = SubscriptionWithLegacySeerFixture({
      organization,
      plan: 'am3_business',
    });
    legacySeerSubscription.reservedBudgets![0] = {
      ...legacySeerSubscription.reservedBudgets![0]!,
      freeBudget: 1_00,
    };
    legacySeerSubscription.categories.seerAutofix = {
      ...legacySeerSubscription.categories.seerAutofix!,
      onDemandSpendUsed: 1_00,
    };
    legacySeerSubscription.categories.seerScanner = {
      ...legacySeerSubscription.categories.seerScanner!,
      onDemandSpendUsed: 1_00,
    };
    SubscriptionStore.set(organization.slug, legacySeerSubscription);
    render(
      <ProductBreakdownPanel
        subscription={legacySeerSubscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={DataCategory.SEER_AUTOFIX}
      />
    );

    await screen.findByRole('heading', {name: 'Issue Fixes'});
    expect(screen.queryByText('Included volume')).not.toBeInTheDocument();
    expect(screen.queryByText('Business plan')).not.toBeInTheDocument();
    expect(screen.queryByText('Additional reserved')).not.toBeInTheDocument();
    expect(screen.queryByText('Seer monthly credits')).not.toBeInTheDocument();
    expect(screen.queryByText('Gifted')).not.toBeInTheDocument();
    expect(screen.getByText('Additional spend')).toBeInTheDocument();
    expect(screen.getByText('Pay-as-you-go')).toBeInTheDocument();
    expect(screen.getByText('$1.00')).toBeInTheDocument();
    expect(screen.queryByText('Reserved spend')).not.toBeInTheDocument();
  });

  it('renders product trial CTA', async () => {
    subscription.productTrials = [
      {
        category: DataCategory.PROFILE_DURATION,
        isStarted: false,
        reasonCode: 1001,
        startDate: undefined,
        endDate: moment().utc().add(20, 'years').format(),
      },
    ];
    SubscriptionStore.set(organization.slug, subscription);
    render(
      <ProductBreakdownPanel
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={DataCategory.PROFILE_DURATION}
      />
    );

    await screen.findByRole('heading', {name: 'Continuous Profile Hours'});
    expect(screen.getByRole('button', {name: 'Activate free trial'})).toBeInTheDocument();
  });

  it('renders upgrade CTA', async () => {
    render(
      <ProductBreakdownPanel
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={DataCategory.PROFILE_DURATION}
      />
    );

    await screen.findByRole('heading', {name: 'Continuous Profile Hours'});
    expect(screen.getByRole('button', {name: 'Upgrade now'})).toBeInTheDocument();
  });

  it('renders active product trial status', async () => {
    subscription.productTrials = [
      {
        category: DataCategory.REPLAYS,
        isStarted: true,
        reasonCode: 1001,
        startDate: moment().utc().subtract(10, 'days').format(),
        endDate: moment().utc().add(20, 'days').format(),
      },
    ];
    SubscriptionStore.set(organization.slug, subscription);
    render(
      <ProductBreakdownPanel
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={DataCategory.REPLAYS}
      />
    );

    await screen.findByRole('heading', {name: 'Replays'});
    expect(screen.getByText('Trial - 20 days left')).toBeInTheDocument();
  });

  it('renders usage exceeded status without PAYG set', async () => {
    subscription.categories.errors = {
      ...subscription.categories.errors!,
      usageExceeded: true,
    };
    SubscriptionStore.set(organization.slug, subscription);
    render(
      <ProductBreakdownPanel
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={DataCategory.ERRORS}
      />
    );

    await screen.findByRole('heading', {name: 'Errors'});
    expect(screen.getByText('Usage exceeded')).toBeInTheDocument();
  });

  it('renders usage exceeded status with PAYG set', async () => {
    subscription.onDemandBudgets = {
      enabled: true,
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 100_00,
      onDemandSpendUsed: 100_00,
    };
    subscription.categories.errors = {
      ...subscription.categories.errors!,
      usageExceeded: true,
    };
    SubscriptionStore.set(organization.slug, subscription);
    render(
      <ProductBreakdownPanel
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={DataCategory.ERRORS}
      />
    );

    await screen.findByRole('heading', {name: 'Errors'});
    expect(screen.getByText('Pay-as-you-go limit reached')).toBeInTheDocument();
  });
});
