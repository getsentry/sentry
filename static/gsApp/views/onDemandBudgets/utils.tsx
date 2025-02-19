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
import {BillingType, OnDemandBudgetMode, PlanTier} from 'getsentry/types';
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
    return {
      budgetMode: OnDemandBudgetMode.PER_CATEGORY,
      errorsBudget: onDemandBudgets.budgets.errors ?? 0,
      transactionsBudget: onDemandBudgets.budgets.transactions ?? 0,
      attachmentsBudget: onDemandBudgets.budgets.attachments ?? 0,
      replaysBudget: onDemandBudgets.budgets.replays ?? 0,
      monitorSeatsBudget: onDemandBudgets.budgets.monitorSeats ?? 0,
      budgets: {
        errors: onDemandBudgets.budgets.errors,
        transactions: onDemandBudgets.budgets.transactions,
        attachments: onDemandBudgets.budgets.attachments,
        replays: onDemandBudgets.budgets.replays,
        monitorSeats: onDemandBudgets.budgets.monitorSeats,
      },
    };
  }
  return {
    budgetMode: OnDemandBudgetMode.SHARED,
    sharedMaxBudget: onDemandBudgets.sharedMaxBudget ?? 0,
  };
}

export function getTotalBudget(onDemandBudgets: OnDemandBudgets): number {
  if (onDemandBudgets.budgetMode === OnDemandBudgetMode.PER_CATEGORY) {
    const errorsBudget = onDemandBudgets.budgets.errors ?? 0;
    const transactionsBudget = onDemandBudgets.budgets.transactions ?? 0;
    const attachmentsBudget = onDemandBudgets.budgets.attachments ?? 0;
    const replaysBudget = onDemandBudgets.budgets.replays ?? 0;
    const monitorSeatsBudget = onDemandBudgets.budgets.monitorSeats ?? 0;
    return (
      errorsBudget +
      transactionsBudget +
      attachmentsBudget +
      replaysBudget +
      monitorSeatsBudget
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
  categories: string[];
  plan: Plan;
};

function listBudgets({plan, categories, budget}: DisplayNameProps) {
  const categoryNames = categories.map(category => {
    const displayName = getPlanCategoryName({plan, category, capitalize: false});
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const formattedBudget = formatCurrency(budget.budgets[category] ?? 0);
    return `${displayName} at ${formattedBudget}`;
  });
  return oxfordizeArray(categoryNames);
}

export function formatOnDemandBudget(
  plan: Plan,
  planTier: string,
  budget: OnDemandBudgets,
  categories: string[] = [
    'errors',
    'transactions',
    'attachments',
    'replays',
    'monitorSeats',
  ]
): React.ReactNode {
  const budgetType = planTier === PlanTier.AM3 ? 'pay-as-you-go' : 'on-demand';
  if (budget.budgetMode === OnDemandBudgetMode.PER_CATEGORY) {
    return `per-category ${budgetType} (${listBudgets({plan, categories, budget})})`;
  }

  return `shared ${budgetType} of ${formatCurrency(budget.sharedMaxBudget ?? 0)}`;
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
  if (budget.budgetMode === OnDemandBudgetMode.PER_CATEGORY) {
    switch (dataCategory) {
      case DataCategory.ERRORS: {
        return budget.budgets.errors ?? 0;
      }
      case DataCategory.TRANSACTIONS: {
        return budget.budgets.transactions ?? 0;
      }
      case DataCategory.ATTACHMENTS: {
        return budget.budgets.attachments ?? 0;
      }
      case DataCategory.REPLAYS: {
        return budget.budgets.replays ?? 0;
      }
      case DataCategory.MONITOR_SEATS: {
        return budget.budgets.monitorSeats ?? 0;
      }
      default:
        return getTotalBudget(budget);
    }
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
    let errorsBudget = 0;
    let transactionsBudget = 0;
    let attachmentsBudget = 0;
    let replaysBudget = 0;
    let monitorSeatsBudget = 0;
    if (currentOnDemandBudget.budgetMode === OnDemandBudgetMode.PER_CATEGORY) {
      errorsBudget = currentOnDemandBudget.budgets.errors ?? 0;
      transactionsBudget = currentOnDemandBudget.budgets.transactions ?? 0;
      attachmentsBudget = currentOnDemandBudget.budgets.attachments ?? 0;
      replaysBudget = currentOnDemandBudget.budgets.replays ?? 0;
      monitorSeatsBudget = currentOnDemandBudget.budgets.monitorSeats ?? 0;
    } else {
      // should split 50:50 between transactions and errors (whole dollars, remainder added to errors)
      const total = getTotalBudget(currentOnDemandBudget);
      errorsBudget = Math.ceil(total / 100 / 2) * 100;
      transactionsBudget = Math.max(total - errorsBudget, 0);
    }

    return {
      budgetMode: OnDemandBudgetMode.PER_CATEGORY,
      errorsBudget,
      transactionsBudget,
      attachmentsBudget,
      replaysBudget,
      monitorSeatsBudget,
      budgets: {
        errors: errorsBudget,
        transactions: transactionsBudget,
        attachments: attachmentsBudget,
        replays: replaysBudget,
        monitorSeats: monitorSeatsBudget,
      },
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
