import isEqual from 'lodash/isEqual';

import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import oxfordizeArray from 'sentry/utils/oxfordizeArray';

import type {
  OnDemandBudgets,
  PendingOnDemandBudgets,
  PerCategoryOnDemandBudget,
  Plan,
  Subscription,
  SubscriptionOnDemandBudgets,
} from 'getsentry/types';
import {BillingType, OnDemandBudgetMode} from 'getsentry/types';
import {displayBudgetName, getOnDemandCategories} from 'getsentry/utils/billing';
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';
import formatCurrency from 'getsentry/utils/formatCurrency';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

export function parseOnDemandBudgetsFromSubscription(
  subscription: Subscription
): OnDemandBudgets {
  const {onDemandBudgets, onDemandMaxSpend} = subscription;

  const validatedOnDemandMaxSpend = Math.max(onDemandMaxSpend ?? 0, 0);

  if (!onDemandBudgets) {
    return {
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: validatedOnDemandMaxSpend,
    };
  }

  return parseOnDemandBudgets(onDemandBudgets);
}

export function parseOnDemandBudgets(
  onDemandBudgets: SubscriptionOnDemandBudgets | PendingOnDemandBudgets
): OnDemandBudgets {
  if (onDemandBudgets.budgetMode === OnDemandBudgetMode.PER_CATEGORY) {
    const parsedBudgets: Partial<Record<DataCategory, number>> = {};
    const categoryBudgets: Partial<
      Omit<PerCategoryOnDemandBudget, 'budgetMode' | 'budgets'>
    > = {};
    for (const category in onDemandBudgets.budgets) {
      parsedBudgets[category as DataCategory] =
        onDemandBudgets.budgets[category as DataCategory] ?? 0;
      const key = `${category}Budget`;
      (categoryBudgets as Partial<Record<string, number>>)[key] =
        onDemandBudgets.budgets[category as DataCategory] ?? 0;
    }

    return {
      budgetMode: OnDemandBudgetMode.PER_CATEGORY,
      // Set defaults for all possible categories to satisfy the type.
      // TODO: refactor this out later in the future.
      errorsBudget: 0,
      transactionsBudget: 0,
      attachmentsBudget: 0,
      replaysBudget: 0,
      monitorSeatsBudget: 0,
      profileDurationBudget: 0,
      profileDurationUIBudget: 0,
      uptimeBudget: 0,
      // Spread the calculated values over the defaults
      ...categoryBudgets,
      budgets: parsedBudgets,
    };
  }
  return {
    budgetMode: OnDemandBudgetMode.SHARED,
    sharedMaxBudget: onDemandBudgets.sharedMaxBudget ?? 0,
  };
}

export function getTotalBudget(onDemandBudgets: OnDemandBudgets): number {
  if (onDemandBudgets.budgetMode === OnDemandBudgetMode.PER_CATEGORY) {
    return Object.values(onDemandBudgets.budgets).reduce(
      (sum, budget) => sum + (budget ?? 0),
      0
    );
  }

  return onDemandBudgets.sharedMaxBudget ?? 0;
}

export function isOnDemandBudgetsEqual(
  value: OnDemandBudgets,
  other: OnDemandBudgets
): boolean {
  return isEqual(value, other);
}

type DisplayNameProps = {
  budget: PerCategoryOnDemandBudget;
  categories: DataCategory[];
  plan: Plan;
};

function listBudgets({plan, categories, budget}: DisplayNameProps) {
  const categoryNames = categories.map(category => {
    const displayName = getPlanCategoryName({plan, category, capitalize: false});
    const formattedBudget = formatCurrency(budget.budgets[category] ?? 0);
    return `${displayName} at ${formattedBudget}`;
  });
  return oxfordizeArray(categoryNames);
}

export function formatOnDemandBudget(
  plan: Plan,
  budget: OnDemandBudgets,
  categories: DataCategory[] = []
): React.ReactNode {
  if (categories.length === 0) {
    categories = plan.onDemandCategories.map(category => category);
  }
  if (budget.budgetMode === OnDemandBudgetMode.PER_CATEGORY) {
    categories = getOnDemandCategories({
      plan,
      budgetMode: budget.budgetMode,
    });
    return `per-category ${displayBudgetName(plan, {
      withBudget: true,
      pluralOndemand: true,
    })} (${listBudgets({plan, categories, budget})})`;
  }

  return `shared ${displayBudgetName(plan, {
    withBudget: true,
  })} of ${formatCurrency(budget.sharedMaxBudget ?? 0)}`;
}

export function hasOnDemandBudgetsFeature(
  organization: undefined | Organization,
  subscription: undefined | Subscription
) {
  // This function determines if the org can access the on-demand budgets UI.
  // Only orgs on the AM plan can access the on-demand budgets UI.
  return (
    subscription?.planDetails?.hasOnDemandModes &&
    organization?.features.includes('ondemand-budgets')
  );
}

function getBudgetMode(budget: OnDemandBudgets) {
  return budget.budgetMode === OnDemandBudgetMode.PER_CATEGORY
    ? 'per_category'
    : 'shared';
}

export function getOnDemandBudget(budget: OnDemandBudgets, dataCategory: DataCategory) {
  if (
    budget.budgetMode === OnDemandBudgetMode.PER_CATEGORY &&
    dataCategory in budget.budgets
  ) {
    return budget.budgets[dataCategory] ?? 0;
  }
  return getTotalBudget(budget);
}

export function exceedsInvoicedBudgetLimit(
  subscription: Subscription,
  budget: OnDemandBudgets
): boolean {
  if (subscription.type !== BillingType.INVOICED) {
    return false;
  }

  // no limit for invoiced customers with CC-charged on-demand
  if (subscription.onDemandInvoiced && !subscription.onDemandInvoicedManual) {
    return false;
  }

  const totalBudget = getTotalBudget(budget);
  if (!subscription.onDemandInvoicedManual && totalBudget > 0) {
    return true;
  }

  let customPrice = subscription.customPrice;
  if (subscription.billingInterval === 'annual' && customPrice) {
    customPrice /= 12;
  }

  if (
    (customPrice && totalBudget > customPrice * 5) ||
    (subscription.acv && totalBudget > (subscription.acv / 12) * 5)
  ) {
    return true;
  }
  return false;
}

export function trackOnDemandBudgetAnalytics(
  organization: Organization,
  previousBudget: OnDemandBudgets,
  newBudget: OnDemandBudgets,
  prefix: 'ondemand_budget_modal' | 'checkout' = 'ondemand_budget_modal'
) {
  const previousTotalBudget = getTotalBudget(previousBudget);
  const totalBudget = getTotalBudget(newBudget);
  if (totalBudget > 0 && previousTotalBudget !== totalBudget) {
    trackGetsentryAnalytics(`${prefix}.ondemand_budget.update`, {
      organization,

      // new budget
      strategy: getBudgetMode(newBudget),
      total_budget: totalBudget,
      error_budget: getOnDemandBudget(newBudget, DataCategory.ERRORS),
      transaction_budget: getOnDemandBudget(newBudget, DataCategory.TRANSACTIONS),
      attachment_budget: getOnDemandBudget(newBudget, DataCategory.ATTACHMENTS),
      log_byte_budget: getOnDemandBudget(newBudget, DataCategory.LOG_BYTE),

      // previous budget
      previous_strategy: getBudgetMode(previousBudget),
      previous_total_budget: getTotalBudget(previousBudget),
      previous_error_budget: getOnDemandBudget(previousBudget, DataCategory.ERRORS),
      previous_transaction_budget: getOnDemandBudget(
        previousBudget,
        DataCategory.TRANSACTIONS
      ),
      previous_attachment_budget: getOnDemandBudget(
        previousBudget,
        DataCategory.ATTACHMENTS
      ),
      previous_log_byte_budget: getOnDemandBudget(previousBudget, DataCategory.LOG_BYTE),
    });
    return;
  }

  trackGetsentryAnalytics(`${prefix}.ondemand_budget.turned_off`, {
    organization,
  });
}

export function normalizeOnDemandBudget(budget: OnDemandBudgets): OnDemandBudgets {
  if (getTotalBudget(budget) <= 0) {
    return {
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 0,
    };
  }
  return budget;
}

export function convertOnDemandBudget(
  currentOnDemandBudget: OnDemandBudgets,
  nextMode: OnDemandBudgetMode
): OnDemandBudgets {
  if (nextMode === OnDemandBudgetMode.PER_CATEGORY) {
    const newBudgets: Partial<Record<DataCategory, number>> = {
      // TODO: refactor this out later in the future.
      errors: 0,
      transactions: 0,
      attachments: 0,
      replays: 0,
      monitorSeats: 0,
      uptime: 0,
      profileDuration: 0,
      profileDurationUI: 0,
    };

    if (currentOnDemandBudget.budgetMode === OnDemandBudgetMode.PER_CATEGORY) {
      Object.assign(newBudgets, currentOnDemandBudget.budgets);
    } else {
      // should split 50:50 between transactions and errors (whole dollars, remainder added to errors)
      const total = getTotalBudget(currentOnDemandBudget);
      const errorsBudget = Math.ceil(total / 100 / 2) * 100;
      const transactionsBudget = Math.max(total - errorsBudget, 0);
      newBudgets.errors = errorsBudget;
      newBudgets.transactions = transactionsBudget;
    }

    const categoryBudgets: Partial<Record<string, number>> = Object.fromEntries(
      Object.entries(newBudgets).map(([category, value]) => [
        `${category}Budget`,
        value ?? 0,
      ])
    );

    return {
      budgetMode: OnDemandBudgetMode.PER_CATEGORY,
      // Set defaults for all possible categories to satisfy the type.
      // TODO: refactor this out later in the future.
      errorsBudget: 0,
      transactionsBudget: 0,
      attachmentsBudget: 0,
      replaysBudget: 0,
      monitorSeatsBudget: 0,
      uptimeBudget: 0,
      profileDurationBudget: 0,
      profileDurationUIBudget: 0,
      // Spread the calculated values over the defaults
      ...categoryBudgets,
      budgets: newBudgets,
    };
  }

  let sharedMaxBudget = 0;
  if (currentOnDemandBudget.budgetMode === OnDemandBudgetMode.SHARED) {
    sharedMaxBudget = currentOnDemandBudget.sharedMaxBudget ?? 0;
  } else {
    // The shared budget would be the total of the current per-category budgets.
    sharedMaxBudget = getTotalBudget(currentOnDemandBudget);
  }

  return {
    budgetMode: OnDemandBudgetMode.SHARED,
    sharedMaxBudget,
  };
}
