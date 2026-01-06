import {useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Alert} from 'sentry/components/core/alert';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
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
} from 'getsentry/views/spendLimits/utils';

type Props = {
  organization: Organization;
  subscription: Subscription;
};

function PendingChanges({organization, subscription}: Props) {
  const {pendingChanges} = subscription;
  const [isExpanded, setIsExpanded] = useState(false);

  if (!pendingChanges) {
    return null;
  }

  const hasChange = (pendingChangeKey: string, subscriptionKey: string | null = null) => {
    subscriptionKey = subscriptionKey ?? pendingChangeKey;
    const pendingChange = getNestedValue(pendingChanges, pendingChangeKey);
    const currentValue = getNestedValue(subscription, subscriptionKey);

    return pendingChange !== null && pendingChange !== currentValue;
  };

  const getNestedValue = <T,>(object: Record<string, any>, keys: string): T | null => {
    return keys.split('.').reduce((acc, key) => acc?.[key] ?? null, object) as T | null;
  };

  const getOnDemandChanges = () => {
    const results: React.ReactNode[] = [];

    if (
      hasOnDemandBudgetsFeature(organization, subscription) ||
      (pendingChanges.onDemandBudgets && subscription.partner?.isActive)
    ) {
      const nextOnDemandBudgets = getNestedValue<PendingOnDemandBudgets>(
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
    } else if (hasChange('onDemandMaxSpend')) {
      const nextOnDemandMaxSpend =
        getNestedValue<number>(pendingChanges, 'onDemandMaxSpend') ?? 0;
      const currentOnDemandMaxSpend =
        getNestedValue<number>(subscription, 'onDemandMaxSpend') ?? 0;
      results.push(
        tct('[budgetType] spend change from [currentAmount] to [newAmount]', {
          budgetType: displayBudgetName(subscription.planDetails, {title: true}),
          newAmount: formatCurrency(nextOnDemandMaxSpend),
          currentAmount: formatCurrency(currentOnDemandMaxSpend),
        })
      );
    }

    return results;
  };

  const getPlanChanges = () => {
    const results: React.ReactNode[] = [];

    if (!pendingChanges) {
      return results;
    }

    if (hasChange('plan')) {
      results.push(
        tct('Plan change to [name]', {
          name: pendingChanges.planDetails.name,
        })
      );
    }

    if (hasPerformance(subscription.pendingChanges?.planDetails)) {
      results.push(...getAMPlanChanges());
    }

    if (hasChange('planDetails.contractInterval')) {
      results.push(
        tct('Contract period change to [contractInterval]', {
          contractInterval: pendingChanges.planDetails.contractInterval,
        })
      );
    }

    if (hasChange('planDetails.billingInterval')) {
      results.push(
        tct('Billing period change to [billingInterval]', {
          billingInterval: pendingChanges.planDetails.billingInterval,
        })
      );
    }

    if (hasReservedBudgetChange()) {
      results.push(...getReservedBudgetChanges());
    }

    return results;
  };

  const getAMPlanChanges = () => {
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
          hasChange(`reserved.${category}`, `categories.${category}.reserved`) &&
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
  };

  const hasReservedBudgetChange = () => {
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
  };

  const getReservedBudgetChanges = () => {
    const results: React.ReactNode[] = [];

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
  };

  const getChanges = () => {
    const results: Record<string, React.ReactNode[]> = {};

    const onDemandChanges = getOnDemandChanges();
    const planChanges = getPlanChanges();

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
  };

  const changes = getChanges();
  const changeKeys = Object.keys(changes);

  if (!changeKeys?.length) {
    return null;
  }

  const firstChangeKey = changeKeys[0]!;
  const firstChangeSet = changes[firstChangeKey];

  // if there are only two changes total, show all the changes without an expand button
  // otherwise, show the first two changes and the rest with an expand button
  const totalChangeLength = Object.values(changes).flat().length;
  const shouldShowAll = !firstChangeSet || totalChangeLength <= 2;
  const initialChanges = shouldShowAll
    ? changes
    : {[firstChangeKey]: firstChangeSet.slice(0, 2)};
  const remainingChangeLength =
    totalChangeLength - Object.values(initialChanges).flat().length;

  return (
    <StyledAlert
      variant="info"
      trailingItems={
        <LinkButton to="/settings/billing/activity-logs">
          {t('View all activity')}
        </LinkButton>
      }
      handleExpandChange={setIsExpanded}
      expand={
        shouldShowAll ? undefined : (
          <Grid gap="lg" autoRows="auto">
            {Object.entries(changes).map(([effectiveDate, items], index) => (
              <div key={effectiveDate} data-test-id={`expanded-pending-list-${index}`}>
                {effectiveDate !== firstChangeKey && (
                  <Text>
                    {tct('The following changes will take effect on [date]:', {
                      date: <strong>{moment(effectiveDate).format('ll')}</strong>,
                    })}
                  </Text>
                )}
                <ItemList>
                  {items
                    .filter(
                      item =>
                        effectiveDate !== firstChangeKey ||
                        !initialChanges[firstChangeKey]?.includes(item)
                    )
                    .map((item, itemIdx) => (
                      <Item key={itemIdx} data-test-id="pending-item">
                        <Text>{item}</Text>
                      </Item>
                    ))}
                </ItemList>
              </div>
            ))}
          </Grid>
        )
      }
    >
      <Grid gap="lg" autoRows="auto">
        {Object.entries(initialChanges).map(([effectiveDate, items], index) => (
          <div key={effectiveDate} data-test-id={`pending-list-${index}`}>
            <Text>
              {tct('The following changes will take effect on [date]:', {
                date: <strong>{moment(effectiveDate).format('ll')}</strong>,
              })}
            </Text>
            <ItemList>
              {items.map((item, itemIdx) => (
                <Item key={itemIdx} data-test-id="pending-item">
                  <Text variant={shouldShowAll || isExpanded ? 'primary' : 'muted'}>
                    {item}
                    {itemIdx === items.length - 1 &&
                      remainingChangeLength > 0 &&
                      !isExpanded &&
                      tct(' and [remainingChangeLength] more [changeTerm]...', {
                        remainingChangeLength,
                        changeTerm: remainingChangeLength === 1 ? 'change' : 'changes',
                      })}
                  </Text>
                </Item>
              ))}
            </ItemList>
          </div>
        ))}
      </Grid>
    </StyledAlert>
  );
}

const ItemList = styled('ul')`
  margin-bottom: 0;
  padding: 0;
`;

const Item = styled('li')`
  list-style-type: none;
`;

const StyledAlert = styled(Alert)`
  > div:nth-child(2) {
    padding: 0;
  }
`;

export default PendingChanges;
