import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';

import {DataCategory} from 'sentry/types/core';

import {
  BILLION,
  GIGABYTE,
  MILLION,
  RESERVED_BUDGET_QUOTA,
  UNLIMITED,
  UNLIMITED_RESERVED,
} from 'getsentry/constants';
import {AddOnCategory, OnDemandBudgetMode} from 'getsentry/types';
import type {ProductTrial, Subscription} from 'getsentry/types';
import {
  checkIsAddOn,
  checkIsAddOnChildCategory,
  convertUsageToReservedUnit,
  formatReservedWithUnits,
  formatUsageWithUnits,
  getActiveProductTrial,
  getBestActionToIncreaseEventLimits,
  getBilledCategory,
  getCreditApplied,
  getOnDemandCategories,
  getProductTrial,
  getSeerTrialCategory,
  getSlot,
  hasPerformance,
  isBizPlanFamily,
  isDeveloperPlan,
  isEnterprise,
  isNewPayingCustomer,
  isTeamPlanFamily,
  MILLISECONDS_IN_HOUR,
  productIsEnabled,
  trialPromptIsDismissed,
  UsageAction,
} from 'getsentry/utils/billing';

describe('formatReservedWithUnits', () => {
  it('returns correct string for Errors', () => {
    expect(formatReservedWithUnits(null, DataCategory.ERRORS)).toBe('0');
    expect(formatReservedWithUnits(0, DataCategory.ERRORS)).toBe('0');
    expect(formatReservedWithUnits(-1, DataCategory.ERRORS)).toBe(UNLIMITED);
    expect(formatReservedWithUnits(1, DataCategory.ERRORS)).toBe('1');
    expect(formatReservedWithUnits(1000, DataCategory.ERRORS)).toBe('1,000');
    expect(formatReservedWithUnits(MILLION, DataCategory.ERRORS)).toBe('1,000,000');
    expect(formatReservedWithUnits(BILLION, DataCategory.ERRORS)).toBe('1,000,000,000');

    expect(
      formatReservedWithUnits(1234, DataCategory.ERRORS, {
        isAbbreviated: true,
      })
    ).toBe('1K');
    expect(
      formatReservedWithUnits(MILLION, DataCategory.ERRORS, {
        isAbbreviated: true,
      })
    ).toBe('1M');
    expect(
      formatReservedWithUnits(1.234 * MILLION, DataCategory.ERRORS, {
        isAbbreviated: true,
      })
    ).toBe('1.2M');
    expect(
      formatReservedWithUnits(BILLION, DataCategory.ERRORS, {
        isAbbreviated: true,
      })
    ).toBe('1B');
    expect(
      formatReservedWithUnits(1.234 * BILLION, DataCategory.ERRORS, {
        isAbbreviated: true,
      })
    ).toBe('1.23B');
  });

  it('returns correct string for Transactions', () => {
    expect(formatReservedWithUnits(null, DataCategory.TRANSACTIONS)).toBe('0');
    expect(formatReservedWithUnits(0, DataCategory.TRANSACTIONS)).toBe('0');
    expect(formatReservedWithUnits(-1, DataCategory.TRANSACTIONS)).toBe(UNLIMITED);
    expect(formatReservedWithUnits(1, DataCategory.TRANSACTIONS)).toBe('1');
    expect(formatReservedWithUnits(1000, DataCategory.TRANSACTIONS)).toBe('1,000');
    expect(formatReservedWithUnits(MILLION, DataCategory.TRANSACTIONS)).toBe('1,000,000');
    expect(formatReservedWithUnits(BILLION, DataCategory.TRANSACTIONS)).toBe(
      '1,000,000,000'
    );

    expect(
      formatReservedWithUnits(1234, DataCategory.TRANSACTIONS, {
        isAbbreviated: true,
      })
    ).toBe('1K');
    expect(
      formatReservedWithUnits(MILLION, DataCategory.TRANSACTIONS, {
        isAbbreviated: true,
      })
    ).toBe('1M');
    expect(
      formatReservedWithUnits(1.234 * MILLION, DataCategory.TRANSACTIONS, {
        isAbbreviated: true,
      })
    ).toBe('1.2M');
    expect(
      formatReservedWithUnits(BILLION, DataCategory.TRANSACTIONS, {
        isAbbreviated: true,
      })
    ).toBe('1B');
    expect(
      formatReservedWithUnits(1.234 * BILLION, DataCategory.TRANSACTIONS, {
        isAbbreviated: true,
      })
    ).toBe('1.23B');
  });

  it('returns correct string for Attachments', () => {
    expect(formatReservedWithUnits(null, DataCategory.ATTACHMENTS)).toBe('0 GB');
    expect(formatReservedWithUnits(0, DataCategory.ATTACHMENTS)).toBe('0 GB');
    expect(formatReservedWithUnits(0.1, DataCategory.ATTACHMENTS)).toBe('0.1 GB');
    expect(formatReservedWithUnits(1, DataCategory.ATTACHMENTS)).toBe('1 GB');
    expect(formatReservedWithUnits(1000, DataCategory.ATTACHMENTS)).toBe('1,000 GB');
    expect(formatReservedWithUnits(MILLION, DataCategory.ATTACHMENTS)).toBe(
      '1,000,000 GB'
    );
    expect(formatReservedWithUnits(BILLION, DataCategory.ATTACHMENTS)).toBe(
      '1,000,000,000 GB'
    );

    expect(
      formatReservedWithUnits(0.1234, DataCategory.ATTACHMENTS, {
        isAbbreviated: true,
      })
    ).toBe('0 GB');
    expect(
      formatReservedWithUnits(1.234, DataCategory.ATTACHMENTS, {
        isAbbreviated: true,
      })
    ).toBe('1 GB');
    expect(
      formatReservedWithUnits(1234, DataCategory.ATTACHMENTS, {
        isAbbreviated: true,
      })
    ).toBe('1K GB');
    expect(
      formatReservedWithUnits(MILLION, DataCategory.ATTACHMENTS, {
        isAbbreviated: true,
      })
    ).toBe('1M GB');
    expect(
      formatReservedWithUnits(1.234 * MILLION, DataCategory.ATTACHMENTS, {
        isAbbreviated: true,
      })
    ).toBe('1.2M GB');
    expect(
      formatReservedWithUnits(BILLION, DataCategory.ATTACHMENTS, {
        isAbbreviated: true,
      })
    ).toBe('1B GB');
    expect(
      formatReservedWithUnits(1.234 * BILLION, DataCategory.ATTACHMENTS, {
        isAbbreviated: true,
      })
    ).toBe('1.23B GB');

    expect(
      formatReservedWithUnits(0.1, DataCategory.ATTACHMENTS, {
        useUnitScaling: true,
      })
    ).toBe('0.1 GB');
    expect(
      formatReservedWithUnits(1, DataCategory.ATTACHMENTS, {
        useUnitScaling: true,
      })
    ).toBe('1 GB');
    expect(
      formatReservedWithUnits(1000, DataCategory.ATTACHMENTS, {
        useUnitScaling: true,
      })
    ).toBe('1 TB');
    expect(
      formatReservedWithUnits(1234, DataCategory.ATTACHMENTS, {
        useUnitScaling: true,
      })
    ).toBe('1.23 TB');
    expect(
      formatReservedWithUnits(1234 * BILLION, DataCategory.ATTACHMENTS, {
        useUnitScaling: true,
      })
    ).toBe('1.23 ZB');
    expect(
      formatReservedWithUnits(-1 / GIGABYTE, DataCategory.ATTACHMENTS, {
        useUnitScaling: true,
      })
    ).toBe(UNLIMITED);
    expect(
      formatReservedWithUnits(-1, DataCategory.ATTACHMENTS, {
        useUnitScaling: true,
      })
    ).toBe(UNLIMITED);
  });

  it('returns correct string for Profile Duration', () => {
    expect(formatReservedWithUnits(1000, DataCategory.PROFILE_DURATION)).toBe('1,000');
    expect(formatReservedWithUnits(0, DataCategory.PROFILE_DURATION)).toBe('0');
    expect(formatReservedWithUnits(-1, DataCategory.PROFILE_DURATION)).toBe(UNLIMITED);
    expect(formatReservedWithUnits(500, DataCategory.PROFILE_DURATION)).toBe('500');
    expect(
      formatReservedWithUnits(1000, DataCategory.PROFILE_DURATION, {
        isAbbreviated: true,
      })
    ).toBe('1K');
  });

  it('returns correct string for reserved budget', () => {
    expect(formatReservedWithUnits(1000, DataCategory.SPANS, {}, true)).toBe('$10.00');
    expect(formatReservedWithUnits(1500_00, DataCategory.SPANS, {}, true)).toBe(
      '$1,500.00'
    );
    expect(formatReservedWithUnits(0, DataCategory.SPANS, {}, true)).toBe('$0.00');
  });

  it('returns correct string for logs', () => {
    expect(formatReservedWithUnits(0, DataCategory.LOG_BYTE)).toBe('0 GB');
    expect(formatReservedWithUnits(0.1, DataCategory.LOG_BYTE)).toBe('0.1 GB');
    expect(formatReservedWithUnits(1, DataCategory.LOG_BYTE)).toBe('1 GB');
    expect(formatReservedWithUnits(1000, DataCategory.LOG_BYTE)).toBe('1,000 GB');

    expect(
      formatReservedWithUnits(0.1234, DataCategory.LOG_BYTE, {
        isAbbreviated: true,
      })
    ).toBe('0.1 GB');
    expect(
      formatReservedWithUnits(1.234, DataCategory.LOG_BYTE, {
        isAbbreviated: true,
      })
    ).toBe('1.2 GB');
    expect(
      formatReservedWithUnits(0.1, DataCategory.LOG_BYTE, {
        useUnitScaling: true,
      })
    ).toBe('0.1 GB');
    expect(
      formatReservedWithUnits(1, DataCategory.LOG_BYTE, {
        useUnitScaling: true,
      })
    ).toBe('1 GB');
    expect(
      formatReservedWithUnits(1000, DataCategory.LOG_BYTE, {
        useUnitScaling: true,
      })
    ).toBe('1 TB');
    expect(
      formatReservedWithUnits(1234, DataCategory.LOG_BYTE, {
        useUnitScaling: true,
      })
    ).toBe('1.23 TB');
    expect(
      formatReservedWithUnits(1234 * BILLION, DataCategory.LOG_BYTE, {
        useUnitScaling: true,
      })
    ).toBe('1.23 ZB');
    expect(
      formatReservedWithUnits(-1 / GIGABYTE, DataCategory.LOG_BYTE, {
        useUnitScaling: true,
      })
    ).toBe(UNLIMITED);
    expect(
      formatReservedWithUnits(-1, DataCategory.LOG_BYTE, {
        useUnitScaling: true,
      })
    ).toBe(UNLIMITED);

    expect(
      formatReservedWithUnits(1234, DataCategory.LOG_BYTE, {
        isAbbreviated: true,
      })
    ).toBe('1,234 GB');
    expect(
      formatReservedWithUnits(MILLION, DataCategory.LOG_BYTE, {
        isAbbreviated: true,
      })
    ).toBe('1,000,000 GB');
    expect(
      formatReservedWithUnits(1.234 * MILLION, DataCategory.LOG_BYTE, {
        isAbbreviated: true,
      })
    ).toBe('1,234,000 GB');
    expect(
      formatReservedWithUnits(BILLION, DataCategory.LOG_BYTE, {
        isAbbreviated: true,
      })
    ).toBe('1,000,000,000 GB');
    expect(
      formatReservedWithUnits(1.234 * BILLION, DataCategory.LOG_BYTE, {
        isAbbreviated: true,
      })
    ).toBe('1,234,000,000 GB');
  });
});

describe('formatUsageWithUnits', () => {
  it('returns correct strings for Errors', () => {
    expect(formatUsageWithUnits(0, DataCategory.ERRORS)).toBe('0');
    expect(formatUsageWithUnits(1000, DataCategory.ERRORS)).toBe('1,000');
    expect(formatUsageWithUnits(MILLION, DataCategory.ERRORS)).toBe('1,000,000');
    expect(formatUsageWithUnits(BILLION, DataCategory.ERRORS)).toBe('1,000,000,000');

    expect(formatUsageWithUnits(0, DataCategory.ERRORS, {isAbbreviated: true})).toBe('0');
    expect(formatUsageWithUnits(1000, DataCategory.ERRORS, {isAbbreviated: true})).toBe(
      '1K'
    );
    expect(
      formatUsageWithUnits(MILLION, DataCategory.ERRORS, {isAbbreviated: true})
    ).toBe('1M');
    expect(
      formatUsageWithUnits(1.234 * MILLION, DataCategory.ERRORS, {
        isAbbreviated: true,
      })
    ).toBe('1.2M');
    expect(
      formatUsageWithUnits(1.234 * BILLION, DataCategory.ERRORS, {
        isAbbreviated: true,
      })
    ).toBe('1.23B');
  });

  it('returns correct strings for Transactions', () => {
    expect(formatUsageWithUnits(0, DataCategory.TRANSACTIONS)).toBe('0');
    expect(formatUsageWithUnits(1000, DataCategory.TRANSACTIONS)).toBe('1,000');
    expect(formatUsageWithUnits(MILLION, DataCategory.TRANSACTIONS)).toBe('1,000,000');
    expect(formatUsageWithUnits(BILLION, DataCategory.TRANSACTIONS)).toBe(
      '1,000,000,000'
    );

    expect(
      formatUsageWithUnits(0, DataCategory.TRANSACTIONS, {isAbbreviated: true})
    ).toBe('0');
    expect(
      formatUsageWithUnits(1000, DataCategory.TRANSACTIONS, {isAbbreviated: true})
    ).toBe('1K');
    expect(
      formatUsageWithUnits(MILLION, DataCategory.TRANSACTIONS, {isAbbreviated: true})
    ).toBe('1M');
    expect(
      formatUsageWithUnits(1.234 * MILLION, DataCategory.TRANSACTIONS, {
        isAbbreviated: true,
      })
    ).toBe('1.2M');
    expect(
      formatUsageWithUnits(1.234 * BILLION, DataCategory.TRANSACTIONS, {
        isAbbreviated: true,
      })
    ).toBe('1.23B');
  });

  it('returns correct strings for Attachments', () => {
    expect(formatUsageWithUnits(0, DataCategory.ATTACHMENTS)).toBe('0 GB');
    expect(formatUsageWithUnits(MILLION, DataCategory.ATTACHMENTS)).toBe('0 GB');
    expect(formatUsageWithUnits(BILLION, DataCategory.ATTACHMENTS)).toBe('1 GB');
    expect(formatUsageWithUnits(1.234 * BILLION, DataCategory.ATTACHMENTS)).toBe(
      '1.23 GB'
    );
    expect(formatUsageWithUnits(1234 * GIGABYTE, DataCategory.ATTACHMENTS)).toBe(
      '1,234 GB'
    );

    expect(formatUsageWithUnits(0, DataCategory.ATTACHMENTS, {isAbbreviated: true})).toBe(
      '0 GB'
    );
    expect(
      formatUsageWithUnits(MILLION, DataCategory.ATTACHMENTS, {isAbbreviated: true})
    ).toBe('0 GB');
    expect(
      formatUsageWithUnits(BILLION, DataCategory.ATTACHMENTS, {isAbbreviated: true})
    ).toBe('1 GB');
    expect(
      formatUsageWithUnits(1.234 * BILLION, DataCategory.ATTACHMENTS, {
        isAbbreviated: true,
      })
    ).toBe('1 GB');
    expect(
      formatUsageWithUnits(1234 * BILLION, DataCategory.ATTACHMENTS, {
        isAbbreviated: true,
      })
    ).toBe('1K GB');

    expect(
      formatUsageWithUnits(0, DataCategory.ATTACHMENTS, {
        useUnitScaling: true,
      })
    ).toBe('0 B');
    expect(
      formatUsageWithUnits(1000, DataCategory.ATTACHMENTS, {
        useUnitScaling: true,
      })
    ).toBe('1 KB');
    expect(
      formatUsageWithUnits(MILLION, DataCategory.ATTACHMENTS, {
        useUnitScaling: true,
      })
    ).toBe('1 MB');
    expect(
      formatUsageWithUnits(1.234 * MILLION, DataCategory.ATTACHMENTS, {
        useUnitScaling: true,
      })
    ).toBe('1.23 MB');
    expect(
      formatUsageWithUnits(1.234 * BILLION, DataCategory.ATTACHMENTS, {
        useUnitScaling: true,
      })
    ).toBe('1.23 GB');
    expect(
      formatUsageWithUnits(1234 * BILLION, DataCategory.ATTACHMENTS, {
        useUnitScaling: true,
      })
    ).toBe('1.23 TB');
  });

  it('returns correct string for continuous profiling', () => {
    [DataCategory.PROFILE_DURATION, DataCategory.PROFILE_DURATION_UI].forEach(
      (cat: DataCategory) => {
        expect(formatUsageWithUnits(0, cat)).toBe('0');
        expect(formatUsageWithUnits(1, cat)).toBe('0');
        expect(formatUsageWithUnits(360000, cat)).toBe('0.1');
        expect(formatUsageWithUnits(MILLISECONDS_IN_HOUR, cat)).toBe('1');
        expect(formatUsageWithUnits(5.23 * MILLISECONDS_IN_HOUR, cat)).toBe('5.2');
        expect(formatUsageWithUnits(1000 * MILLISECONDS_IN_HOUR, cat)).toBe('1,000');
        expect(
          formatUsageWithUnits(1000 * MILLISECONDS_IN_HOUR, cat, {
            isAbbreviated: true,
          })
        ).toBe('1K');
      }
    );
  });
});

describe('convertUsageToReservedUnit', () => {
  it('converts attachments from bytes to GB', () => {
    expect(convertUsageToReservedUnit(GIGABYTE, DataCategory.ATTACHMENTS)).toBe(1);
    expect(convertUsageToReservedUnit(5 * GIGABYTE, DataCategory.ATTACHMENTS)).toBe(5);
    expect(convertUsageToReservedUnit(0.5 * GIGABYTE, DataCategory.ATTACHMENTS)).toBe(
      0.5
    );
  });

  it('converts continuous profiling from milliseconds to hours', () => {
    expect(
      convertUsageToReservedUnit(MILLISECONDS_IN_HOUR, DataCategory.PROFILE_DURATION)
    ).toBe(1);
    expect(
      convertUsageToReservedUnit(2 * MILLISECONDS_IN_HOUR, DataCategory.PROFILE_DURATION)
    ).toBe(2);
    expect(
      convertUsageToReservedUnit(
        0.5 * MILLISECONDS_IN_HOUR,
        DataCategory.PROFILE_DURATION
      )
    ).toBe(0.5);
    expect(
      convertUsageToReservedUnit(MILLISECONDS_IN_HOUR, DataCategory.PROFILE_DURATION_UI)
    ).toBe(1);
    expect(
      convertUsageToReservedUnit(
        3.5 * MILLISECONDS_IN_HOUR,
        DataCategory.PROFILE_DURATION_UI
      )
    ).toBe(3.5);
  });

  it('returns usage unchanged for other categories', () => {
    expect(convertUsageToReservedUnit(1000, DataCategory.ERRORS)).toBe(1000);
    expect(convertUsageToReservedUnit(500, DataCategory.TRANSACTIONS)).toBe(500);
    expect(convertUsageToReservedUnit(250, DataCategory.REPLAYS)).toBe(250);
    expect(convertUsageToReservedUnit(0, DataCategory.SPANS)).toBe(0);
  });
});

describe('getSlot', () => {
  function makeBucket(props: {events?: number; price?: number}) {
    return {
      events: 0,
      min: 0,
      onDemandPrice: 0,
      price: 0,
      unitPrice: 0,
      ...props,
    };
  }
  it('should return slot zero when no slots are passed', () => {
    const reservedEvents = 0;
    const currentPrice = 0;
    const slot = getSlot(reservedEvents, currentPrice, []);
    expect(slot).toBe(0);
  });

  it('should return slot zero when no price is passed', () => {
    const reservedEvents = undefined;
    const currentPrice = 0;
    const slot = getSlot(reservedEvents, currentPrice, []);
    expect(slot).toBe(0);
  });

  it('should return slot zero when no events is passed', () => {
    const reservedEvents = 0;
    const currentPrice = undefined;
    const slot = getSlot(reservedEvents, currentPrice, []);
    expect(slot).toBe(0);
  });

  it('should return the slot index which matches the current reserved events', () => {
    const reservedEvents = 100_000;
    const currentPrice = undefined;
    const buckets = [
      makeBucket({events: 50_000}),
      makeBucket({events: 100_000}), // matches the current reservation
      makeBucket({events: 200_000}),
    ];
    const slot = getSlot(reservedEvents, currentPrice, buckets);
    expect(slot).toBe(1);

    const slotWithMinimize = getSlot(reservedEvents, currentPrice, buckets, true);
    expect(slotWithMinimize).toBe(1);
  });

  it('should return the slot index which matches the current price', () => {
    const reservedEvents = undefined;
    const currentPrice = 29.0;
    const buckets = [
      makeBucket({price: 29}), // matches the current price
      makeBucket({price: 39}),
      makeBucket({price: 49}),
    ];
    const slot = getSlot(reservedEvents, currentPrice, buckets);
    expect(slot).toBe(0);

    const slotWithMinimize = getSlot(reservedEvents, currentPrice, buckets, true);
    expect(slotWithMinimize).toBe(0);
  });

  it('should return the slot index that is above the current reserved events', () => {
    const reservedEvents = 110_000;
    const currentPrice = undefined;
    const buckets = [
      makeBucket({events: 50_000}),
      makeBucket({events: 100_000}),
      makeBucket({events: 200_000}), // next highest
    ];
    const slot = getSlot(reservedEvents, currentPrice, buckets);
    expect(slot).toBe(2);
  });

  it('should return the slot index that is below the current reserved events with minimize strategy', () => {
    const reservedEvents = 110_000;
    const currentPrice = undefined;
    const buckets = [
      makeBucket({events: 50_000}),
      makeBucket({events: 100_000}), // next lowest
      makeBucket({events: 200_000}),
    ];
    const slot = getSlot(reservedEvents, currentPrice, buckets, true);
    expect(slot).toBe(1);
  });

  it('should return the slot index that is above the current price', () => {
    const reservedEvents = undefined;
    const currentPrice = 33.0;
    const buckets = [
      makeBucket({price: 29}),
      makeBucket({price: 39}), // next highest
      makeBucket({price: 49}),
    ];
    const slot = getSlot(reservedEvents, currentPrice, buckets);
    expect(slot).toBe(1);
  });

  it('should return the slot index that is below the current price with minimize strategy', () => {
    const reservedEvents = undefined;
    const currentPrice = 33.0;
    const buckets = [
      makeBucket({price: 29}), // next lowest
      makeBucket({price: 39}),
      makeBucket({price: 49}),
    ];
    const slot = getSlot(reservedEvents, currentPrice, buckets, true);
    expect(slot).toBe(0);
  });

  it('should not overflow the known slot indexes', () => {
    const reservedEvents = 110_000;
    const currentPrice = undefined;
    const buckets = [
      makeBucket({events: 50_000}),
      makeBucket({events: 100_000}), // highest available plan, lower than our reservation
    ];
    const slot = getSlot(reservedEvents, currentPrice, buckets);

    const expectedSlot = 1;
    expect(slot).toBe(expectedSlot);
    expect(buckets.length).toBeGreaterThan(expectedSlot);
  });

  it('should not overflow the known slot indexes when the best option is less than our reservation', () => {
    const reservedEvents = 110_000;
    const currentPrice = undefined;
    const buckets = [
      makeBucket({events: 50_000}), // highest available plan, lower than our reservation
    ];
    const slot = getSlot(reservedEvents, currentPrice, buckets);

    const expectedSlot = 0;
    expect(slot).toBe(expectedSlot);
    expect(buckets.length).toBeGreaterThan(expectedSlot);
  });

  it('should not overflow the known slot indexes when the best option is more than current reservation', () => {
    const reservedEvents = 30_000;
    const currentPrice = undefined;
    const buckets = [
      makeBucket({events: 50_000}), // highest available plan, higher than our reservation
    ];
    const slot = getSlot(reservedEvents, currentPrice, buckets);

    const expectedSlot = 0;
    expect(slot).toBe(expectedSlot);
    expect(buckets.length).toBeGreaterThan(expectedSlot);
  });

  it('should not return a negative index with minimize strategy', () => {
    const reservedEvents = 40_000;
    const currentPrice = undefined;
    const buckets = [
      makeBucket({events: 50_000}),
      makeBucket({events: 100_000}), // highest available plan, lower than our reservation
    ];
    const slot = getSlot(reservedEvents, currentPrice, buckets, true);

    const expectedSlot = 0;
    expect(slot).toBe(expectedSlot);
    expect(buckets.length).toBeGreaterThan(expectedSlot);
  });
});

describe('Pricing plan functions', () => {
  const organization = OrganizationFixture();

  const am1Team = SubscriptionFixture({organization, plan: 'am1_team'});
  const mm2Team = SubscriptionFixture({organization, plan: 'mm2_b_100k'});
  const am1Biz = SubscriptionFixture({organization, plan: 'am1_business'});
  const am2Biz = SubscriptionFixture({organization, plan: 'am2_business'});
  const mm2Biz = SubscriptionFixture({organization, plan: 'mm2_a_100k'});
  const am2Dev = SubscriptionFixture({organization, plan: 'am2_f'});
  const am3Dev = SubscriptionFixture({organization, plan: 'am3_f'});
  const am3Biz = SubscriptionFixture({organization, plan: 'am3_business'});

  it('returns if a plan has performance', () => {
    expect(hasPerformance(mm2Biz.planDetails)).toBe(false);
    expect(hasPerformance(mm2Team.planDetails)).toBe(false);

    expect(hasPerformance(am1Biz.planDetails)).toBe(true);
    expect(hasPerformance(am1Team.planDetails)).toBe(true);

    expect(hasPerformance(am3Dev.planDetails)).toBe(true);
    expect(hasPerformance(am3Biz.planDetails)).toBe(true);
  });

  it('returns correct plan family', () => {
    expect(isTeamPlanFamily(am1Team.planDetails)).toBe(true);
    expect(isTeamPlanFamily(mm2Team.planDetails)).toBe(true);
    expect(isTeamPlanFamily(am1Biz.planDetails)).toBe(false);
    expect(isTeamPlanFamily(mm2Biz.planDetails)).toBe(false);

    expect(isBizPlanFamily(am1Team.planDetails)).toBe(false);
    expect(isBizPlanFamily(mm2Team.planDetails)).toBe(false);
    expect(isBizPlanFamily(am1Biz.planDetails)).toBe(true);
    expect(isBizPlanFamily(mm2Biz.planDetails)).toBe(true);

    expect(isDeveloperPlan(am2Dev.planDetails)).toBe(true);
    expect(isDeveloperPlan(am2Biz.planDetails)).toBe(false);
    expect(isDeveloperPlan(am1Biz.planDetails)).toBe(false);
    expect(isDeveloperPlan(am1Team.planDetails)).toBe(false);
    expect(isDeveloperPlan(mm2Biz.planDetails)).toBe(false);
  });
});

describe('getProductTrial', () => {
  const TEST_TRIALS: ProductTrial[] = [
    // errors - with active trials
    {
      category: DataCategory.ERRORS,
      isStarted: true,
      reasonCode: 1001,
      startDate: moment().utc().subtract(10, 'days').format(),
      endDate: moment().utc().add(20, 'days').format(),
    },
    {
      category: DataCategory.ERRORS,
      isStarted: true,
      reasonCode: 1002,
      startDate: moment().utc().subtract(10, 'days').format(),
      endDate: moment().utc().add(5, 'days').format(),
    },
    {
      category: DataCategory.ERRORS,
      isStarted: true,
      reasonCode: 1003,
      startDate: moment().utc().subtract(20, 'days').format(),
      endDate: moment().utc().subtract(5, 'days').format(),
    },
    {
      category: DataCategory.ERRORS,
      isStarted: false,
      reasonCode: 1004,
      endDate: moment().utc().add(90, 'days').format(),
      lengthDays: 14,
    },

    // transactions - with available trials not started
    {
      category: DataCategory.TRANSACTIONS,
      isStarted: false,
      reasonCode: 2001,
      endDate: moment().utc().add(20, 'days').format(),
      lengthDays: 7,
    },
    {
      category: DataCategory.TRANSACTIONS,
      isStarted: false,
      reasonCode: 2002,
      endDate: moment().utc().add(5, 'days').format(),
      lengthDays: 14,
    },
    {
      category: DataCategory.TRANSACTIONS,
      isStarted: false,
      reasonCode: 2003,
      startDate: moment().utc().subtract(20, 'days').format(),
      endDate: moment().utc().subtract(5, 'days').format(),
    },
    {
      category: DataCategory.TRANSACTIONS,
      isStarted: true,
      reasonCode: 2004,
      startDate: moment().utc().subtract(21, 'days').format(),
      endDate: moment().utc().subtract(7, 'days').format(),
      lengthDays: 14,
    },

    // replays - only expired trials
    {
      category: DataCategory.REPLAYS,
      isStarted: false,
      reasonCode: 3001,
      startDate: moment().utc().subtract(42, 'days').format(),
      endDate: moment().utc().subtract(27, 'days').format(),
    },
    {
      category: DataCategory.REPLAYS,
      isStarted: false,
      reasonCode: 3002,
      startDate: moment().utc().subtract(15, 'days').format(),
      endDate: moment().utc().subtract(1, 'days').format(),
    },
    {
      category: DataCategory.REPLAYS,
      isStarted: false,
      reasonCode: 3003,
      startDate: moment().utc().subtract(70, 'days').format(),
      endDate: moment().utc().subtract(56, 'days').format(),
    },
  ];

  it('returns current trial with latest end date', () => {
    const pt = getProductTrial(TEST_TRIALS, DataCategory.ERRORS);
    expect(pt?.reasonCode).toBe(1001);
  });

  it('returns available trial with longest days', () => {
    const pt = getProductTrial(TEST_TRIALS, DataCategory.TRANSACTIONS);
    expect(pt?.reasonCode).toBe(2002);
  });

  it('returns most recent ended trial', () => {
    const pt = getProductTrial(TEST_TRIALS, DataCategory.REPLAYS);
    expect(pt?.reasonCode).toBe(3002);
  });

  it('returns null trial when not available', () => {
    const pt = getProductTrial(TEST_TRIALS, DataCategory.ATTACHMENTS);
    expect(pt).toBeNull();
  });

  it('returns null trial when empty', () => {
    const pt = getProductTrial([], DataCategory.ATTACHMENTS);
    expect(pt).toBeNull();
  });

  it('returns null trial for null trials', () => {
    const pt = getProductTrial(null, DataCategory.ATTACHMENTS);
    expect(pt).toBeNull();
  });

  it('tests for trialPromptIsDismissed', () => {
    const organization = OrganizationFixture();
    const jan01 = '2023-01-01';
    const feb01 = '2023-02-01';
    const mar01 = '2023-03-01';
    const dateDismissed = '2023-01-15';

    const isDismissedNoDate = trialPromptIsDismissed(
      {},
      SubscriptionFixture({organization, plan: 'am1_team', onDemandPeriodStart: jan01})
    );
    expect(isDismissedNoDate).toBe(false);

    const isDismissedInJan = trialPromptIsDismissed(
      {snoozedTime: new Date(dateDismissed).getTime() / 1000},
      SubscriptionFixture({organization, plan: 'am1_team', onDemandPeriodStart: jan01})
    );
    expect(isDismissedInJan).toBe(true);

    const isDismissedInFeb = trialPromptIsDismissed(
      {snoozedTime: new Date(dateDismissed).getTime() / 1000},
      SubscriptionFixture({organization, plan: 'am1_team', onDemandPeriodStart: feb01})
    );
    expect(isDismissedInFeb).toBe(false);

    const isDismissedInMar = trialPromptIsDismissed(
      {dismissedTime: new Date(dateDismissed).getTime() / 1000},
      SubscriptionFixture({organization, plan: 'am1_team', onDemandPeriodStart: mar01})
    );
    expect(isDismissedInMar).toBe(false);
  });
});

describe('getActiveProductTrial', () => {
  const TEST_TRIALS: ProductTrial[] = [
    // errors - with active trials
    {
      category: DataCategory.ERRORS,
      isStarted: true,
      reasonCode: 1001,
      startDate: moment().utc().subtract(10, 'days').format(),
      endDate: moment().utc().add(20, 'days').format(),
    },
    {
      category: DataCategory.ERRORS,
      isStarted: true,
      reasonCode: 1002,
      startDate: moment().utc().subtract(10, 'days').format(),
      endDate: moment().utc().add(5, 'days').format(),
    },
    {
      category: DataCategory.ERRORS,
      isStarted: true,
      reasonCode: 1003,
      startDate: moment().utc().subtract(20, 'days').format(),
      endDate: moment().utc().subtract(5, 'days').format(),
    },
    {
      category: DataCategory.ERRORS,
      isStarted: false,
      reasonCode: 1004,
      endDate: moment().utc().add(90, 'days').format(),
      lengthDays: 14,
    },

    // transactions - with available trials not started
    {
      category: DataCategory.TRANSACTIONS,
      isStarted: false,
      reasonCode: 2001,
      endDate: moment().utc().add(20, 'days').format(),
      lengthDays: 7,
    },
    {
      category: DataCategory.TRANSACTIONS,
      isStarted: false,
      reasonCode: 2002,
      endDate: moment().utc().add(5, 'days').format(),
      lengthDays: 14,
    },
    {
      category: DataCategory.TRANSACTIONS,
      isStarted: false,
      reasonCode: 2003,
      startDate: moment().utc().subtract(20, 'days').format(),
      endDate: moment().utc().subtract(5, 'days').format(),
    },
    {
      category: DataCategory.TRANSACTIONS,
      isStarted: true,
      reasonCode: 2004,
      startDate: moment().utc().subtract(21, 'days').format(),
      endDate: moment().utc().subtract(7, 'days').format(),
      lengthDays: 14,
    },

    // replays - only expired trials
    {
      category: DataCategory.REPLAYS,
      isStarted: false,
      reasonCode: 3001,
      startDate: moment().utc().subtract(42, 'days').format(),
      endDate: moment().utc().subtract(27, 'days').format(),
    },
    {
      category: DataCategory.REPLAYS,
      isStarted: false,
      reasonCode: 3002,
      startDate: moment().utc().subtract(15, 'days').format(),
      endDate: moment().utc().subtract(1, 'days').format(),
    },
    {
      category: DataCategory.REPLAYS,
      isStarted: false,
      reasonCode: 3003,
      startDate: moment().utc().subtract(70, 'days').format(),
      endDate: moment().utc().subtract(56, 'days').format(),
    },
  ];

  it('returns current trial with latest end date for category', () => {
    const pt = getActiveProductTrial(TEST_TRIALS, DataCategory.ERRORS);
    expect(pt?.reasonCode).toBe(1001);
  });

  it('returns null when no active trial for the category', () => {
    // none started
    const transaction_pt = getActiveProductTrial(TEST_TRIALS, DataCategory.TRANSACTIONS);
    expect(transaction_pt).toBeNull();

    // all expired
    const replay_pt = getActiveProductTrial(TEST_TRIALS, DataCategory.REPLAYS);
    expect(replay_pt).toBeNull();
  });

  it('returns null trial when no trials for category', () => {
    const pt = getProductTrial(TEST_TRIALS, DataCategory.ATTACHMENTS);
    expect(pt).toBeNull();
  });

  it('returns null trial when empty', () => {
    const pt = getProductTrial([], DataCategory.ERRORS);
    expect(pt).toBeNull();
  });

  it('returns null trial for null trials', () => {
    const pt = getProductTrial(null, DataCategory.ERRORS);
    expect(pt).toBeNull();
  });
});

describe('isNewPayingCustomer', () => {
  it('returns true for customer on free plan', () => {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({organization, isFree: true});
    expect(isNewPayingCustomer(subscription, organization)).toBe(true);
  });

  it('returns true for customer on trial plan', () => {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_t',
      isFree: false,
    });
    expect(isNewPayingCustomer(subscription, organization)).toBe(true);
  });

  it('returns true for customer with partner migration feature', () => {
    const organization = OrganizationFixture({features: ['partner-billing-migration']});
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
      isFree: false,
    });
    expect(isNewPayingCustomer(subscription, organization)).toBe(true);
  });

  it('returns false for customer on plan trial', () => {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
      isTrial: true,
      isFree: false,
    });
    expect(isNewPayingCustomer(subscription, organization)).toBe(false);
  });

  it('returns false for paying customer', () => {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
      isFree: false,
    });
    expect(isNewPayingCustomer(subscription, organization)).toBe(false);
  });
});

describe('getOnDemandCategories', () => {
  const plan = PlanDetailsLookupFixture('am1_business')!;
  it('filters out unconfigurable categories for per-category budget mode', () => {
    const categories = getOnDemandCategories({
      plan,
      budgetMode: OnDemandBudgetMode.PER_CATEGORY,
    });
    expect(categories).toHaveLength(plan.onDemandCategories.length - 2);
    expect(categories).not.toContain(DataCategory.SEER_SCANNER);
    expect(categories).not.toContain(DataCategory.SEER_AUTOFIX);
  });

  it('does not filter out any categories for shared budget mode', () => {
    const categories = getOnDemandCategories({
      plan,
      budgetMode: OnDemandBudgetMode.SHARED,
    });
    expect(categories).toHaveLength(plan.onDemandCategories.length);
    expect(categories).toEqual(plan.onDemandCategories);
  });
});

describe('getOnDemandCategories - AM2 logBytes support', () => {
  it('does not include logBytes in getOnDemandCategories for AM2 plans in per-category mode', () => {
    const plan = PlanDetailsLookupFixture('am2_business')!;
    const categories = getOnDemandCategories({
      plan,
      budgetMode: OnDemandBudgetMode.PER_CATEGORY,
    });
    expect(categories).not.toContain('logBytes');
  });

  it('includes logBytes in getOnDemandCategories for AM2 plans in shared mode', () => {
    const plan = PlanDetailsLookupFixture('am2_business')!;
    const categories = getOnDemandCategories({
      plan,
      budgetMode: OnDemandBudgetMode.SHARED,
    });
    expect(categories).toContain('logBytes');
  });
});

describe('isEnterprise', () => {
  it('returns true for enterprise plans', () => {
    expect(isEnterprise('e1')).toBe(true);
    expect(isEnterprise('enterprise')).toBe(true);
    expect(isEnterprise('am1_business_ent')).toBe(true);
    expect(isEnterprise('am2_team_ent_auf')).toBe(true);
    expect(isEnterprise('am3_business_ent_ds_auf')).toBe(true);
  });

  it('returns false for non-enterprise plans', () => {
    expect(isEnterprise('_e1')).toBe(false);
    expect(isEnterprise('_enterprise')).toBe(false);
    expect(isEnterprise('am1_business')).toBe(false);
    expect(isEnterprise('am2_team')).toBe(false);
  });
});

describe('getBestActionToIncreaseEventLimits', () => {
  it('returns start trial for free plan', () => {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_f',
    });
    expect(getBestActionToIncreaseEventLimits(organization, subscription)).toBe(
      UsageAction.START_TRIAL
    );
  });

  it('returns add events for paid plan with usage exceeded', () => {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
      categories: {
        errors: MetricHistoryFixture({usageExceeded: false}),
        spans: MetricHistoryFixture({usageExceeded: true}),
        replays: MetricHistoryFixture({usageExceeded: false}),
        attachments: MetricHistoryFixture({usageExceeded: true}),
        monitorSeats: MetricHistoryFixture({usageExceeded: false}),
      },
    });
    expect(getBestActionToIncreaseEventLimits(organization, subscription)).toBe(
      UsageAction.REQUEST_ADD_EVENTS
    );
  });

  it('returns nothing for business plan without usage exceeded', () => {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_business',
    });
    expect(getBestActionToIncreaseEventLimits(organization, subscription)).toBe('');
  });
});

describe('getCreditApplied', () => {
  it('returns correct credit applied', () => {
    expect(getCreditApplied({creditApplied: 100, invoiceItems: []})).toBe(100);
    const commonCreditProps = {
      amount: 50,
      data: {},
      description: '',
      period_end: '',
      period_start: '',
    };
    expect(
      getCreditApplied({
        creditApplied: 100,
        invoiceItems: [
          {
            type: 'subscription_credit',
            ...commonCreditProps,
          },
        ],
      })
    ).toBe(100);
    expect(
      getCreditApplied({
        creditApplied: 100,
        invoiceItems: [
          {
            type: 'balance_change',
            ...commonCreditProps,
          },
        ],
      })
    ).toBe(100);
    expect(
      getCreditApplied({
        creditApplied: 100,
        invoiceItems: [
          {
            type: 'balance_change',
            ...commonCreditProps,
            amount: -50,
          },
        ],
      })
    ).toBe(0);
  });
});

describe('checkIsAddOn', () => {
  it('returns true for add-on', () => {
    expect(checkIsAddOn(AddOnCategory.LEGACY_SEER)).toBe(true);
    expect(checkIsAddOn(AddOnCategory.SEER)).toBe(true);
  });

  it('returns false for data category', () => {
    expect(checkIsAddOn(DataCategory.ERRORS)).toBe(false);
    expect(checkIsAddOn(DataCategory.SEER_AUTOFIX)).toBe(false);
  });
});

describe('checkIsAddOnChildCategory', () => {
  const organization = OrganizationFixture();
  let subscription: Subscription;

  beforeEach(() => {
    subscription = SubscriptionFixture({organization, plan: 'am3_team'});
  });

  it('returns false when parent add-on is unavailable', () => {
    subscription.addOns!.seer = {
      ...subscription.addOns?.seer!,
      isAvailable: false,
    };
    expect(checkIsAddOnChildCategory(subscription, DataCategory.SEER_USER, true)).toBe(
      false
    );
  });

  it('returns true for zero reserved volume', () => {
    subscription.categories.seerUsers = {
      ...subscription.categories.seerUsers!,
      reserved: 0,
    };
    expect(checkIsAddOnChildCategory(subscription, DataCategory.SEER_USER, true)).toBe(
      true
    );
  });

  it('returns true for RESERVED_BUDGET_QUOTA reserved volume', () => {
    subscription.categories.seerAutofix = {
      ...subscription.categories.seerAutofix!,
      reserved: RESERVED_BUDGET_QUOTA,
    };
    expect(checkIsAddOnChildCategory(subscription, DataCategory.SEER_AUTOFIX, true)).toBe(
      true
    );
  });

  it('returns true for sub-categories regardless of reserved volume if not checking', () => {
    subscription.categories.seerAutofix = {
      ...subscription.categories.seerAutofix!,
      reserved: UNLIMITED_RESERVED,
    };
    expect(
      checkIsAddOnChildCategory(subscription, DataCategory.SEER_AUTOFIX, false)
    ).toBe(true);
  });

  it('returns false for sub-categories with non-zero reserved volume if checking', () => {
    subscription.categories.seerAutofix = {
      ...subscription.categories.seerAutofix!,
      reserved: UNLIMITED_RESERVED,
    };
    expect(checkIsAddOnChildCategory(subscription, DataCategory.SEER_AUTOFIX, true)).toBe(
      false
    );
  });
});

describe('getBilledCategory', () => {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization, plan: 'am3_team'});

  it('returns correct billed category for data category', () => {
    subscription.planDetails.categories.forEach(category => {
      expect(getBilledCategory(subscription, category)).toBe(category);
    });
  });

  it('returns correct billed category for add-on', () => {
    expect(getBilledCategory(subscription, AddOnCategory.LEGACY_SEER)).toBe(
      DataCategory.SEER_AUTOFIX
    );
    expect(getBilledCategory(subscription, AddOnCategory.SEER)).toBe(
      DataCategory.SEER_USER
    );
  });
});

describe('productIsEnabled', () => {
  const organization = OrganizationFixture();
  let subscription: Subscription;

  beforeEach(() => {
    subscription = SubscriptionFixture({organization, plan: 'am3_team'});
  });

  it('returns true for active product trial', () => {
    subscription.productTrials = [
      {
        // not started
        category: DataCategory.PROFILE_DURATION,
        isStarted: false,
        reasonCode: 1001,
        startDate: undefined,
        endDate: moment().utc().add(20, 'years').format(),
      },
      {
        // started
        category: DataCategory.REPLAYS,
        isStarted: true,
        reasonCode: 1001,
        startDate: moment().utc().subtract(10, 'days').format(),
        endDate: moment().utc().add(20, 'days').format(),
      },
      {
        // started
        category: DataCategory.SEER_AUTOFIX,
        isStarted: true,
        reasonCode: 1001,
        startDate: moment().utc().subtract(10, 'days').format(),
        endDate: moment().utc().add(20, 'days').format(),
      },
    ];

    expect(productIsEnabled(subscription, DataCategory.PROFILE_DURATION)).toBe(false);
    expect(productIsEnabled(subscription, DataCategory.REPLAYS)).toBe(true);
    expect(productIsEnabled(subscription, DataCategory.SEER_AUTOFIX)).toBe(true);
    expect(productIsEnabled(subscription, AddOnCategory.LEGACY_SEER)).toBe(true); // because there is a product trial for the billed category
  });

  it('uses subscription add-on info for add-on', () => {
    subscription.addOns!.seer = {
      ...subscription.addOns?.seer!,
      enabled: true,
    };

    expect(productIsEnabled(subscription, AddOnCategory.SEER)).toBe(true);
    expect(productIsEnabled(subscription, AddOnCategory.LEGACY_SEER)).toBe(false);
  });

  it('returns true for non-PAYG-only data categories', () => {
    expect(productIsEnabled(subscription, DataCategory.ERRORS)).toBe(true);
  });

  it('uses PAYG budgets for PAYG-only data categories', () => {
    expect(productIsEnabled(subscription, DataCategory.PROFILE_DURATION)).toBe(false);

    // shared PAYG
    subscription.onDemandBudgets = {
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 1000,
      enabled: true,
      onDemandSpendUsed: 0,
    };
    expect(productIsEnabled(subscription, DataCategory.PROFILE_DURATION)).toBe(true);

    // per-category PAYG
    subscription.onDemandBudgets = {
      budgetMode: OnDemandBudgetMode.PER_CATEGORY,
      enabled: true,
      budgets: {
        errors: 1000,
      },
      usedSpends: {},
    };
    expect(productIsEnabled(subscription, DataCategory.PROFILE_DURATION)).toBe(false);

    subscription.onDemandBudgets.budgets = {
      ...subscription.onDemandBudgets.budgets,
      profileDuration: 1000,
    };
    subscription.categories.profileDuration = {
      ...subscription.categories.profileDuration!,
      onDemandBudget: 1000,
    };
    expect(productIsEnabled(subscription, DataCategory.PROFILE_DURATION)).toBe(true);
  });
});

describe('getSeerTrialCategory', () => {
  it('returns null for null productTrials', () => {
    expect(getSeerTrialCategory(null)).toBeNull();
  });

  it('returns null for empty productTrials', () => {
    expect(getSeerTrialCategory([])).toBeNull();
  });

  it('returns null when no Seer trials exist', () => {
    const trials: ProductTrial[] = [
      {
        category: DataCategory.ERRORS,
        isStarted: false,
        reasonCode: 1001,
        endDate: moment().utc().add(20, 'days').format(),
      },
    ];
    expect(getSeerTrialCategory(trials)).toBeNull();
  });

  it('returns SEER_USER when SEER_USER trial exists (seat-based billing)', () => {
    const trials: ProductTrial[] = [
      {
        category: DataCategory.SEER_USER,
        isStarted: false,
        reasonCode: 1001,
        endDate: moment().utc().add(20, 'days').format(),
      },
    ];
    expect(getSeerTrialCategory(trials)).toBe(DataCategory.SEER_USER);
  });

  it('returns SEER_AUTOFIX when only SEER_AUTOFIX trial exists (legacy billing)', () => {
    const trials: ProductTrial[] = [
      {
        category: DataCategory.SEER_AUTOFIX,
        isStarted: false,
        reasonCode: 1001,
        endDate: moment().utc().add(20, 'days').format(),
      },
    ];
    expect(getSeerTrialCategory(trials)).toBe(DataCategory.SEER_AUTOFIX);
  });

  it('returns SEER_USER when both SEER_USER and SEER_AUTOFIX trials exist (SEER_USER takes precedence)', () => {
    const trials: ProductTrial[] = [
      {
        category: DataCategory.SEER_AUTOFIX,
        isStarted: false,
        reasonCode: 1001,
        endDate: moment().utc().add(20, 'days').format(),
      },
      {
        category: DataCategory.SEER_USER,
        isStarted: false,
        reasonCode: 1002,
        endDate: moment().utc().add(20, 'days').format(),
      },
    ];
    expect(getSeerTrialCategory(trials)).toBe(DataCategory.SEER_USER);
  });

  it('returns SEER_USER when SEER_USER trial is active', () => {
    const trials: ProductTrial[] = [
      {
        category: DataCategory.SEER_USER,
        isStarted: true,
        reasonCode: 1001,
        startDate: moment().utc().subtract(5, 'days').format(),
        endDate: moment().utc().add(10, 'days').format(),
      },
    ];
    expect(getSeerTrialCategory(trials)).toBe(DataCategory.SEER_USER);
  });

  it('returns SEER_AUTOFIX when SEER_AUTOFIX trial is active (legacy)', () => {
    const trials: ProductTrial[] = [
      {
        category: DataCategory.SEER_AUTOFIX,
        isStarted: true,
        reasonCode: 1001,
        startDate: moment().utc().subtract(5, 'days').format(),
        endDate: moment().utc().add(10, 'days').format(),
      },
    ];
    expect(getSeerTrialCategory(trials)).toBe(DataCategory.SEER_AUTOFIX);
  });

  it('returns null when SEER_USER trial has expired (started trial)', () => {
    const trials: ProductTrial[] = [
      {
        category: DataCategory.SEER_USER,
        isStarted: true,
        reasonCode: 1001,
        startDate: moment().utc().subtract(20, 'days').format(),
        endDate: moment().utc().subtract(5, 'days').format(),
      },
    ];
    expect(getSeerTrialCategory(trials)).toBeNull();
  });

  it('returns null when SEER_USER trial offer has expired (unstarted trial with past start-by date)', () => {
    // This tests the case where an unstarted trial's "start by" deadline has passed
    const trials: ProductTrial[] = [
      {
        category: DataCategory.SEER_USER,
        isStarted: false,
        reasonCode: 1001,
        endDate: moment().utc().subtract(5, 'days').format(), // Expired start-by date
      },
    ];
    expect(getSeerTrialCategory(trials)).toBeNull();
  });

  it('returns null when SEER_AUTOFIX trial offer has expired (unstarted trial with past start-by date)', () => {
    const trials: ProductTrial[] = [
      {
        category: DataCategory.SEER_AUTOFIX,
        isStarted: false,
        reasonCode: 1001,
        endDate: moment().utc().subtract(5, 'days').format(), // Expired start-by date
      },
    ];
    expect(getSeerTrialCategory(trials)).toBeNull();
  });

  it('returns SEER_AUTOFIX when SEER_USER is expired but SEER_AUTOFIX is available', () => {
    const trials: ProductTrial[] = [
      {
        category: DataCategory.SEER_USER,
        isStarted: true,
        reasonCode: 1001,
        startDate: moment().utc().subtract(20, 'days').format(),
        endDate: moment().utc().subtract(5, 'days').format(),
      },
      {
        category: DataCategory.SEER_AUTOFIX,
        isStarted: false,
        reasonCode: 1002,
        endDate: moment().utc().add(20, 'days').format(),
      },
    ];
    expect(getSeerTrialCategory(trials)).toBe(DataCategory.SEER_AUTOFIX);
  });
});
