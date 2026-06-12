import {OrganizationFixture} from 'sentry-fixture/organization';

import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';

import {DataCategory} from 'sentry/types/core';

import {UNLIMITED_RESERVED} from 'getsentry/constants';
import {MILLISECONDS_IN_HOUR} from 'getsentry/utils/billing';
import {
  calculateSeerUserSpend,
  formatCategoryQuantityWithDisplayName,
  getPlanCategoryName,
  getSingularCategoryName,
  isByteCategory,
  isEmergeCategory,
  sortCategories,
  sortCategoriesWithKeys,
} from 'getsentry/utils/dataCategory';

describe('sortCategories', () => {
  const organization = OrganizationFixture();
  it('returns sorted categories', () => {
    const sub = SubscriptionFixture({organization, plan: 'am1_team'});
    expect(sortCategories(sub.categories)).toStrictEqual([
      MetricHistoryFixture({
        category: DataCategory.ERRORS,
        reserved: 50_000,
        prepaid: 50_000,
        order: 1,
      }),
      MetricHistoryFixture({
        category: DataCategory.TRANSACTIONS,
        reserved: 100_000,
        prepaid: 100_000,
        order: 2,
      }),
      MetricHistoryFixture({
        category: DataCategory.REPLAYS,
        reserved: 500,
        prepaid: 500,
        order: 4,
      }),
      MetricHistoryFixture({
        category: DataCategory.MONITOR_SEATS,
        reserved: 1,
        prepaid: 1,
        order: 7,
      }),
      MetricHistoryFixture({
        category: DataCategory.UPTIME,
        reserved: 1,
        prepaid: 1,
        order: 8,
      }),
      MetricHistoryFixture({
        category: DataCategory.ATTACHMENTS,
        reserved: 1,
        prepaid: 1,
        order: 9,
      }),
      MetricHistoryFixture({
        category: DataCategory.SEER_AUTOFIX,
        reserved: 0,
        prepaid: 0,
        order: 14,
      }),
      MetricHistoryFixture({
        category: DataCategory.SEER_SCANNER,
        reserved: 0,
        prepaid: 0,
        order: 15,
      }),
      MetricHistoryFixture({
        category: DataCategory.SEER_USER,
        reserved: 0,
        prepaid: 0,
        order: 16,
      }),
      MetricHistoryFixture({
        category: DataCategory.SIZE_ANALYSIS,
        reserved: 100,
        prepaid: 100,
        order: 17,
      }),
      MetricHistoryFixture({
        category: DataCategory.INSTALLABLE_BUILD,
        reserved: 25000,
        prepaid: 25000,
        order: 18,
      }),
    ]);
  });

  it('returns sorted categories with keys', () => {
    const sub = SubscriptionFixture({organization, plan: 'am1_team'});
    expect(sortCategoriesWithKeys(sub.categories)).toStrictEqual([
      [
        'errors',
        MetricHistoryFixture({
          category: DataCategory.ERRORS,
          reserved: 50_000,
          prepaid: 50_000,
          order: 1,
        }),
      ],
      [
        'transactions',
        MetricHistoryFixture({
          category: DataCategory.TRANSACTIONS,
          reserved: 100_000,
          prepaid: 100_000,
          order: 2,
        }),
      ],
      [
        'replays',
        MetricHistoryFixture({
          category: DataCategory.REPLAYS,
          reserved: 500,
          prepaid: 500,
          order: 4,
        }),
      ],
      [
        'monitorSeats',
        MetricHistoryFixture({
          category: DataCategory.MONITOR_SEATS,
          reserved: 1,
          prepaid: 1,
          order: 7,
        }),
      ],
      [
        'uptime',
        MetricHistoryFixture({
          category: DataCategory.UPTIME,
          reserved: 1,
          prepaid: 1,
          order: 8,
        }),
      ],
      [
        'attachments',
        MetricHistoryFixture({
          category: DataCategory.ATTACHMENTS,
          reserved: 1,
          prepaid: 1,
          order: 9,
        }),
      ],
      [
        'seerAutofix',
        MetricHistoryFixture({
          category: DataCategory.SEER_AUTOFIX,
          reserved: 0,
          prepaid: 0,
          order: 14,
        }),
      ],
      [
        'seerScanner',
        MetricHistoryFixture({
          category: DataCategory.SEER_SCANNER,
          reserved: 0,
          prepaid: 0,
          order: 15,
        }),
      ],
      [
        'seerUsers',
        MetricHistoryFixture({
          category: DataCategory.SEER_USER,
          reserved: 0,
          prepaid: 0,
          order: 16,
        }),
      ],
      [
        'sizeAnalyses',
        MetricHistoryFixture({
          category: DataCategory.SIZE_ANALYSIS,
          reserved: 100,
          prepaid: 100,
          order: 17,
        }),
      ],
      [
        'installableBuilds',
        MetricHistoryFixture({
          category: DataCategory.INSTALLABLE_BUILD,
          reserved: 25000,
          prepaid: 25000,
          order: 18,
        }),
      ],
    ]);
  });
});

describe('getPlanCategoryName', () => {
  const plan = PlanDetailsLookupFixture('am3_team');

  it('should capitalize category', () => {
    expect(getPlanCategoryName({plan, category: DataCategory.TRANSACTIONS})).toBe(
      'Transactions'
    );
    expect(getPlanCategoryName({plan, category: DataCategory.ERRORS})).toBe('Errors');
    expect(getPlanCategoryName({plan, category: DataCategory.REPLAYS})).toBe('Replays');
    expect(getPlanCategoryName({plan, category: DataCategory.SPANS})).toBe('Spans');
    expect(getPlanCategoryName({plan, category: DataCategory.PROFILE_DURATION})).toBe(
      'Continuous profile hours'
    );
    expect(getPlanCategoryName({plan, category: DataCategory.MONITOR_SEATS})).toBe(
      'Cron monitors'
    );
  });

  it('should title case category if specified', () => {
    expect(
      getPlanCategoryName({plan, category: DataCategory.MONITOR_SEATS, title: true})
    ).toBe('Cron Monitors');
    expect(getPlanCategoryName({plan, category: DataCategory.ERRORS, title: true})).toBe(
      'Errors'
    );
  });

  it('should display spans as accepted spans for DS', () => {
    expect(
      getPlanCategoryName({
        plan,
        category: DataCategory.SPANS,
        hadCustomDynamicSampling: true,
      })
    ).toBe('Accepted spans');
  });
});

describe('getSingularCategoryName', () => {
  const plan = PlanDetailsLookupFixture('am3_team');

  it('should capitalize category', () => {
    expect(getSingularCategoryName({plan, category: DataCategory.TRANSACTIONS})).toBe(
      'Transaction'
    );
    expect(getSingularCategoryName({plan, category: DataCategory.PROFILE_DURATION})).toBe(
      'Continuous profile hour'
    );
    expect(getSingularCategoryName({plan, category: DataCategory.MONITOR_SEATS})).toBe(
      'Cron monitor'
    );
  });

  it('should title case category if specified', () => {
    expect(
      getSingularCategoryName({plan, category: DataCategory.MONITOR_SEATS, title: true})
    ).toBe('Cron Monitor');
    expect(
      getSingularCategoryName({plan, category: DataCategory.ERRORS, title: true})
    ).toBe('Error');
  });

  it('should display spans as accepted spans for DS', () => {
    expect(
      getPlanCategoryName({
        plan,
        category: DataCategory.SPANS,
        hadCustomDynamicSampling: true,
      })
    ).toBe('Accepted spans');
  });
});

describe('isByteCategory', () => {
  it('verifies isByteCategory function handles ATTACHMENTS, LOG_BYTE, and TRACE_METRIC_BYTE', () => {
    expect(isByteCategory(DataCategory.ATTACHMENTS)).toBe(true);
    expect(isByteCategory(DataCategory.LOG_BYTE)).toBe(true);
    expect(isByteCategory(DataCategory.TRACE_METRIC_BYTE)).toBe(true);
    expect(isByteCategory(DataCategory.ERRORS)).toBe(false);
    expect(isByteCategory(DataCategory.TRANSACTIONS)).toBe(false);
  });
});

describe('isEmergeCategory', () => {
  it('returns true for SIZE_ANALYSIS and INSTALLABLE_BUILD', () => {
    expect(isEmergeCategory(DataCategory.SIZE_ANALYSIS)).toBe(true);
    expect(isEmergeCategory(DataCategory.INSTALLABLE_BUILD)).toBe(true);
  });

  it('returns false for other categories', () => {
    expect(isEmergeCategory(DataCategory.ERRORS)).toBe(false);
    expect(isEmergeCategory(DataCategory.TRANSACTIONS)).toBe(false);
    expect(isEmergeCategory(DataCategory.ATTACHMENTS)).toBe(false);
    expect(isEmergeCategory(DataCategory.REPLAYS)).toBe(false);
  });
});

describe('formatCategoryQuantityWithDisplayName', () => {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization, plan: 'am3_team'});

  it('formats profiling categories with hours', () => {
    expect(
      formatCategoryQuantityWithDisplayName({
        dataCategory: DataCategory.PROFILE_DURATION,
        quantity: MILLISECONDS_IN_HOUR,
        formattedQuantity: '1',
        subscription,
        options: {
          capitalize: false,
        },
      })
    ).toBe('1 hour');

    expect(
      formatCategoryQuantityWithDisplayName({
        dataCategory: DataCategory.PROFILE_DURATION,
        quantity: MILLISECONDS_IN_HOUR * 2,
        formattedQuantity: '2',
        subscription,
        options: {
          capitalize: false,
        },
      })
    ).toBe('2 hours');

    expect(
      formatCategoryQuantityWithDisplayName({
        dataCategory: DataCategory.PROFILE_DURATION,
        quantity: MILLISECONDS_IN_HOUR * 1.5,
        formattedQuantity: '1.5',
        subscription,
        options: {
          capitalize: false,
        },
      })
    ).toBe('1.5 hours');

    expect(
      formatCategoryQuantityWithDisplayName({
        dataCategory: DataCategory.PROFILE_DURATION,
        quantity: MILLISECONDS_IN_HOUR * 2,
        formattedQuantity: '2',
        subscription,
        options: {
          title: true,
        },
      })
    ).toBe('2 Hours');

    expect(
      formatCategoryQuantityWithDisplayName({
        dataCategory: DataCategory.PROFILE_DURATION,
        quantity: UNLIMITED_RESERVED,
        formattedQuantity: 'Unlimited',
        subscription,
        options: {
          capitalize: false,
        },
      })
    ).toBe('Unlimited hours');
  });

  it('formats other categories with display names', () => {
    expect(
      formatCategoryQuantityWithDisplayName({
        dataCategory: DataCategory.SEER_USER,
        quantity: 1,
        formattedQuantity: '1',
        subscription,
        options: {
          capitalize: false,
        },
      })
    ).toBe('1 active contributor');

    expect(
      formatCategoryQuantityWithDisplayName({
        dataCategory: DataCategory.SEER_USER,
        quantity: 2,
        formattedQuantity: '2',
        subscription,
        options: {
          capitalize: false,
        },
      })
    ).toBe('2 active contributors');

    expect(
      formatCategoryQuantityWithDisplayName({
        dataCategory: DataCategory.SEER_USER,
        quantity: 2,
        formattedQuantity: '2',
        subscription,
        options: {
          capitalize: true,
        },
      })
    ).toBe('2 Active contributors');

    expect(
      formatCategoryQuantityWithDisplayName({
        dataCategory: DataCategory.SEER_USER,
        quantity: 2,
        formattedQuantity: '2',
        subscription,
        options: {
          title: true,
        },
      })
    ).toBe('2 Active Contributors');

    expect(
      formatCategoryQuantityWithDisplayName({
        dataCategory: DataCategory.SEER_USER,
        quantity: UNLIMITED_RESERVED,
        formattedQuantity: 'Unlimited',
        subscription,
        options: {
          capitalize: false,
        },
      })
    ).toBe('Unlimited active contributors');
  });
});

describe('calculateSeerUserSpend', () => {
  it('returns 0 if the category is not SEER_USER', () => {
    expect(
      calculateSeerUserSpend(
        MetricHistoryFixture({
          category: DataCategory.ERRORS,
          reserved: 0,
          usage: 100,
          prepaid: 0,
        })
      )
    ).toBe(0);
  });

  it('returns 0 if the reserved is not 0', () => {
    expect(
      calculateSeerUserSpend(
        MetricHistoryFixture({
          category: DataCategory.SEER_USER,
          reserved: 100,
          usage: 100,
          prepaid: 100,
        })
      )
    ).toBe(0);
    expect(
      calculateSeerUserSpend(
        MetricHistoryFixture({
          category: DataCategory.SEER_USER,
          reserved: UNLIMITED_RESERVED,
          usage: 100,
          prepaid: UNLIMITED_RESERVED,
        })
      )
    ).toBe(0);
  });

  it('returns the spend if the reserved is 0', () => {
    expect(
      calculateSeerUserSpend(
        MetricHistoryFixture({
          category: DataCategory.SEER_USER,
          reserved: 0,
          usage: 100,
          prepaid: 0,
        })
      )
    ).toBe(4000_00);
    expect(
      calculateSeerUserSpend(
        MetricHistoryFixture({
          category: DataCategory.SEER_USER,
          reserved: 0,
          usage: 100,
          prepaid: 50,
        })
      )
    ).toBe(2000_00);
  });
});
