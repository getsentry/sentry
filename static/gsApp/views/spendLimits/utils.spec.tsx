import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  InvoicedSubscriptionFixture,
  SubscriptionFixture,
} from 'getsentry-test/fixtures/subscription';

import {DataCategory} from 'sentry/types/core';

import {OnDemandBudgetMode, type OnDemandBudgets} from 'getsentry/types';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import {
  exceedsInvoicedBudgetLimit,
  getOnDemandBudget,
  getTotalBudget,
  parseOnDemandBudgetsFromSubscription,
  trackOnDemandBudgetAnalytics,
} from 'getsentry/views/spendLimits/utils';

describe('parseOnDemandBudgetsFromSubscription', () => {
  it('returns per-category budget for non-AM plans - with on-demand budget', () => {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'mm2_f',
      onDemandMaxSpend: 123,
    });

    const ondemandBudgets = parseOnDemandBudgetsFromSubscription(subscription);
    expect(ondemandBudgets).toEqual({
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 123,
    });
  });

  it('returns shared on-demand budget for non-AM plans - without on-demand budget', () => {
    const organization = OrganizationFixture();
    let subscription = SubscriptionFixture({
      organization,
      plan: 'mm2_f',
      onDemandMaxSpend: 0,
    });

    let ondemandBudgets = parseOnDemandBudgetsFromSubscription(subscription);
    expect(ondemandBudgets).toEqual({
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 0,
    });

    // omitted onDemandMaxSpend
    subscription = SubscriptionFixture({organization, plan: 'mm2_f'});

    ondemandBudgets = parseOnDemandBudgetsFromSubscription(subscription);
    expect(ondemandBudgets).toEqual({
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 0,
    });
  });

  it('returns shared on-demand budget for AM plans', () => {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_business',
      planTier: 'am1',
      onDemandMaxSpend: 123,
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 123,
        onDemandSpendUsed: 0,
      },
    });

    const ondemandBudgets = parseOnDemandBudgetsFromSubscription(subscription);
    expect(ondemandBudgets).toEqual({
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 123,
    });
  });

  it('returns shared on-demand budget for AM plans - without on-demand budget', () => {
    const organization = OrganizationFixture();
    let subscription = SubscriptionFixture({
      organization,
      plan: 'am1_business',
      planTier: 'am1',
      onDemandMaxSpend: 0,
      onDemandBudgets: {
        enabled: false,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 0,
        onDemandSpendUsed: 0,
      },
    });

    let ondemandBudgets = parseOnDemandBudgetsFromSubscription(subscription);
    expect(ondemandBudgets).toEqual({
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 0,
    });

    // missing onDemandBudgets
    subscription = SubscriptionFixture({
      organization,
      plan: 'am1_business',
      planTier: 'am1',
      onDemandMaxSpend: 0,
    });

    ondemandBudgets = parseOnDemandBudgetsFromSubscription(subscription);
    expect(ondemandBudgets).toEqual({
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 0,
    });

    // missing onDemandBudgets and onDemandMaxSpend
    subscription = SubscriptionFixture({
      organization,
      plan: 'am1_business',
      planTier: 'am1',
    });

    ondemandBudgets = parseOnDemandBudgetsFromSubscription(subscription);
    expect(ondemandBudgets).toEqual({
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 0,
    });
  });

  it('returns per-category on-demand budget for AM plans', () => {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_business',
      planTier: 'am1',
      onDemandMaxSpend: 100 + 200 + 300,
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.PER_CATEGORY,
        budgets: {
          errors: 100,
          transactions: 200,
          attachments: 300,
          replays: 0,
          monitorSeats: 400,
          uptime: 500,
          profileDuration: 0,
          profileDurationUI: 0,
          logBytes: 0,
        },
        usedSpends: {
          errors: 0,
          transactions: 0,
          attachments: 0,
          replays: 0,
          monitorSeats: 0,
          uptime: 0,
          profileDuration: 0,
          profileDurationUI: 0,
        },
      },
    });
    subscription.categories.errors!.reserved = 200000;
    subscription.categories.transactions!.reserved = 250000;
    subscription.categories.attachments!.reserved = 25;
    subscription.categories.monitorSeats!.reserved = 1;

    const ondemandBudgets = parseOnDemandBudgetsFromSubscription(subscription);
    expect(ondemandBudgets).toEqual({
      budgetMode: OnDemandBudgetMode.PER_CATEGORY,
      budgets: {
        errors: 100,
        transactions: 200,
        attachments: 300,
        replays: 0,
        monitorSeats: 400,
        uptime: 500,
        profileDuration: 0,
        profileDurationUI: 0,
        logBytes: 0,
      },
    });
  });

  it('reconstructs shared on-demand budget if onDemandBudgets is missing', () => {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_business',
      planTier: 'am1',
      onDemandMaxSpend: 123,
    });
    subscription.categories.errors!.reserved = 200000;
    subscription.categories.transactions!.reserved = 250000;
    subscription.categories.attachments!.reserved = 25;

    const ondemandBudgets = parseOnDemandBudgetsFromSubscription(subscription);
    expect(ondemandBudgets).toEqual({
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 123,
    });
  });
});

describe('getTotalBudget', () => {
  it('returns total on-demand budget for non-AM plans - with on-demand budget', () => {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'mm2_f',
      onDemandMaxSpend: 123,
    });

    const actualTotalBudget = getTotalBudget(
      parseOnDemandBudgetsFromSubscription(subscription)
    );
    expect(actualTotalBudget).toBe(123);
  });

  it('returns total on-demand budget for non-AM plans - without on-demand budget', () => {
    const organization = OrganizationFixture();
    let subscription = SubscriptionFixture({
      organization,
      plan: 'mm2_f',
      onDemandMaxSpend: 0,
    });

    let actualTotalBudget = getTotalBudget(
      parseOnDemandBudgetsFromSubscription(subscription)
    );
    expect(actualTotalBudget).toBe(0);

    // omitted onDemandMaxSpend
    subscription = SubscriptionFixture({organization, plan: 'mm2_f'});

    actualTotalBudget = getTotalBudget(
      parseOnDemandBudgetsFromSubscription(subscription)
    );
    expect(actualTotalBudget).toBe(0);
  });

  it('returns total budget of shared on-demand budget for AM plans', () => {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_business',
      planTier: 'am1',
      onDemandMaxSpend: 100 + 200 + 300,
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 123,
        onDemandSpendUsed: 0,
      },
    });

    const actualTotalBudget = getTotalBudget(
      parseOnDemandBudgetsFromSubscription(subscription)
    );
    expect(actualTotalBudget).toBe(123);
  });

  it('returns total budget of shared on-demand budget for AM plans - without on-demand budget', () => {
    const organization = OrganizationFixture();
    let subscription = SubscriptionFixture({
      organization,
      plan: 'am1_business',
      planTier: 'am1',
      onDemandMaxSpend: 0,
      onDemandBudgets: {
        enabled: false,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 0,
        onDemandSpendUsed: 0,
      },
    });

    let actualTotalBudget = getTotalBudget(
      parseOnDemandBudgetsFromSubscription(subscription)
    );
    expect(actualTotalBudget).toBe(0);

    // missing onDemandBudgets
    subscription = SubscriptionFixture({
      organization,
      plan: 'am1_business',
      planTier: 'am1',
      onDemandMaxSpend: 0,
    });

    actualTotalBudget = getTotalBudget(
      parseOnDemandBudgetsFromSubscription(subscription)
    );
    expect(actualTotalBudget).toBe(0);

    // missing onDemandBudgets and onDemandMaxSpend
    subscription = SubscriptionFixture({
      organization,
      plan: 'am1_business',
      planTier: 'am1',
    });

    actualTotalBudget = getTotalBudget(
      parseOnDemandBudgetsFromSubscription(subscription)
    );
    expect(actualTotalBudget).toBe(0);
  });

  it('returns total budget of per-category on-demand budget for AM plans', () => {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_business',
      planTier: 'am1',
      onDemandMaxSpend: 100 + 200 + 300,
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.PER_CATEGORY,
        budgets: {errors: 100, transactions: 200, attachments: 300, uptime: 400},
        usedSpends: {errors: 0, transactions: 0, attachments: 0, replays: 0},
      },
    });
    subscription.categories.errors!.reserved = 200000;
    subscription.categories.transactions!.reserved = 250000;
    subscription.categories.attachments!.reserved = 25;

    const actualTotalBudget = getTotalBudget(
      parseOnDemandBudgetsFromSubscription(subscription)
    );
    expect(actualTotalBudget).toEqual(100 + 200 + 300 + 400);
  });

  it('returns total on-demand budget if onDemandBudgets is missing', () => {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_business',
      planTier: 'am1',
      onDemandMaxSpend: 123,
    });

    const actualTotalBudget = getTotalBudget(
      parseOnDemandBudgetsFromSubscription(subscription)
    );
    expect(actualTotalBudget).toBe(123);
  });
});

describe('exceedsInvoicedBudgetLimit', () => {
  it('returns false for non-invoiced subscription', () => {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({organization});
    const ondemandBudget: OnDemandBudgets = {
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 3_000_000,
    };
    expect(exceedsInvoicedBudgetLimit(subscription, ondemandBudget)).toBe(false);
  });

  it('returns false for invoiced subscriptions without flag', () => {
    const organization = OrganizationFixture();
    const subscription = InvoicedSubscriptionFixture({organization});
    const ondemandBudget: OnDemandBudgets = {
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 0,
    };
    expect(exceedsInvoicedBudgetLimit(subscription, ondemandBudget)).toBe(false);
  });

  it('returns false for invoiced subscriptions with budget and with onDemandInvoiced flag', () => {
    // no limit for CC-invoiced on-demand
    const organization = OrganizationFixture();
    const subscription = InvoicedSubscriptionFixture({
      organization,
      onDemandInvoiced: true,
      supportsOnDemand: true,
    });
    const ondemandBudget: OnDemandBudgets = {
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 1000,
    };
    expect(exceedsInvoicedBudgetLimit(subscription, ondemandBudget)).toBe(false);
  });

  it('returns true for invoiced subscriptions with budget and without any flags', () => {
    // if an invoiced customer is somehow setting OD budget without either onDemandInvoicedManual or onDemandInvoiced, always stop them
    const organization = OrganizationFixture();
    const subscription = InvoicedSubscriptionFixture({organization});
    const ondemandBudget: OnDemandBudgets = {
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 1000,
    };
    expect(exceedsInvoicedBudgetLimit(subscription, ondemandBudget)).toBe(true);
  });

  it('returns false for invoiced subscriptions with flag and budget lower than or equal to 5x custom price', () => {
    const organization = OrganizationFixture();
    const subscription = InvoicedSubscriptionFixture({
      organization,
      onDemandInvoicedManual: true,
      supportsOnDemand: true,
      customPrice: 12000,
    });
    const ondemandBudget: OnDemandBudgets = {
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 5000,
    };
    expect(exceedsInvoicedBudgetLimit(subscription, ondemandBudget)).toBe(false);

    ondemandBudget.sharedMaxBudget = 800;
    expect(exceedsInvoicedBudgetLimit(subscription, ondemandBudget)).toBe(false);
  });

  it('returns false for invoiced subscriptions with flag and budget lower than or equal to 5x acv', () => {
    const organization = OrganizationFixture();
    const subscription = InvoicedSubscriptionFixture({
      organization,
      onDemandInvoicedManual: true,
      supportsOnDemand: true,
      acv: 12000,
    });
    const ondemandBudget: OnDemandBudgets = {
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 5000,
    };
    expect(exceedsInvoicedBudgetLimit(subscription, ondemandBudget)).toBe(false);

    ondemandBudget.sharedMaxBudget = 800;
    expect(exceedsInvoicedBudgetLimit(subscription, ondemandBudget)).toBe(false);
  });

  it('returns true for invoiced subscriptions with flag and budget greater than 5x custom price', () => {
    const organization = OrganizationFixture();
    const subscription = InvoicedSubscriptionFixture({
      organization,
      onDemandInvoicedManual: true,
      supportsOnDemand: true,
      customPrice: 12000,
    });
    const ondemandBudget: OnDemandBudgets = {
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 5001,
    };
    expect(exceedsInvoicedBudgetLimit(subscription, ondemandBudget)).toBe(true);
  });

  it('returns false for invoiced subscriptions with flag and budget greater than 5x acv', () => {
    const organization = OrganizationFixture();
    const subscription = InvoicedSubscriptionFixture({
      organization,
      onDemandInvoicedManual: true,
      supportsOnDemand: true,
      acv: 12000,
    });
    const ondemandBudget: OnDemandBudgets = {
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 5001,
    };
    expect(exceedsInvoicedBudgetLimit(subscription, ondemandBudget)).toBe(true);
  });
});

describe('getOnDemandBudget', () => {
  it('returns 0 for category when in per-category mode without explicit budget', () => {
    const budget: OnDemandBudgets = {
      budgetMode: OnDemandBudgetMode.PER_CATEGORY,
      budgets: {
        errors: 100,
        transactions: 200,
        attachments: 300,
        replays: 0,
        monitorSeats: 0,
        profileDuration: 0,
        profileDurationUI: 0,
        uptime: 0,
      },
    };

    expect(getOnDemandBudget(budget, DataCategory.LOG_BYTE)).toBe(0);
  });

  it('returns correct value for LOG_BYTE category when in per-category mode with explicit budget', () => {
    const budget: OnDemandBudgets = {
      budgetMode: OnDemandBudgetMode.PER_CATEGORY,
      budgets: {
        errors: 100,
        transactions: 200,
        attachments: 300,
        replays: 0,
        monitorSeats: 0,
        profileDuration: 0,
        profileDurationUI: 0,
        uptime: 0,
        logBytes: 500,
      },
    };

    expect(getOnDemandBudget(budget, DataCategory.LOG_BYTE)).toBe(500);
  });

  it('returns total budget for LOG_BYTE category when in shared mode', () => {
    const budget: OnDemandBudgets = {
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 1000,
    };

    expect(getOnDemandBudget(budget, DataCategory.LOG_BYTE)).toBe(1000);
  });
});

jest.mock('getsentry/utils/trackGetsentryAnalytics');
describe('trackOnDemandBudgetAnalytics', () => {
  const organization = OrganizationFixture();
  const sharedBudget1: OnDemandBudgets = {
    budgetMode: OnDemandBudgetMode.SHARED,
    sharedMaxBudget: 1000,
  };
  const sharedBudget2: OnDemandBudgets = {
    budgetMode: OnDemandBudgetMode.SHARED,
    sharedMaxBudget: 2000,
  };
  const perCategoryBudget1: OnDemandBudgets = {
    budgetMode: OnDemandBudgetMode.PER_CATEGORY,
    budgets: {
      errors: 10,
      transactions: 20,
      attachments: 30,
      replays: 40,
      monitorSeats: 50,
      profileDuration: 60,
      profileDurationUI: 70,
      uptime: 80,
      logBytes: 90,
    },
  };
  const perCategoryBudget1Total = 10 + 20 + 30 + 40 + 50 + 60 + 70 + 80 + 90;
  const perCategoryBudget2: OnDemandBudgets = {
    budgetMode: OnDemandBudgetMode.PER_CATEGORY,
    budgets: {
      errors: 1,
      transactions: 2,
      attachments: 3,
      replays: 4,
      monitorSeats: 5,
      profileDuration: 6,
      profileDurationUI: 7,
      uptime: 8,
      logBytes: 9,
    },
  };
  const perCategoryBudget2Total = 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9;

  it('tracks shared to shared on-demand budget update', () => {
    trackOnDemandBudgetAnalytics(organization, sharedBudget1, sharedBudget2);

    expect(trackGetsentryAnalytics).toHaveBeenCalledWith(
      'ondemand_budget_modal.ondemand_budget.update',
      {
        organization,
        previous_strategy: OnDemandBudgetMode.SHARED,
        previous_total_budget: 1000,
        strategy: OnDemandBudgetMode.SHARED,
        total_budget: 2000,
      }
    );
  });
  it('tracks per-category to per-category on-demand budget update', () => {
    trackOnDemandBudgetAnalytics(organization, perCategoryBudget1, perCategoryBudget2);

    expect(trackGetsentryAnalytics).toHaveBeenCalledWith(
      'ondemand_budget_modal.ondemand_budget.update',
      {
        organization,
        previous_strategy: OnDemandBudgetMode.PER_CATEGORY,
        previous_total_budget: perCategoryBudget1Total,
        strategy: OnDemandBudgetMode.PER_CATEGORY,
        total_budget: perCategoryBudget2Total,
        error_budget: 1,
        transaction_budget: 2,
        attachment_budget: 3,
        replay_budget: 4,
        monitor_seat_budget: 5,
        profile_duration_budget: 6,
        profile_duration_ui_budget: 7,
        uptime_budget: 8,
        log_byte_budget: 9,
        previous_error_budget: 10,
        previous_transaction_budget: 20,
        previous_attachment_budget: 30,
        previous_replay_budget: 40,
        previous_monitor_seat_budget: 50,
        previous_profile_duration_budget: 60,
        previous_profile_duration_ui_budget: 70,
        previous_uptime_budget: 80,
        previous_log_byte_budget: 90,
      }
    );
  });

  it('tracks shared to per-category on-demand budget update', () => {
    trackOnDemandBudgetAnalytics(organization, sharedBudget1, perCategoryBudget1);

    expect(trackGetsentryAnalytics).toHaveBeenCalledWith(
      'ondemand_budget_modal.ondemand_budget.update',
      {
        organization,
        previous_strategy: OnDemandBudgetMode.SHARED,
        previous_total_budget: 1000,
        strategy: OnDemandBudgetMode.PER_CATEGORY,
        total_budget: perCategoryBudget1Total,
        error_budget: 10,
        transaction_budget: 20,
        attachment_budget: 30,
        replay_budget: 40,
        monitor_seat_budget: 50,
        profile_duration_budget: 60,
        profile_duration_ui_budget: 70,
        uptime_budget: 80,
        log_byte_budget: 90,
      }
    );
  });

  it('tracks per-category to shared on-demand budget update', () => {
    trackOnDemandBudgetAnalytics(organization, perCategoryBudget1, sharedBudget1);

    expect(trackGetsentryAnalytics).toHaveBeenCalledWith(
      'ondemand_budget_modal.ondemand_budget.update',
      {
        organization,
        previous_strategy: OnDemandBudgetMode.PER_CATEGORY,
        previous_total_budget: perCategoryBudget1Total,
        strategy: OnDemandBudgetMode.SHARED,
        total_budget: 1000,
        previous_error_budget: 10,
        previous_transaction_budget: 20,
        previous_attachment_budget: 30,
        previous_replay_budget: 40,
        previous_monitor_seat_budget: 50,
        previous_profile_duration_budget: 60,
        previous_profile_duration_ui_budget: 70,
        previous_uptime_budget: 80,
        previous_log_byte_budget: 90,
      }
    );
  });

  it('tracks shared budget being turned off', () => {
    trackOnDemandBudgetAnalytics(organization, sharedBudget1, {
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 0,
    });

    expect(trackGetsentryAnalytics).toHaveBeenCalledWith(
      'ondemand_budget_modal.ondemand_budget.turned_off',
      {
        organization,
      }
    );
  });

  it('tracks per-category budget being turned off', () => {
    trackOnDemandBudgetAnalytics(organization, perCategoryBudget1, {
      budgetMode: OnDemandBudgetMode.PER_CATEGORY,
      budgets: {},
    });

    expect(trackGetsentryAnalytics).toHaveBeenCalledWith(
      'ondemand_budget_modal.ondemand_budget.turned_off',
      {
        organization,
      }
    );
  });
});
