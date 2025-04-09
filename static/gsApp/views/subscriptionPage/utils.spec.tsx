import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';

import {calculateCategorySpend, calculateTotalSpend} from './utils';

describe('calculateTotalSpend', () => {
  const organization = OrganizationFixture({features: ['ondemand-budgets']});

  it('should calculate reserved usage based on total price', () => {
    const subscription = SubscriptionFixture({
      organization,
      planTier: 'am2',
      plan: 'am2_f',
      onDemandSpendUsed: 0,
    });
    subscription.planDetails.categories = ['errors'];
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
    subscription.planDetails.categories = ['errors'];
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
    subscription.planDetails.categories = ['errors'];
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

describe('calculateCategorySpend', () => {
  const organization = OrganizationFixture({features: ['ondemand-budgets']});

  it('should handle non-existent data category gracefully', () => {
    const subscription = SubscriptionFixture({
      organization,
      // Use am2 plan which has known configuration in tests
      planTier: 'am2',
      plan: 'am2_f',
    });

    // Use a category that doesn't exist in the plan
    const nonExistentCategory = 'nonExistentCategory';

    // Call calculateCategorySpend with a non-existent category
    const result = calculateCategorySpend(subscription, nonExistentCategory);

    // Expect default values to be returned
    expect(result).toEqual({
      prepaidSpent: 0,
      onDemandSpent: 0,
      unitPrice: 0,
      onDemandUnitPrice: 0,
      prepaidPrice: 0,
    });
  });

  it('should handle missing reserved value in categoryInfo', () => {
    // Use am2 plan which has more stable test fixtures
    const subscription = SubscriptionFixture({
      organization,
      planTier: 'am2',
      plan: 'am2_f',
    });

    // Ensure the errors category exists
    subscription.planDetails.categories = ['errors'];

    // Set up the errors category without a reserved value
    if (subscription.categories.errors) {
      const originalReserved = subscription.categories.errors.reserved;
      subscription.categories.errors.reserved = null;

      // Call calculateCategorySpend
      const result = calculateCategorySpend(subscription, 'errors');

      // Restore the original value
      subscription.categories.errors.reserved = originalReserved;

      // Expect default values to be returned
      expect(result).toEqual({
        prepaidSpent: 0,
        onDemandSpent: 0,
        unitPrice: 0,
        onDemandUnitPrice: 0,
        prepaidPrice: 0,
      });
    }
  });

  it('should handle mm1 plan with invalid category', () => {
    // Create a subscription with mm1 plan
    const subscription = SubscriptionFixture({
      organization,
      planTier: 'mm1',
      plan: 's1',
    });

    // Ensure categories array exists with at least errors
    if (!subscription.planDetails.categories) {
      subscription.planDetails.categories = ['errors'];
    }

    // Make sure errors planCategory exists for this test
    if (!subscription.planDetails.planCategories.errors) {
      subscription.planDetails.planCategories.errors = [
        {events: 50000, price: 0, unitPrice: 0, onDemandPrice: 0},
      ];
    }

    // Test with a category that doesn't exist in mm1 plan
    const nonExistentCategory = 'profileDurationUI'; // category not in mm1

    const result = calculateCategorySpend(subscription, nonExistentCategory);

    // Expect default values to be returned
    expect(result).toEqual({
      prepaidSpent: 0,
      onDemandSpent: 0,
      unitPrice: 0,
      onDemandUnitPrice: 0,
      prepaidPrice: 0,
    });
  });
});
