import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';

import {DataCategory} from 'sentry/types/core';

import {BILLION, GIGABYTE, MILLION, UNLIMITED} from 'getsentry/constants';
import {OnDemandBudgetMode, type ProductTrial} from 'getsentry/types';
import {
  formatReservedWithUnits,
  formatUsageWithUnits,
  getActiveProductTrial,
  getBestActionToIncreaseEventLimits,
  getOnDemandCategories,
  getProductTrial,
  getSlot,
  hasPerformance,
  isBizPlanFamily,
  isDeveloperPlan,
  isEnterprise,
  isNewPayingCustomer,
  isTeamPlanFamily,
  MILLISECONDS_IN_HOUR,
  trialPromptIsDismissed,
  UsageAction,
} from 'getsentry/utils/billing';

describe('formatReservedWithUnits', function () {
  it('returns correct string for Errors', function () {
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

  it('returns correct string for Transactions', function () {
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

  it('returns correct string for Attachments', function () {
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
  });

  it('returns correct string for Profile Duration', function () {
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

  it('returns correct string for reserved budget', function () {
    expect(formatReservedWithUnits(1000, DataCategory.SPANS, {}, true)).toBe('$10.00');
    expect(formatReservedWithUnits(1500_00, DataCategory.SPANS, {}, true)).toBe(
      '$1,500.00'
    );
    expect(formatReservedWithUnits(0, DataCategory.SPANS, {}, true)).toBe('$0.00');
  });
});

describe('formatUsageWithUnits', function () {
  it('returns correct strings for Errors', function () {
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

  it('returns correct strings for Transactions', function () {
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

  it('returns correct strings for Attachments', function () {
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

  it('returns correct string for continuous profiling', function () {
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

describe('Pricing plan functions', function () {
  const organization = OrganizationFixture();

  const am1Team = SubscriptionFixture({organization, plan: 'am1_team'});
  const mm2Team = SubscriptionFixture({organization, plan: 'mm2_b_100k'});
  const am1Biz = SubscriptionFixture({organization, plan: 'am1_business'});
  const am2Biz = SubscriptionFixture({organization, plan: 'am2_business'});
  const mm2Biz = SubscriptionFixture({organization, plan: 'mm2_a_100k'});
  const am2Dev = SubscriptionFixture({organization, plan: 'am2_f'});
  const am3Dev = SubscriptionFixture({organization, plan: 'am3_f'});
  const am3Biz = SubscriptionFixture({organization, plan: 'am3_business'});

  it('returns if a plan has performance', function () {
    expect(hasPerformance(mm2Biz.planDetails)).toBe(false);
    expect(hasPerformance(mm2Team.planDetails)).toBe(false);

    expect(hasPerformance(am1Biz.planDetails)).toBe(true);
    expect(hasPerformance(am1Team.planDetails)).toBe(true);

    expect(hasPerformance(am3Dev.planDetails)).toBe(true);
    expect(hasPerformance(am3Biz.planDetails)).toBe(true);
  });

  it('returns correct plan family', function () {
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

describe('getProductTrial', function () {
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

  it('returns current trial with latest end date', function () {
    const pt = getProductTrial(TEST_TRIALS, DataCategory.ERRORS);
    expect(pt?.reasonCode).toBe(1001);
  });

  it('returns available trial with longest days', function () {
    const pt = getProductTrial(TEST_TRIALS, DataCategory.TRANSACTIONS);
    expect(pt?.reasonCode).toBe(2002);
  });

  it('returns most recent ended trial', function () {
    const pt = getProductTrial(TEST_TRIALS, DataCategory.REPLAYS);
    expect(pt?.reasonCode).toBe(3002);
  });

  it('returns null trial when not available', function () {
    const pt = getProductTrial(TEST_TRIALS, DataCategory.ATTACHMENTS);
    expect(pt).toBeNull();
  });

  it('returns null trial when empty', function () {
    const pt = getProductTrial([], DataCategory.ATTACHMENTS);
    expect(pt).toBeNull();
  });

  it('returns null trial for null trials', function () {
    const pt = getProductTrial(null, DataCategory.ATTACHMENTS);
    expect(pt).toBeNull();
  });

  it('tests for trialPromptIsDismissed', function () {
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

describe('getActiveProductTrial', function () {
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

  it('returns current trial with latest end date for category', function () {
    const pt = getActiveProductTrial(TEST_TRIALS, DataCategory.ERRORS);
    expect(pt?.reasonCode).toBe(1001);
  });

  it('returns null when no active trial for the category', function () {
    // none started
    const transaction_pt = getActiveProductTrial(TEST_TRIALS, DataCategory.TRANSACTIONS);
    expect(transaction_pt).toBeNull();

    // all expired
    const replay_pt = getActiveProductTrial(TEST_TRIALS, DataCategory.REPLAYS);
    expect(replay_pt).toBeNull();
  });

  it('returns null trial when no trials for category', function () {
    const pt = getProductTrial(TEST_TRIALS, DataCategory.ATTACHMENTS);
    expect(pt).toBeNull();
  });

  it('returns null trial when empty', function () {
    const pt = getProductTrial([], DataCategory.ERRORS);
    expect(pt).toBeNull();
  });

  it('returns null trial for null trials', function () {
    const pt = getProductTrial(null, DataCategory.ERRORS);
    expect(pt).toBeNull();
  });
});

describe('isNewPayingCustomer', function () {
  it('returns true for customer on free plan', function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({organization, isFree: true});
    expect(isNewPayingCustomer(subscription, organization)).toBe(true);
  });

  it('returns true for customer on trial plan', function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_t',
      isFree: false,
    });
    expect(isNewPayingCustomer(subscription, organization)).toBe(true);
  });

  it('returns true for customer with partner migration feature', function () {
    const organization = OrganizationFixture({features: ['partner-billing-migration']});
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
      isFree: false,
    });
    expect(isNewPayingCustomer(subscription, organization)).toBe(true);
  });

  it('returns false for customer on plan trial', function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
      isTrial: true,
      isFree: false,
    });
    expect(isNewPayingCustomer(subscription, organization)).toBe(false);
  });

  it('returns false for paying customer', function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
      isFree: false,
    });
    expect(isNewPayingCustomer(subscription, organization)).toBe(false);
  });
});

describe('getOnDemandCategories', function () {
  const plan = PlanDetailsLookupFixture('am1_business')!;
  it('filters out unconfigurable categories for per-category budget mode', function () {
    const categories = getOnDemandCategories({
      plan,
      budgetMode: OnDemandBudgetMode.PER_CATEGORY,
    });
    expect(categories).toHaveLength(plan.onDemandCategories.length - 2);
    expect(categories).not.toContain(DataCategory.SEER_SCANNER);
    expect(categories).not.toContain(DataCategory.SEER_AUTOFIX);
  });

  it('does not filter out any categories for shared budget mode', function () {
    const categories = getOnDemandCategories({
      plan,
      budgetMode: OnDemandBudgetMode.SHARED,
    });
    expect(categories).toHaveLength(plan.onDemandCategories.length);
    expect(categories).toEqual(plan.onDemandCategories);
  });
});

describe('isEnterprise', function () {
  it('returns true for enterprise plans', function () {
    expect(isEnterprise('e1')).toBe(true);
    expect(isEnterprise('enterprise')).toBe(true);
    expect(isEnterprise('am1_business_ent')).toBe(true);
    expect(isEnterprise('am2_team_ent_auf')).toBe(true);
    expect(isEnterprise('am3_business_ent_ds_auf')).toBe(true);
  });

  it('returns false for non-enterprise plans', function () {
    expect(isEnterprise('_e1')).toBe(false);
    expect(isEnterprise('_enterprise')).toBe(false);
    expect(isEnterprise('am1_business')).toBe(false);
    expect(isEnterprise('am2_team')).toBe(false);
  });
});

describe('getBestActionToIncreaseEventLimits', function () {
  it('returns start trial for free plan', function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_f',
    });
    expect(getBestActionToIncreaseEventLimits(organization, subscription)).toBe(
      UsageAction.START_TRIAL
    );
  });

  it('returns add events for paid plan with usage exceeded', function () {
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

  it('returns nothing for business plan without usage exceeded', function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_business',
    });
    expect(getBestActionToIncreaseEventLimits(organization, subscription)).toBe('');
  });
});
