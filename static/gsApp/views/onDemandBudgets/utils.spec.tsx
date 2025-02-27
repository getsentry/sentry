import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  InvoicedSubscriptionFixture,
  SubscriptionFixture,
} from 'getsentry-test/fixtures/subscription';

import {OnDemandBudgetMode, type OnDemandBudgets} from 'getsentry/types';
import {
  exceedsInvoicedBudgetLimit,
  getTotalBudget,
  parseOnDemandBudgetsFromSubscription,
} from 'getsentry/views/onDemandBudgets/utils';

describe('parseOnDemandBudgetsFromSubscription', function () {
  it('returns per-category budget for non-AM plans - with on-demand budget', function () {
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

  it('returns shared on-demand budget for non-AM plans - without on-demand budget', function () {
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

  it('returns shared on-demand budget for AM plans', function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_business',
      planTier: 'am1',
      reservedEvents: 200000,
      reservedTransactions: 250000,
      reservedAttachments: 25,
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

  it('returns shared on-demand budget for AM plans - without on-demand budget', function () {
    const organization = OrganizationFixture();
    let subscription = SubscriptionFixture({
      organization,
      plan: 'am1_business',
      planTier: 'am1',
      reservedEvents: 200000,
      reservedTransactions: 250000,
      reservedAttachments: 25,
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
      reservedEvents: 200000,
      reservedTransactions: 250000,
      reservedAttachments: 25,
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
      reservedEvents: 200000,
      reservedTransactions: 250000,
      reservedAttachments: 25,
    });

    ondemandBudgets = parseOnDemandBudgetsFromSubscription(subscription);
    expect(ondemandBudgets).toEqual({
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 0,
    });
  });

  it('returns per-category on-demand budget for AM plans', function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_business',
      planTier: 'am1',
      reservedEvents: 200000,
      reservedTransactions: 250000,
      reservedAttachments: 25,
      onDemandMaxSpend: 100 + 200 + 300,
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.PER_CATEGORY,
        errorsBudget: 100,
        transactionsBudget: 200,
        attachmentsBudget: 300,
        monitorSeatsBudget: 400,
        replaysBudget: 0,
        budgets: {
          errors: 100,
          transactions: 200,
          attachments: 300,
          replays: 0,
          monitorSeats: 400,
          uptime: 500,
        },
        attachmentSpendUsed: 0,
        errorSpendUsed: 0,
        transactionSpendUsed: 0,
        usedSpends: {
          errors: 0,
          transactions: 0,
          attachments: 0,
          replays: 0,
          monitorSeats: 0,
          uptime: 0,
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
      errorsBudget: 100,
      transactionsBudget: 200,
      attachmentsBudget: 300,
      monitorSeatsBudget: 400,
      uptimeBudget: 500,
      replaysBudget: 0,
      budgets: {
        errors: 100,
        transactions: 200,
        attachments: 300,
        replays: 0,
        monitorSeats: 400,
        uptime: 500,
      },
    });
  });

  it('reconstructs shared on-demand budget if onDemandBudgets is missing', function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_business',
      planTier: 'am1',
      reservedEvents: 200000,
      reservedTransactions: 250000,
      reservedAttachments: 25,
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

describe('getTotalBudget', function () {
  it('returns total on-demand budget for non-AM plans - with on-demand budget', function () {
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

  it('returns total on-demand budget for non-AM plans - without on-demand budget', function () {
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

  it('returns total budget of shared on-demand budget for AM plans', function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_business',
      planTier: 'am1',
      reservedEvents: 200000,
      reservedTransactions: 250000,
      reservedAttachments: 25,
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

  it('returns total budget of shared on-demand budget for AM plans - without on-demand budget', function () {
    const organization = OrganizationFixture();
    let subscription = SubscriptionFixture({
      organization,
      plan: 'am1_business',
      planTier: 'am1',
      reservedEvents: 200000,
      reservedTransactions: 250000,
      reservedAttachments: 25,
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
      reservedEvents: 200000,
      reservedTransactions: 250000,
      reservedAttachments: 25,
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
      reservedEvents: 200000,
      reservedTransactions: 250000,
      reservedAttachments: 25,
    });

    actualTotalBudget = getTotalBudget(
      parseOnDemandBudgetsFromSubscription(subscription)
    );
    expect(actualTotalBudget).toBe(0);
  });

  it('returns total budget of per-category on-demand budget for AM plans', function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_business',
      planTier: 'am1',
      reservedEvents: 200000,
      reservedTransactions: 250000,
      reservedAttachments: 25,
      onDemandMaxSpend: 100 + 200 + 300,
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.PER_CATEGORY,
        errorsBudget: 100,
        transactionsBudget: 200,
        attachmentsBudget: 300,
        replaysBudget: 0,
        budgets: {errors: 100, transactions: 200, attachments: 300, uptime: 400},
        attachmentSpendUsed: 0,
        errorSpendUsed: 0,
        transactionSpendUsed: 0,
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

  it('returns total on-demand budget if onDemandBudgets is missing', function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_business',
      planTier: 'am1',
      reservedEvents: 200000,
      reservedTransactions: 250000,
      reservedAttachments: 25,
      onDemandMaxSpend: 123,
    });

    const actualTotalBudget = getTotalBudget(
      parseOnDemandBudgetsFromSubscription(subscription)
    );
    expect(actualTotalBudget).toBe(123);
  });
});

describe('exceedsInvoicedBudgetLimit', function () {
  it('returns false for non-invoiced subscription', function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({organization});
    const ondemandBudget: OnDemandBudgets = {
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 3_000_000,
    };
    expect(exceedsInvoicedBudgetLimit(subscription, ondemandBudget)).toBe(false);
  });

  it('returns false for invoiced subscriptions without flag', function () {
    const organization = OrganizationFixture();
    const subscription = InvoicedSubscriptionFixture({organization});
    const ondemandBudget: OnDemandBudgets = {
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 0,
    };
    expect(exceedsInvoicedBudgetLimit(subscription, ondemandBudget)).toBe(false);
  });

  it('returns false for invoiced subscriptions with budget and with onDemandInvoiced flag', function () {
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

  it('returns true for invoiced subscriptions with budget and without any flags', function () {
    // if an invoiced customer is somehow setting OD budget without either onDemandInvoicedManual or onDemandInvoiced, always stop them
    const organization = OrganizationFixture();
    const subscription = InvoicedSubscriptionFixture({organization});
    const ondemandBudget: OnDemandBudgets = {
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 1000,
    };
    expect(exceedsInvoicedBudgetLimit(subscription, ondemandBudget)).toBe(true);
  });

  it('returns false for invoiced subscriptions with flag and budget lower than or equal to 5x custom price', function () {
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

  it('returns false for invoiced subscriptions with flag and budget lower than or equal to 5x acv', function () {
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

  it('returns true for invoiced subscriptions with flag and budget greater than 5x custom price', function () {
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

  it('returns false for invoiced subscriptions with flag and budget greater than 5x acv', function () {
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
