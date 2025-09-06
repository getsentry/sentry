import {Component} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Alert} from 'sentry/components/core/alert';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import {RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import type {PendingOnDemandBudgets, Subscription} from 'getsentry/types';
import {
  displayBudgetName,
  formatReservedWithUnits,
  hasPerformance,
} from 'getsentry/utils/billing';
import {
  getPlanCategoryName,
  getReservedBudgetCategoryFromCategories,
  getReservedBudgetDisplayName,
} from 'getsentry/utils/dataCategory';
import formatCurrency from 'getsentry/utils/formatCurrency';
import {
  formatOnDemandBudget,
  hasOnDemandBudgetsFeature,
  isOnDemandBudgetsEqual,
  parseOnDemandBudgets,
  parseOnDemandBudgetsFromSubscription,
} from 'getsentry/views/onDemandBudgets/utils';

type Props = {
  organization: Organization;
  subscription: Subscription;
};

class PendingChanges extends Component<Props> {
  hasChange(pendingChangeKey: string, subscriptionKey: string | null = null) {
    const {subscription} = this.props;
    const {pendingChanges} = subscription;

    if (!pendingChanges) {
      return false;
    }

    subscriptionKey = subscriptionKey ?? pendingChangeKey;
    const pendingChange = this.getNestedValue(pendingChanges, pendingChangeKey);
    const currentValue = this.getNestedValue(subscription, subscriptionKey);

    return pendingChange !== null && pendingChange !== currentValue;
  }

  getNestedValue<T = any>(object: Record<string, any>, keys: string): T | null {
    return keys.split('.').reduce((acc, key) => acc?.[key] ?? null, object) as T | null;
  }

  getOnDemandChanges() {
    const {subscription, organization} = this.props;
    const {pendingChanges} = subscription;

    const results: React.ReactNode[] = [];

    if (!pendingChanges) {
      return results;
    }

    if (
      hasOnDemandBudgetsFeature(organization, subscription) ||
      (pendingChanges.onDemandBudgets && subscription.partner?.isActive)
    ) {
      const nextOnDemandBudgets = this.getNestedValue<PendingOnDemandBudgets>(
        pendingChanges,
        'onDemandBudgets'
      );
      if (nextOnDemandBudgets) {
        const pendingOnDemandBudgets = parseOnDemandBudgets(nextOnDemandBudgets);
        const currentOnDemandBudgets = parseOnDemandBudgetsFromSubscription(subscription);

        if (!isOnDemandBudgetsEqual(pendingOnDemandBudgets, currentOnDemandBudgets)) {
          results.push(
            tct(
              '[budgetType] budget change from [currentOnDemandBudgets] to [nextOnDemandBudgets]',
              {
                budgetType: displayBudgetName(pendingChanges.planDetails, {
                  title: true,
                }),
                currentOnDemandBudgets: formatOnDemandBudget(
                  subscription.planDetails,
                  currentOnDemandBudgets,
                  subscription.planDetails.onDemandCategories
                ),
                nextOnDemandBudgets: formatOnDemandBudget(
                  pendingChanges.planDetails,
                  nextOnDemandBudgets,
                  pendingChanges.planDetails.onDemandCategories
                ),
              }
            )
          );
        }
      }
    } else if (this.hasChange('onDemandMaxSpend')) {
      const nextOnDemandMaxSpend =
        this.getNestedValue<number>(pendingChanges, 'onDemandMaxSpend') ?? 0;
      const currentOnDemandMaxSpend =
        this.getNestedValue<number>(subscription, 'onDemandMaxSpend') ?? 0;
      results.push(
        tct('[budgetType] spend change from [currentAmount] to [newAmount]', {
          budgetType: displayBudgetName(subscription.planDetails, {title: true}),
          newAmount: formatCurrency(nextOnDemandMaxSpend),
          currentAmount: formatCurrency(currentOnDemandMaxSpend),
        })
      );
    }

    return results;
  }

  getPlanChanges() {
    const {subscription} = this.props;
    const {pendingChanges} = subscription;

    const results: React.ReactNode[] = [];

    if (!pendingChanges) {
      return results;
    }

    if (this.hasChange('plan')) {
      results.push(
        tct('Plan change to [name]', {
          name: pendingChanges.planDetails.name,
        })
      );
    }

    if (hasPerformance(subscription.pendingChanges?.planDetails)) {
      results.push(...this.getAMPlanChanges());
    }

    if (this.hasChange('planDetails.contractInterval')) {
      results.push(
        tct('Contract period change to [contractInterval]', {
          contractInterval: pendingChanges.planDetails.contractInterval,
        })
      );
    }

    if (this.hasChange('planDetails.billingInterval')) {
      results.push(
        tct('Billing period change to [billingInterval]', {
          billingInterval: pendingChanges.planDetails.billingInterval,
        })
      );
    }

    if (this.hasReservedBudgetChange()) {
      results.push(...this.getReservedBudgetChanges());
    }

    return results;
  }

  getAMPlanChanges() {
    const {subscription} = this.props;
    const {pendingChanges} = subscription;

    const results: React.ReactNode[] = [];

    if (!pendingChanges) {
      return results;
    }

    Object.values(DATA_CATEGORY_INFO)
      .filter(categoryInfo => categoryInfo.isBilledCategory)
      .forEach(categoryInfo => {
        const category = categoryInfo.plural as DataCategory;
        const pendingReserved = pendingChanges.reserved[category];
        if (
          this.hasChange(`reserved.${category}`, `categories.${category}.reserved`) &&
          pendingReserved !== RESERVED_BUDGET_QUOTA &&
          pendingReserved !== 0
        ) {
          results.push(
            tct('Reserved [displayName] change to [quantity]', {
              displayName: getPlanCategoryName({
                plan: pendingChanges.planDetails,
                category,
                capitalize: false,
              }),
              quantity: formatReservedWithUnits(pendingReserved ?? null, category),
            })
          );
        }
      });

    return results;
  }

  hasReservedBudgetChange() {
    const {subscription} = this.props;
    const {pendingChanges} = subscription;

    if (!pendingChanges) {
      return false;
    }

    const pendingChange = pendingChanges.reservedBudgets;
    const currentValue = subscription.reservedBudgets ?? [];

    if (pendingChange.length !== currentValue.length) {
      return true;
    }

    const sortedPendingBudgets = pendingChange.sort((a, b) => {
      return a.reservedBudget - b.reservedBudget;
    });

    const sortedCurrentBudgets = currentValue.sort((a, b) => {
      return a.reservedBudget - b.reservedBudget;
    });

    for (let i = 0; i < sortedPendingBudgets.length; i++) {
      if (
        sortedPendingBudgets[i]?.reservedBudget !==
        sortedCurrentBudgets[i]?.reservedBudget
      ) {
        return true;
      }

      const pendingBudgetCategories = Object.keys(
        sortedPendingBudgets[i]?.categories ?? {}
      ).sort();
      const currentBudgetCategories = Object.keys(
        sortedCurrentBudgets[i]?.categories ?? {}
      ).sort();

      if (pendingBudgetCategories.length !== currentBudgetCategories.length) {
        return true;
      }

      for (let j = 0; j < pendingBudgetCategories.length; j++) {
        if (pendingBudgetCategories[j] !== currentBudgetCategories[j]) {
          return true;
        }
      }
    }

    return false;
  }

  getReservedBudgetChanges() {
    const {subscription} = this.props;
    const {pendingChanges} = subscription;
    const results: React.ReactNode[] = [];

    if (!pendingChanges) {
      return results;
    }

    const existingReservedBudgets = subscription.reservedBudgets ?? [];
    const pendingReservedBudgets = pendingChanges.reservedBudgets ?? [];
    const seenBudgets = new Set<string>();

    pendingReservedBudgets.forEach(pendingBudget => {
      const pendingBudgetInfo = getReservedBudgetCategoryFromCategories(
        pendingChanges.planDetails,
        Object.keys(pendingBudget.categories) as DataCategory[]
      );

      seenBudgets.add(pendingBudgetInfo?.apiName ?? '');

      if (pendingBudgetInfo?.isFixed) {
        // if it's a fixed budget, we don't care about the existing budget state
        results.push(
          tct('[productName] product access will be [accessState]', {
            productName: toTitleCase(pendingBudgetInfo?.productName),
            accessState: pendingBudget.reservedBudget > 0 ? 'enabled' : 'disabled',
          })
        );
      } else {
        const budgetName = getReservedBudgetDisplayName({
          pendingReservedBudget: pendingBudget,
          plan: pendingChanges.planDetails,
          hadCustomDynamicSampling: subscription.hadCustomDynamicSampling,
          capitalize: true,
        });
        const newAmount = formatCurrency(pendingBudget.reservedBudget);

        const existingEquivalent =
          existingReservedBudgets.find(
            existingBudget => existingBudget.apiName === pendingBudgetInfo?.apiName
          ) ?? null;

        if (existingEquivalent) {
          const oldAmount = formatCurrency(existingEquivalent.reservedBudget);
          results.push(
            tct('[budgetName] change from [oldAmount] to [newAmount]', {
              budgetName,
              oldAmount,
              newAmount,
            })
          );
        } else {
          results.push(
            tct('[budgetName] change to [newAmount]', {
              budgetName,
              newAmount,
            })
          );
        }
      }
    });

    existingReservedBudgets.forEach(existingBudget => {
      if (seenBudgets.has(existingBudget.apiName)) {
        // if we've seen this budget already, we've already handled
        // rendering the pending change (pending enable or pending
        // budget amount change)
        return;
      }

      const willBeSetToZero = existingBudget.dataCategories.every(
        category => pendingChanges.reserved[category] === 0
      );
      if (!willBeSetToZero) {
        // changes to a non-zero reserved volume are handled in getAMPlanChanges
        return;
      }

      if (existingBudget.isFixed) {
        // if there is an existing fixed budget, and a pending zero reserved change,
        // the product is being disabled
        results.push(
          tct('[productName] product access will be disabled', {
            productName: toTitleCase(existingBudget.productName),
          })
        );
      } else {
        const oldAmount = formatCurrency(existingBudget.reservedBudget);
        results.push(
          tct('[budgetName] change from [oldAmount] to $0', {
            budgetName: existingBudget.name,
            oldAmount,
          })
        );
      }
    });

    return results;
  }

  getChanges() {
    const {subscription} = this.props;
    const {pendingChanges} = subscription;

    const results: Record<string, React.ReactNode[]> = {};

    if (!pendingChanges) {
      return results;
    }

    const onDemandChanges = this.getOnDemandChanges();
    const planChanges = this.getPlanChanges();

    // the on-demand effective date should always be before
    // or the same as the plan effective date
    if (onDemandChanges.length && pendingChanges.onDemandEffectiveDate) {
      results[pendingChanges.onDemandEffectiveDate] = onDemandChanges;
    }

    if (planChanges.length && pendingChanges.effectiveDate) {
      if (pendingChanges.effectiveDate in results) {
        results[pendingChanges.effectiveDate]!.unshift(...planChanges);
      } else {
        results[pendingChanges.effectiveDate] = planChanges;
      }
    }

    return results;
  }

  render() {
    const {subscription} = this.props;
    const {pendingChanges} = subscription;

    if (!pendingChanges) {
      return null;
    }

    const changes = this.getChanges();

    if (!Object.keys(changes)?.length) {
      return null;
    }

    return (
      <Alert.Container>
        <Alert type="info">
          <PendingLists>
            {Object.entries(changes).map(([effectiveDate, items]) => (
              <div key={effectiveDate} data-test-id="pending-list">
                {tct('The following changes will take effect on [date]:', {
                  date: <strong>{moment(effectiveDate).format('ll')}</strong>,
                })}
                <ItemList>
                  {items.map((item, itemIdx) => (
                    <li key={itemIdx} data-test-id="pending-item">
                      {item}
                    </li>
                  ))}
                </ItemList>
              </div>
            ))}
          </PendingLists>
        </Alert>
      </Alert.Container>
    );
  }
}

const PendingLists = styled('div')`
  display: grid;
  grid-auto-rows: auto;
  gap: ${space(1.5)};
`;

const ItemList = styled('ul')`
  margin-bottom: 0;
`;

export default PendingChanges;
