import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  SubscriptionFixture,
  SubscriptionWithLegacySeerFixture,
} from 'getsentry-test/fixtures/subscription';

import {DataCategory} from 'sentry/types/core';

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
    subscription.planDetails.categories = [DataCategory.ERRORS];
    subscription.categories.errors!.onDemandSpendUsed = 0;
    subscription.planDetails.planCategories.errors = [
      {events: 100_000, price: 10000, unitPrice: 0.1, onDemandPrice: 0.2},
    ];
    subscription.categories.errors!.reserved = 100_000;
    subscription.categories.errors!.usage = 50_000;

    expect(calculateTotalSpend(subscription)).toEqual({
      prepaidTotalSpent: 5000,
      prepaidReservedBudgetPrice: 0,
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
    subscription.planDetails.categories = [DataCategory.ERRORS];
    subscription.categories.errors!.onDemandSpendUsed = 10_000;
    subscription.planDetails.planCategories.errors = [
      {events: 100_000, price: 10000, unitPrice: 0.1, onDemandPrice: 0.2},
    ];
    subscription.categories.errors!.reserved = 100_000;
    // Usage exceeds reserved
    subscription.categories.errors!.usage = 150_000;

    expect(calculateTotalSpend(subscription)).toEqual({
      prepaidTotalSpent: 10_000,
      prepaidReservedBudgetPrice: 0,
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
    subscription.planDetails.categories = [DataCategory.ERRORS];
    subscription.planDetails.billingInterval = 'annual';
    const monthlyPrice = 10000;
    subscription.planDetails.planCategories.errors = [
      {events: 100_000, price: monthlyPrice * 12, unitPrice: 0.1, onDemandPrice: 0.2},
    ];
    expect(calculateTotalSpend(subscription)).toEqual({
      prepaidTotalSpent: 0,
      prepaidReservedBudgetPrice: 0,
      prepaidTotalPrice: monthlyPrice,
      onDemandTotalSpent: 0,
    });
  });

  it('should return 0 for prepaidTotalSpent when eventsByPrice is 0', () => {
    const subscription = SubscriptionFixture({
      organization,
      planTier: 'am2',
      plan: 'am2_f',
    });
    subscription.planDetails.categories = [DataCategory.PROFILE_DURATION_UI];
    subscription.planDetails.planCategories.profileDuration = [
      {events: 0, price: 0, unitPrice: 0.1, onDemandPrice: 0.2},
    ];

    subscription.categories.profileDuration!.reserved = 100;
    subscription.categories.profileDuration!.usage = 50;
    subscription.categories.profileDuration!.free = 0;

    const result = calculateTotalSpend(subscription);
    expect(result.prepaidTotalSpent).toBe(0);
  });

  it('should calculate reserved budget spend', () => {
    const seerSubscription = SubscriptionWithLegacySeerFixture({
      organization,
      plan: 'am3_business',
    });
    const errorsPrice = 10000;
    seerSubscription.planDetails.planCategories.errors = [
      {events: 100_000, price: errorsPrice, unitPrice: 0.1, onDemandPrice: 0.2},
    ];
    seerSubscription.categories.errors!.reserved = 100_000;

    expect(calculateTotalSpend(seerSubscription)).toEqual({
      prepaidTotalSpent: 2000,
      prepaidReservedBudgetPrice: 2000,
      prepaidTotalPrice: 2000 + errorsPrice,
      onDemandTotalSpent: 0,
    });
  });
});
