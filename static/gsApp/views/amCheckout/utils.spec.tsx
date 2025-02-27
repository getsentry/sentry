import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';

import {DataCategory} from 'sentry/types/core';

import {PlanTier} from 'getsentry/types';
import * as utils from 'getsentry/views/amCheckout/utils';

describe('utils', function () {
  const teamPlan = PlanDetailsLookupFixture('am1_team')!;
  const teamPlanAnnual = PlanDetailsLookupFixture('am1_team_auf')!;
  const bizPlan = PlanDetailsLookupFixture('am1_business')!;
  const bizPlanAnnual = PlanDetailsLookupFixture('am1_business_auf')!;

  describe('getReservedTotal', function () {
    it('can get base price for team plan', function () {
      const priceDollars = utils.getReservedTotal({
        plan: teamPlan,
        reserved: {
          errors: 50_000,
          transactions: 100_000,
          attachments: 1,
        },
      });
      expect(priceDollars).toBe('29');
    });

    it('can get base price for annual team plan', function () {
      const priceDollars = utils.getReservedTotal({
        plan: teamPlanAnnual,
        reserved: {
          errors: 50_000,
          transactions: 100_000,
          attachments: 1,
        },
      });
      expect(priceDollars).toBe('312');
    });

    it('can get base price for business plan', function () {
      const priceDollars = utils.getReservedTotal({
        plan: bizPlan,
        reserved: {
          errors: 50_000,
          transactions: 100_000,
          attachments: 1,
        },
      });
      expect(priceDollars).toBe('89');
    });

    it('can get base price for annual business plan', function () {
      const priceDollars = utils.getReservedTotal({
        plan: bizPlanAnnual,
        reserved: {
          errors: 50_000,
          transactions: 100_000,
          attachments: 1,
        },
      });
      expect(priceDollars).toBe('960');
    });

    it('adds comma to price', function () {
      const priceDollars = utils.getReservedTotal({
        plan: bizPlanAnnual,
        reserved: {
          errors: 200_000,
          transactions: 100_000,
          attachments: 1,
        },
      });
      expect(priceDollars).toBe('1,992');
    });
  });

  describe('discountPrice', function () {
    it('discounts price correctly', function () {
      expect(
        utils.getDiscountedPrice({
          basePrice: 1000,
          amount: 10 * 100,
          discountType: 'percentPoints',
          creditCategory: 'subscription',
        })
      ).toBe(900);
      expect(
        utils.getDiscountedPrice({
          basePrice: 8900,
          amount: 40 * 100,
          discountType: 'percentPoints',
          creditCategory: 'subscription',
        })
      ).toBe(5340);
      expect(
        utils.getDiscountedPrice({
          basePrice: 10000,
          amount: 1000,
          discountType: 'amountCents',
          creditCategory: 'subscription',
        })
      ).toBe(9000);
    });
  });

  describe('formatPrice', function () {
    it('formats price correctly', function () {
      expect(utils.formatPrice({cents: 0})).toBe('0');
      expect(utils.formatPrice({cents: 1500})).toBe('15');
      expect(utils.formatPrice({cents: 1510})).toBe('15.10');
      expect(utils.formatPrice({cents: 92400})).toBe('924');
      expect(utils.formatPrice({cents: 119400})).toBe('1,194');
      expect(utils.formatPrice({cents: -1510})).toBe('-15.10');
    });
  });

  describe('displayPrice', function () {
    it('formats price correctly', function () {
      expect(utils.displayPrice({cents: 0})).toBe('$0');
      expect(utils.displayPrice({cents: 1500})).toBe('$15');
      expect(utils.displayPrice({cents: 92430})).toBe('$924.30');
      expect(utils.displayPrice({cents: 119499})).toBe('$1,194.99');
      expect(utils.displayPrice({cents: -92430})).toBe('-$924.30');
    });
  });

  describe('displayPriceWithCents', function () {
    it('formats price correctly', function () {
      expect(utils.displayPriceWithCents({cents: 0})).toBe('$0.00');
      expect(utils.displayPriceWithCents({cents: 1500})).toBe('$15.00');
      expect(utils.displayPriceWithCents({cents: 92430})).toBe('$924.30');
      expect(utils.displayPriceWithCents({cents: 119499})).toBe('$1,194.99');
      expect(utils.displayPriceWithCents({cents: -92430})).toBe('-$924.30');
    });
  });

  describe('displayUnitPrice', function () {
    it('formats unit price correctly', function () {
      expect(utils.displayUnitPrice({cents: 24, minDigits: 2, maxDigits: 2})).toBe(
        '$0.24'
      );
      expect(utils.displayUnitPrice({cents: 24.5, minDigits: 2, maxDigits: 2})).toBe(
        '$0.25'
      );
      expect(utils.displayUnitPrice({cents: 245, minDigits: 2, maxDigits: 2})).toBe(
        '$2.45'
      );
      expect(utils.displayUnitPrice({cents: 0.0167})).toBe('$0.000167');
      expect(utils.displayUnitPrice({cents: 0.528})).toBe('$0.00528');
    });
  });

  describe('getEventsWithUnit', function () {
    it('returns correct event amount', function () {
      expect(utils.getEventsWithUnit(1_000, DataCategory.ERRORS)).toBe('1K');
      expect(utils.getEventsWithUnit(50_000, DataCategory.ERRORS)).toBe('50K');
      expect(utils.getEventsWithUnit(1_000_000, DataCategory.TRANSACTIONS)).toBe('1M');
      expect(utils.getEventsWithUnit(4_000_000, DataCategory.TRANSACTIONS)).toBe('4M');
      expect(utils.getEventsWithUnit(1, DataCategory.ATTACHMENTS)).toBe('1GB');
      expect(utils.getEventsWithUnit(25, DataCategory.ATTACHMENTS)).toBe('25GB');
      expect(utils.getEventsWithUnit(1_000, DataCategory.ATTACHMENTS)).toBe('1,000GB');
      expect(utils.getEventsWithUnit(4_000, DataCategory.ATTACHMENTS)).toBe('4,000GB');
      expect(utils.getEventsWithUnit(1_000_000_000, DataCategory.ERRORS)).toBe('1B');
      expect(utils.getEventsWithUnit(10_000_000_000, DataCategory.ERRORS)).toBe('10B');
    });
  });

  describe('utils.getBucket', function () {
    it('can get exact bucket by events', function () {
      const events = 100_000;
      const bucket = utils.getBucket({events, buckets: bizPlan.planCategories.errors});
      expect(bucket.events).toBe(events);
    });

    it('can get exact bucket by events with minimize strategy', function () {
      const events = 100_000;
      const bucket = utils.getBucket({
        events,
        buckets: bizPlan.planCategories.errors,
        shouldMinimize: true,
      });
      expect(bucket.events).toBe(events);
    });

    it('can get approximate bucket if event level does not exist', function () {
      const events = 90_000;
      const bucket = utils.getBucket({events, buckets: bizPlan.planCategories.errors});
      expect(bucket.events).toBeGreaterThanOrEqual(events);
    });

    it('can get approximate bucket if event level does not exist with minimize strategy', function () {
      const events = 90_000;
      const bucket = utils.getBucket({
        events,
        buckets: bizPlan.planCategories.errors,
        shouldMinimize: true,
      });
      expect(bucket.events).toBeLessThanOrEqual(events);
    });

    it('can get first bucket by events', function () {
      const events = 0;
      const bucket = utils.getBucket({
        events,
        buckets: teamPlan.planCategories.transactions,
      });
      expect(bucket.events).toBeGreaterThanOrEqual(events);
    });

    it('can get first bucket by events with minimize strategy', function () {
      const events = 0;
      const bucket = utils.getBucket({
        events,
        buckets: teamPlan.planCategories.transactions,
        shouldMinimize: true,
      });
      expect(bucket.events).toBeGreaterThanOrEqual(events);
    });

    it('can get last bucket by events', function () {
      const events = 1_000_000;
      const bucket = utils.getBucket({
        events,
        buckets: teamPlan.planCategories.attachments,
      });
      expect(bucket.events).toBeLessThanOrEqual(events);
    });

    it('can get last bucket by events with minimize strategy', function () {
      const events = 1_000_000;
      const bucket = utils.getBucket({
        events,
        buckets: teamPlan.planCategories.attachments,
        shouldMinimize: true,
      });
      expect(bucket.events).toBeLessThanOrEqual(events);
    });

    it('can get exact bucket by price', function () {
      const price = 48000;
      const bucket = utils.getBucket({
        price,
        buckets: bizPlan.planCategories.transactions,
      });
      expect(bucket.price).toBe(price);
      expect(bucket.events).toBe(3_500_000);
    });

    it('can get exact bucket by price with minimize strategy', function () {
      const price = 48000;
      const bucket = utils.getBucket({
        price,
        buckets: bizPlan.planCategories.transactions,
        shouldMinimize: true,
      });
      expect(bucket.price).toBe(price);
      expect(bucket.events).toBe(3_500_000);
    });

    it('can get approximate bucket if price level does not exist', function () {
      const price = 60000;
      const bucket = utils.getBucket({
        price,
        buckets: bizPlan.planCategories.transactions,
      });
      expect(bucket.price).toBeGreaterThanOrEqual(price);
      expect(bucket.events).toBe(4_500_000);
    });

    it('can get approximate bucket if price level does not exist with minimize strategy', function () {
      const price = 60000;
      const bucket = utils.getBucket({
        price,
        buckets: bizPlan.planCategories.transactions,
        shouldMinimize: true,
      });
      expect(bucket.price).toBeLessThanOrEqual(price);
      expect(bucket.events).toBe(4_000_000);
    });

    it('can get first bucket by price', function () {
      const price = 0;
      const bucket = utils.getBucket({
        price,
        buckets: teamPlan.planCategories.transactions,
      });
      expect(bucket.price).toBe(price);
    });

    it('can get first bucket by price with minimize strategy', function () {
      const price = 0;
      const bucket = utils.getBucket({
        price,
        buckets: teamPlan.planCategories.transactions,
        shouldMinimize: true,
      });
      expect(bucket.price).toBe(price);
    });

    it('can get last bucket by price', function () {
      const price = 263500;
      const bucket = utils.getBucket({
        price,
        buckets: teamPlan.planCategories.transactions,
      });
      expect(bucket.price).toBeLessThanOrEqual(price);
    });

    it('can get last bucket by price with minimize strategy', function () {
      const price = 263500;
      const bucket = utils.getBucket({
        price,
        buckets: teamPlan.planCategories.transactions,
        shouldMinimize: true,
      });
      expect(bucket.price).toBeLessThanOrEqual(price);
    });
  });

  describe('utils.getToggleTier', function () {
    it('gets the correct toggle tier given a checkout tier', function () {
      expect(utils.getToggleTier(undefined)).toBeNull();
      expect(utils.getToggleTier(PlanTier.AM3)).toBeNull();
      expect(utils.getToggleTier(PlanTier.AM2)).toBe(PlanTier.AM1);
      expect(utils.getToggleTier(PlanTier.AM1)).toBe(PlanTier.AM2);
    });
  });
});
