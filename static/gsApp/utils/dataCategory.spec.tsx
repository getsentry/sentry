import {OrganizationFixture} from 'sentry-fixture/organization';

import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {
  DynamicSamplingReservedBudgetFixture,
  PendingReservedBudgetFixture,
  ReservedBudgetFixture,
  ReservedBudgetMetricHistoryFixture,
  SeerReservedBudgetFixture,
} from 'getsentry-test/fixtures/reservedBudget';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';

import {DataCategory} from 'sentry/types/core';

import {UNLIMITED_RESERVED} from 'getsentry/constants';
import {MILLISECONDS_IN_HOUR} from 'getsentry/utils/billing';
import {
  calculateSeerUserSpend,
  formatCategoryQuantityWithDisplayName,
  getPlanCategoryName,
  getReservedBudgetDisplayName,
  getSingularCategoryName,
  hasCategoryFeature,
  isByteCategory,
  listDisplayNames,
  sortCategories,
  sortCategoriesWithKeys,
} from 'getsentry/utils/dataCategory';

describe('hasCategoryFeature', () => {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization, plan: 'mm2_b_100k'});

  it('returns am1 plan categories', () => {
    const sub = SubscriptionFixture({organization, plan: 'am1_team'});
    expect(hasCategoryFeature(DataCategory.ERRORS, sub, organization)).toBe(true);
    expect(hasCategoryFeature(DataCategory.TRANSACTIONS, sub, organization)).toBe(true);
    expect(hasCategoryFeature(DataCategory.ATTACHMENTS, sub, organization)).toBe(true);
    expect(hasCategoryFeature(DataCategory.REPLAYS, sub, organization)).toBe(true);
    expect(hasCategoryFeature(DataCategory.MONITOR_SEATS, sub, organization)).toBe(true);
  });

  it('returns mm2 plan categories', () => {
    expect(hasCategoryFeature(DataCategory.ERRORS, subscription, organization)).toBe(
      true
    );
    expect(
      hasCategoryFeature(DataCategory.TRANSACTIONS, subscription, organization)
    ).toBe(false);
    expect(hasCategoryFeature(DataCategory.ATTACHMENTS, subscription, organization)).toBe(
      false
    );
    expect(hasCategoryFeature(DataCategory.REPLAYS, subscription, organization)).toBe(
      false
    );
    expect(
      hasCategoryFeature(DataCategory.MONITOR_SEATS, subscription, organization)
    ).toBe(false);
  });

  it('returns mm1 plan categories', () => {
    const sub = SubscriptionFixture({organization, plan: 's1'});
    expect(hasCategoryFeature(DataCategory.ERRORS, sub, organization)).toBe(true);
    expect(hasCategoryFeature(DataCategory.TRANSACTIONS, sub, organization)).toBe(false);
    expect(hasCategoryFeature(DataCategory.ATTACHMENTS, sub, organization)).toBe(false);
    expect(hasCategoryFeature(DataCategory.REPLAYS, subscription, organization)).toBe(
      false
    );
    expect(
      hasCategoryFeature(DataCategory.MONITOR_SEATS, subscription, organization)
    ).toBe(false);
  });

  it('returns org has transactions feature', () => {
    const org = {...organization, features: ['performance-view']};
    expect(hasCategoryFeature(DataCategory.ERRORS, subscription, org)).toBe(true);
    expect(hasCategoryFeature(DataCategory.TRANSACTIONS, subscription, org)).toBe(true);
    expect(hasCategoryFeature(DataCategory.ATTACHMENTS, subscription, org)).toBe(false);
    expect(hasCategoryFeature(DataCategory.REPLAYS, subscription, org)).toBe(false);
    expect(hasCategoryFeature(DataCategory.MONITOR_SEATS, subscription, org)).toBe(false);
  });

  it('returns org has attachments feature', () => {
    const org = {...organization, features: ['event-attachments']};
    expect(hasCategoryFeature(DataCategory.ERRORS, subscription, org)).toBe(true);
    expect(hasCategoryFeature(DataCategory.TRANSACTIONS, subscription, org)).toBe(false);
    expect(hasCategoryFeature(DataCategory.ATTACHMENTS, subscription, org)).toBe(true);
    expect(hasCategoryFeature(DataCategory.REPLAYS, subscription, org)).toBe(false);
    expect(hasCategoryFeature(DataCategory.MONITOR_SEATS, subscription, org)).toBe(false);
  });

  it('returns org has replays feature', () => {
    const org = {...organization, features: ['session-replay']};
    expect(hasCategoryFeature(DataCategory.ERRORS, subscription, org)).toBe(true);
    expect(hasCategoryFeature(DataCategory.TRANSACTIONS, subscription, org)).toBe(false);
    expect(hasCategoryFeature(DataCategory.ATTACHMENTS, subscription, org)).toBe(false);
    expect(hasCategoryFeature(DataCategory.REPLAYS, subscription, org)).toBe(true);
    expect(hasCategoryFeature(DataCategory.MONITOR_SEATS, subscription, org)).toBe(false);
  });

  it('returns org has transactions and attachments features', () => {
    const org = {...organization, features: ['performance-view', 'event-attachments']};
    expect(hasCategoryFeature(DataCategory.ERRORS, subscription, org)).toBe(true);
    expect(hasCategoryFeature(DataCategory.TRANSACTIONS, subscription, org)).toBe(true);
    expect(hasCategoryFeature(DataCategory.ATTACHMENTS, subscription, org)).toBe(true);
    expect(hasCategoryFeature(DataCategory.REPLAYS, subscription, org)).toBe(false);
    expect(hasCategoryFeature(DataCategory.REPLAYS, subscription, org)).toBe(false);
  });

  it('returns org does not have unknown feature', () => {
    const org = {...organization, features: []};
    expect(hasCategoryFeature('unknown' as DataCategory, subscription, org)).toBe(false);
  });
});

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

describe('getReservedBudgetDisplayName', () => {
  const am3DsPlan = PlanDetailsLookupFixture('am3_business_ent_ds_auf');

  it('should use the reserved budget name if it exists', () => {
    expect(
      getReservedBudgetDisplayName({
        plan: am3DsPlan,
        reservedBudget: DynamicSamplingReservedBudgetFixture({}),
      })
    ).toBe('spans budget');

    expect(
      getReservedBudgetDisplayName({
        plan: am3DsPlan,
        reservedBudget: SeerReservedBudgetFixture({}),
        shouldTitleCase: true,
      })
    ).toBe('Seer Budget');
  });

  it('should try to find the reserved budget name if it does not exist', () => {
    expect(
      getReservedBudgetDisplayName({
        plan: am3DsPlan,
        pendingReservedBudget: PendingReservedBudgetFixture({
          categories: {
            [DataCategory.SPANS]: true,
            [DataCategory.SPANS_INDEXED]: true,
          },
          reservedBudget: 1000,
        }),
      })
    ).toBe('spans budget');
  });

  it('should oxfordize the budget categories if no name exists or can be found', () => {
    expect(
      getReservedBudgetDisplayName({
        plan: am3DsPlan,
        pendingReservedBudget: PendingReservedBudgetFixture({
          categories: {
            [DataCategory.SPANS_INDEXED]: true,
          },
          reservedBudget: 1000,
        }),
      })
    ).toBe('stored spans budget');

    expect(
      getReservedBudgetDisplayName({
        plan: am3DsPlan,
        reservedBudget: ReservedBudgetFixture({
          categories: {
            [DataCategory.REPLAYS]: ReservedBudgetMetricHistoryFixture({}),
          },
          dataCategories: [DataCategory.REPLAYS],
        }),
      })
    ).toBe('replays budget');

    expect(
      getReservedBudgetDisplayName({
        plan: am3DsPlan,
        pendingReservedBudget: PendingReservedBudgetFixture({
          categories: {
            [DataCategory.ERRORS]: true,
            [DataCategory.SPANS]: true,
            [DataCategory.REPLAYS]: true,
            [DataCategory.MONITOR_SEATS]: true,
          },
          reservedBudget: 1000,
        }),
      })
    ).toBe('cron monitors, errors, replays, and spans budget'); // alphabetically sorted

    expect(
      getReservedBudgetDisplayName({
        plan: am3DsPlan,
        reservedBudget: ReservedBudgetFixture({
          categories: {
            [DataCategory.ATTACHMENTS]: ReservedBudgetMetricHistoryFixture({}),
            [DataCategory.UPTIME]: ReservedBudgetMetricHistoryFixture({}),
          },
          dataCategories: [DataCategory.ATTACHMENTS, DataCategory.UPTIME],
        }),
      })
    ).toBe('attachments and uptime monitors budget');
  });
});

describe('listDisplayNames', () => {
  const plan = PlanDetailsLookupFixture('am3_business_ent_ds_auf');

  it('should list categories in order given', () => {
    expect(
      listDisplayNames({
        plan: plan!,
        categories: [
          DataCategory.SPANS,
          DataCategory.TRANSACTIONS,
          DataCategory.ERRORS,
          DataCategory.REPLAYS,
          DataCategory.MONITOR_SEATS,
          DataCategory.ATTACHMENTS,
        ],
      })
    ).toBe('spans, transactions, errors, replays, cron monitors, and attachments');
  });

  it('should hide stored spans for no DS', () => {
    expect(
      listDisplayNames({
        plan: plan!,
        categories: plan!.checkoutCategories,
        hadCustomDynamicSampling: false,
      })
    ).toBe(
      'errors, replays, attachments, cron monitors, spans, uptime monitors, and logs'
    );
  });

  it('should include stored spans and use accepted spans for DS', () => {
    expect(
      listDisplayNames({
        plan: plan!,
        categories: plan!.checkoutCategories,
        hadCustomDynamicSampling: true,
      })
    ).toBe(
      'errors, replays, attachments, cron monitors, accepted spans, uptime monitors, logs, and stored spans'
    );
  });
});

describe('isByteCategory', () => {
  it('verifies isByteCategory function handles both ATTACHMENTS and LOG_BYTE', () => {
    expect(isByteCategory(DataCategory.ATTACHMENTS)).toBe(true);
    expect(isByteCategory(DataCategory.LOG_BYTE)).toBe(true);
    expect(isByteCategory(DataCategory.ERRORS)).toBe(false);
    expect(isByteCategory(DataCategory.TRANSACTIONS)).toBe(false);
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
