import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';

import {calculateTotalSpend} from './utils';

describe('calculateTotalSpend', () => {
  const organization = OrganizationFixture({features: ['ondemand-budgets']});

  it('should calculate reserved usage based on total price', () => {
    const subscription = SubscriptionFixture({
      organization,
      planTier: 'am2',
      plan: 'am2_f',
      onDemandSpendUsed: 0,
    });
    subscription.categories.errors!.onDemandSpendUsed = 0;
    subscription.planDetails.planCategories.errors = [
      {events: 100_000, price: 10000, unitPrice: 0.1, onDemandPrice: 0.2},
    ];
    subscription.categories.errors!.reserved = 100_000;
    subscription.categories.errors!.usage = 50_000;

    expect(calculateTotalSpend(subscription)).toEqual({
      prepaidTotalSpent: 5000,
      prepaidTotalPrice: 10000,
      onDemandTotalSpent: 0,
    });
  });

  it('should calculate on demand usage', () => {
    const subscription = SubscriptionFixture({
      organization,
      planTier: 'am2',
      plan: 'am2_f',
    });
    subscription.categories.errors!.onDemandSpendUsed = 10_000;
    subscription.planDetails.planCategories.errors = [
      {events: 100_000, price: 10000, unitPrice: 0.1, onDemandPrice: 0.2},
    ];
    subscription.categories.errors!.reserved = 100_000;
    // Usage exceeds reserved
    subscription.categories.errors!.usage = 150_000;

    expect(calculateTotalSpend(subscription)).toEqual({
      prepaidTotalSpent: 10_000,
      prepaidTotalPrice: 10_000,
      // Directly from onDemandSpendUsed
      onDemandTotalSpent: 10_000,
    });
  });

  it('should convert annual prepaid price to monthly', () => {
    const subscription = SubscriptionFixture({
      organization,
      planTier: 'am2',
      plan: 'am2_f',
    });
    subscription.planDetails.billingInterval = 'annual';
    const monthlyPrice = 10000;
    subscription.planDetails.planCategories.errors = [
      {events: 100_000, price: monthlyPrice * 12, unitPrice: 0.1, onDemandPrice: 0.2},
    ];
    expect(calculateTotalSpend(subscription)).toEqual({
      prepaidTotalSpent: 0,
      prepaidTotalPrice: monthlyPrice,
      onDemandTotalSpent: 0,
    });
  });
});
