import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {CustomerUsageFixture} from 'getsentry-test/fixtures/customerUsage';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import {DataCategory} from 'sentry/types/core';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {OnDemandBudgetMode, type Subscription} from 'getsentry/types';
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
