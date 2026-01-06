import {Fragment} from 'react';
import moment from 'moment-timezone';

import {Alert} from 'sentry/components/core/alert';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {IconArrow} from 'sentry/icons';
import {DataCategory} from 'sentry/types/core';

import {RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import {usePlanMigrations} from 'getsentry/hooks/usePlanMigrations';
import type {Plan, PlanMigration, Subscription} from 'getsentry/types';
import {displayBudgetName, formatReservedWithUnits} from 'getsentry/utils/billing';
import {
  getPlanCategoryName,
  getReservedBudgetDisplayName,
} from 'getsentry/utils/dataCategory';
import {displayPriceWithCents} from 'getsentry/views/amCheckout/utils';
import {
  formatOnDemandBudget,
  isOnDemandBudgetsEqual,
  parseOnDemandBudgets,
  parseOnDemandBudgetsFromSubscription,
} from 'getsentry/views/spendLimits/utils';

function getStringForPrice(
  price: number | null | undefined,
  minimumFractionDigits?: number,
  maximumFractionDigits?: number
) {
  return price === null
    ? 'None'
    : displayPriceWithCents({
        cents: price ?? 0,
        minimumFractionDigits,
        maximumFractionDigits,
      });
}

function formatChangeForCategory({
  category,
  changeTitle,
  oldValue,
  pendingValue,
  oldPlan,
  pendingPlan,
  shouldDistinguishDisplayNames = false,
}: {
  category: DataCategory;
  changeTitle: string;
  oldPlan: Plan;
  oldValue: string;
  pendingPlan: Plan;
  pendingValue: string;
  shouldDistinguishDisplayNames?: boolean;
}) {
  const oldUsesDsNames = oldPlan.categories.includes(DataCategory.SPANS_INDEXED);
  const pendingUsesDsNames = pendingPlan.categories.includes(DataCategory.SPANS_INDEXED);

  const oldDisplayName = getPlanCategoryName({
    plan: oldPlan,
    category,
    capitalize: false,
    hadCustomDynamicSampling: oldUsesDsNames,
  });
  const pendingDisplayName = getPlanCategoryName({
    plan: pendingPlan,
    category,
    capitalize: false,
    hadCustomDynamicSampling: pendingUsesDsNames,
  });
  return `${changeTitle} ${shouldDistinguishDisplayNames ? oldDisplayName : pendingDisplayName} — ${oldValue} → ${pendingValue} ${
    shouldDistinguishDisplayNames ? pendingDisplayName : ''
  }`;
}

function getRegularChanges(subscription: Subscription) {
  const {pendingChanges} = subscription;
  const changes: string[] = [];

  if (pendingChanges === null) {
    return changes;
  }

  if (Object.keys(pendingChanges).length === 0) {
    return changes;
  }

  if (pendingChanges.plan !== subscription.plan) {
    const old = subscription.planDetails.name;
    const change = pendingChanges.planDetails.name;
    changes.push(`Plan changes — ${old} → ${change}`);
  }

  const oldPlanUsesDsNames = subscription.planDetails.categories.includes(
    DataCategory.SPANS_INDEXED
  );
  const newPlanUsesDsNames = pendingChanges.planDetails.categories.includes(
    DataCategory.SPANS_INDEXED
  );

  if (
    pendingChanges.planDetails.contractInterval !==
    subscription.planDetails.contractInterval
  ) {
    const old = subscription.planDetails.contractInterval;
    const change = pendingChanges.planDetails.contractInterval;
    changes.push(`Contract period — ${old} → ${change}`);
  }

  if (
    pendingChanges.planDetails.billingInterval !==
    subscription.planDetails.billingInterval
  ) {
    const old = subscription.planDetails.billingInterval;
    const change = pendingChanges.planDetails.billingInterval;
    changes.push(`Billing period — ${old} → ${change}`);
  }

  if (pendingChanges.reserved.errors !== subscription.categories.errors?.reserved) {
    const old = formatReservedWithUnits(
      subscription.categories.errors?.reserved ?? null,
      DataCategory.ERRORS
    );
    const change = formatReservedWithUnits(
      pendingChanges.reserved?.errors ?? null,
      DataCategory.ERRORS
    );
    changes.push(
      formatChangeForCategory({
        category: DataCategory.ERRORS,
        changeTitle: 'Reserved',
        oldValue: old,
        pendingValue: change,
        oldPlan: subscription.planDetails,
        pendingPlan: pendingChanges.planDetails,
        shouldDistinguishDisplayNames: true,
      })
    );
  }

  const categories = [
    ...new Set([
      ...subscription.planDetails.categories,
      ...Object.keys(pendingChanges.reserved ?? {}),
    ]),
  ] as DataCategory[];
  categories.forEach(category => {
    if (category !== 'errors') {
      // Errors and Events handled above
      if (
        (pendingChanges.reserved?.[category] ?? 0) !==
        (subscription.categories?.[category]?.reserved ?? 0)
      ) {
        const categoryEnum = category;
        const oldReserved = subscription.categories?.[category]?.reserved ?? null;
        const pendingReserved = pendingChanges.reserved?.[category] ?? null;
        const old =
          oldReserved === RESERVED_BUDGET_QUOTA
            ? 'reserved budget'
            : formatReservedWithUnits(oldReserved, categoryEnum);
        const change =
          pendingReserved === RESERVED_BUDGET_QUOTA
            ? 'reserved budget'
            : formatReservedWithUnits(pendingReserved, categoryEnum);

        changes.push(
          formatChangeForCategory({
            category: categoryEnum,
            changeTitle: 'Reserved',
            oldValue: old,
            pendingValue: change,
            oldPlan: subscription.planDetails,
            pendingPlan: pendingChanges.planDetails,
            shouldDistinguishDisplayNames: pendingReserved !== RESERVED_BUDGET_QUOTA,
          })
        );
      }
    }
  });

  if (pendingChanges.customPrice !== subscription.customPrice) {
    const old = getStringForPrice(subscription.customPrice);
    const change = getStringForPrice(pendingChanges.customPrice);
    changes.push(`Custom price (ACV) — ${old} → ${change}`);
  }

  categories.forEach(category => {
    if (
      (pendingChanges.customPrices?.[category] ?? 0) !==
      (subscription.categories?.[category]?.customPrice ?? 0)
    ) {
      const old = getStringForPrice(subscription.categories?.[category]?.customPrice);
      const change = getStringForPrice(pendingChanges.customPrices?.[category]);
      changes.push(
        formatChangeForCategory({
          category,
          changeTitle: 'Custom price for',
          oldValue: old,
          pendingValue: change,
          oldPlan: subscription.planDetails,
          pendingPlan: pendingChanges.planDetails,
        })
      );
    }
  });

  if (pendingChanges.customPricePcss !== subscription.customPricePcss) {
    const old = getStringForPrice(subscription.customPricePcss);
    const change = getStringForPrice(pendingChanges.customPricePcss);
    changes.push(`Custom price for PCSS — ${old} → ${change}`);
  }

  const oldBudgets = subscription.reservedBudgets;
  const oldCpeByCategory: Record<string, number> = {};
  oldBudgets?.forEach(budget => {
    Object.entries(budget.categories).forEach(([category, info]) => {
      if (info?.reservedCpe) {
        oldCpeByCategory[category] = info.reservedCpe;
      }
    });
  });
  categories.forEach(category => {
    if (
      (pendingChanges.reservedCpe?.[category] ?? null) !==
      (oldCpeByCategory[category] ?? null)
    ) {
      const old = getStringForPrice(oldCpeByCategory[category] ?? null, 8, 8);
      const change = getStringForPrice(
        pendingChanges.reservedCpe?.[category] ?? null,
        8,
        8
      );
      changes.push(
        formatChangeForCategory({
          category,
          changeTitle: 'Reserved cost-per-event for',
          oldValue: old,
          pendingValue: change,
          oldPlan: subscription.planDetails,
          pendingPlan: pendingChanges.planDetails,
        })
      );
    }
  });

  const oldBudgetsChanges: string[] = [];
  const newBudgetsChanges: string[] = [];
  oldBudgets?.forEach(budget => {
    const budgetName = getReservedBudgetDisplayName({
      reservedBudget: budget,
      plan: subscription.planDetails,
      hadCustomDynamicSampling: oldPlanUsesDsNames,
    });
    oldBudgetsChanges.push(
      `${getStringForPrice(budget.reservedBudget)} for ${budgetName}`
    );
  });
  pendingChanges.reservedBudgets.forEach(budget => {
    const budgetName = getReservedBudgetDisplayName({
      pendingReservedBudget: budget,
      plan: pendingChanges.planDetails,
      hadCustomDynamicSampling: newPlanUsesDsNames,
    });
    newBudgetsChanges.push(
      `${getStringForPrice(budget.reservedBudget)} for ${budgetName}`
    );
  });

  if (oldBudgetsChanges.length > 0 || newBudgetsChanges.length > 0) {
    const before = oldBudgetsChanges.length > 0 ? oldBudgetsChanges.join(', ') : 'None';
    const after = newBudgetsChanges.length > 0 ? newBudgetsChanges.join(', ') : 'None';
    if (before !== after) {
      changes.push(`Reserved budgets — ${before} → ${after}`);
    }
  }

  return changes;
}

function getOnDemandChanges(subscription: Subscription) {
  const {pendingChanges} = subscription;
  const changes: React.ReactNode[] = [];

  if (pendingChanges === null) {
    return changes;
  }

  if (Object.keys(pendingChanges).length === 0) {
    return changes;
  }

  if (subscription.onDemandBudgets && pendingChanges.onDemandBudgets) {
    const pendingOnDemandBudgets = parseOnDemandBudgets(pendingChanges.onDemandBudgets);
    const currentOnDemandBudgets = parseOnDemandBudgetsFromSubscription(subscription);

    if (!isOnDemandBudgetsEqual(pendingOnDemandBudgets, currentOnDemandBudgets)) {
      const current = formatOnDemandBudget(
        subscription.planDetails,
        currentOnDemandBudgets,
        subscription.planDetails.onDemandCategories
      );
      const change = formatOnDemandBudget(
        pendingChanges.planDetails,
        pendingOnDemandBudgets,
        pendingChanges.planDetails.onDemandCategories
      );
      changes.push(
        <span>
          {displayBudgetName(pendingChanges.planDetails, {title: true, withBudget: true})}{' '}
          — {current} → {change}
        </span>
      );
    }
  } else if (pendingChanges.onDemandMaxSpend !== subscription.onDemandMaxSpend) {
    const old = getStringForPrice(subscription.onDemandMaxSpend);
    const change = getStringForPrice(pendingChanges.onDemandMaxSpend);
    changes.push(
      <span>
        {displayBudgetName(pendingChanges.planDetails, {title: true})} maximum — {old} →{' '}
        {change}
      </span>
    );
  }

  return changes;
}

type Change = {
  effectiveDate: string;
  items: React.ReactNode[];
};

function getChanges(subscription: Subscription, planMigrations: PlanMigration[]) {
  const {pendingChanges} = subscription;
  const changeSet: Change[] = [];

  if (pendingChanges === null) {
    return changeSet;
  }

  const activeMigration = planMigrations.find(
    ({dateApplied, cohort}) => dateApplied === null && cohort?.nextPlan
  );

  const {onDemandEffectiveDate} = pendingChanges;

  const effectiveDate = activeMigration?.effectiveAt ?? pendingChanges.effectiveDate;

  const regularChanges = getRegularChanges(subscription);
  const onDemandChanges = getOnDemandChanges(subscription);

  if (effectiveDate === onDemandEffectiveDate) {
    const combinedChanges = [...regularChanges, ...onDemandChanges];
    if (combinedChanges.length > 0) {
      changeSet.push({effectiveDate, items: combinedChanges});
    }
  } else {
    if (regularChanges.length > 0) {
      changeSet.push({effectiveDate, items: regularChanges});
    }

    if (onDemandChanges.length > 0) {
      changeSet.push({effectiveDate: onDemandEffectiveDate, items: onDemandChanges});
    }
  }

  return changeSet;
}

function PendingChanges({subscription}: any) {
  const {pendingChanges} = subscription;
  const {planMigrations, isLoading} = usePlanMigrations();
  if (isLoading) {
    return null;
  }

  if (typeof pendingChanges !== 'object' || pendingChanges === null) {
    return null;
  }

  const changes = getChanges(subscription, planMigrations);
  if (!changes.length) {
    return null;
  }

  return (
    <Fragment>
      <Alert.Container>
        <Alert variant="info">This account has pending changes to the subscription</Alert>
      </Alert.Container>

      <List>
        {changes.map((change, changeIdx) => (
          <ListItem key={changeIdx}>
            <p>
              The following changes will take effect on{' '}
              <strong>{moment(change.effectiveDate).format('ll')}</strong>:
            </p>
            <List symbol={<IconArrow direction="right" size="xs" />}>
              {change.items.map((item, itemIdx) => (
                <ListItem key={itemIdx}>{item}</ListItem>
              ))}
            </List>
          </ListItem>
        ))}
      </List>
    </Fragment>
  );
}

export default PendingChanges;
