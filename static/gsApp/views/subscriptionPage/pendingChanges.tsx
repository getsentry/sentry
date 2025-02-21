import {Component} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Alert} from 'sentry/components/alert';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

import {type PendingOnDemandBudgets, PlanTier, type Subscription} from 'getsentry/types';
import {
  formatReservedWithUnits,
  getAmPlanTier,
  hasPerformance,
} from 'getsentry/utils/billing';
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';
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
        const planTier = getAmPlanTier(pendingChanges.plan);

        if (!isOnDemandBudgetsEqual(pendingOnDemandBudgets, currentOnDemandBudgets)) {
          results.push(
            tct(
              '[budgetType] budget change from [currentOnDemandBudgets] to [nextOnDemandBudgets]',
              {
                budgetType: planTier === PlanTier.AM3 ? 'Pay-as-you-go' : 'On-demand',
                currentOnDemandBudgets: formatOnDemandBudget(
                  subscription.planDetails,
                  subscription.planTier,
                  currentOnDemandBudgets,
                  subscription.planDetails.onDemandCategories
                ),
                nextOnDemandBudgets: formatOnDemandBudget(
                  subscription.planDetails,
                  planTier?.toString() || subscription.planTier,
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
          budgetType:
            subscription.planTier === PlanTier.AM3 ? 'Pay-as-you-go' : 'On-demand',
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

    this.hasChange('plan') &&
      results.push(
        tct('Plan change to [name]', {
          name: pendingChanges.planDetails.name,
        })
      );

    hasPerformance(subscription.pendingChanges?.planDetails)
      ? results.push(...this.getAMPlanChanges())
      : this.hasChange('reservedEvents') &&
        results.push(
          tct('Reserved errors change to [quantity]', {
            quantity: pendingChanges.reservedEvents.toLocaleString(),
          })
        );

    this.hasChange('planDetails.contractInterval') &&
      results.push(
        tct('Contract period change to [contractInterval]', {
          contractInterval: pendingChanges.planDetails.contractInterval,
        })
      );

    this.hasChange('planDetails.billingInterval') &&
      results.push(
        tct('Billing period change to [billingInterval]', {
          billingInterval: pendingChanges.planDetails.billingInterval,
        })
      );

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
        const plural = categoryInfo.plural;
        if (this.hasChange(`reserved.${plural}`, `categories.${plural}.reserved`)) {
          results.push(
            tct('Reserved [displayName] change to [quantity]', {
              displayName: getPlanCategoryName({
                plan: pendingChanges.planDetails,
                category: plural,
                capitalize: false,
              }),
              quantity: formatReservedWithUnits(
                pendingChanges.reserved[plural] ?? null,
                plural
              ),
            })
          );
        }
      });

    return results;
  }

  getChanges() {
    const {subscription} = this.props;
    const {pendingChanges} = subscription;

    const results: {
      [key: string]: React.ReactNode[];
    } = {};

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
      <Alert type="info" showIcon>
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
