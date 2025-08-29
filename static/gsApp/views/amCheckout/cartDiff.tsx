import React, {Fragment} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';
import {capitalize} from 'sentry/utils/string/capitalize';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import {
  OnDemandBudgetMode,
  type Plan,
  type SharedOnDemandBudget,
  type Subscription,
} from 'getsentry/types';
import {formatReservedWithUnits, isTrialPlan} from 'getsentry/utils/billing';
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';
import type {CheckoutFormData, SelectableProduct} from 'getsentry/views/amCheckout/types';
import * as utils from 'getsentry/views/amCheckout/utils';
import {parseOnDemandBudgetsFromSubscription} from 'getsentry/views/onDemandBudgets/utils';

const DEFAULT_PAYG_BUDGET: SharedOnDemandBudget = {
  budgetMode: OnDemandBudgetMode.SHARED,
  sharedMaxBudget: 0,
};

type CheckoutChange<K, V> = {
  currentValue: V | null;
  key: K;
  newValue: V | null;
};

type PlanChange = CheckoutChange<'plan' | 'contractInterval', string>;

type ProductChange = CheckoutChange<SelectableProduct, boolean>;

type ReservedChange = CheckoutChange<DataCategory, number>;

type SharedOnDemandChange = CheckoutChange<'sharedMaxBudget', number>;

type PerCategoryOnDemandChange = CheckoutChange<DataCategory, number | null>;

function AddedHighlight({value}: {value: string}) {
  return (
    <Added>
      <span>{value}</span>
    </Added>
  );
}

function RemovedHighlight({value}: {value: string}) {
  return (
    <Removed>
      <span>{value}</span>
    </Removed>
  );
}

function ChangeRow({
  leftComponent,
  currentValue,
  newValue,
}: {
  currentValue: string | null;
  leftComponent: React.ReactNode;
  newValue: string | null;
}) {
  return (
    <Fragment>
      {leftComponent}
      {currentValue === null ? <Change /> : <RemovedHighlight value={currentValue} />}
      {newValue === null ? <Change /> : <AddedHighlight value={newValue} />}
    </Fragment>
  );
}

function PlanDiff({
  currentPlan,
  newPlan,
  planChanges,
  productChanges,
}: {
  currentPlan: Plan;
  newPlan: Plan;
  planChanges: PlanChange[];
  productChanges: ProductChange[];
}) {
  const changes = [...planChanges, ...productChanges];
  return (
    <ChangeSection>
      <ChangeGrid>
        {changes.map((change, index) => {
          const {key, currentValue, newValue} = change;
          let leftComponent = <div />;
          if (index === 0) {
            leftComponent = <ChangeSectionTitle>{t('Plan')}</ChangeSectionTitle>;
          }
          let formattingFunction = (value: any) => value;
          if (key === 'plan' || key === 'contractInterval') {
            formattingFunction = (value: any) => (value ? capitalize(value) : null);
          } else {
            formattingFunction = (value: any) =>
              value
                ? toTitleCase(
                    newPlan.availableReservedBudgetTypes[key]?.productCheckoutName ??
                      currentPlan.availableReservedBudgetTypes[key]
                        ?.productCheckoutName ??
                      key,
                    {allowInnerUpperCase: true}
                  )
                : null;
          }
          return (
            <ChangeRow
              key={key}
              leftComponent={leftComponent}
              currentValue={formattingFunction(currentValue)}
              newValue={formattingFunction(newValue)}
            />
          );
        })}
      </ChangeGrid>
    </ChangeSection>
  );
}

function ReservedDiff({
  currentPlan,
  newPlan,
  reservedChanges,
}: {
  currentPlan: Plan;
  newPlan: Plan;
  reservedChanges: ReservedChange[];
}) {
  return (
    <ChangeSection>
      <ChangeSectionTitle hasBottomMargin>{t('Reserved volume')}</ChangeSectionTitle>
      <ChangeGrid>
        {reservedChanges.map(({key, currentValue, newValue}) => {
          return (
            <ChangeRow
              key={key}
              leftComponent={
                <ChangedCategory>
                  {getPlanCategoryName({
                    category: key,
                    plan: currentValue === null ? newPlan : currentPlan,
                    title: true,
                  })}
                </ChangedCategory>
              }
              currentValue={
                currentValue === null
                  ? null
                  : formatReservedWithUnits(currentValue, key, {isAbbreviated: true})
              }
              newValue={
                newValue === null
                  ? null
                  : formatReservedWithUnits(newValue, key, {isAbbreviated: true})
              }
            />
          );
        })}
      </ChangeGrid>
    </ChangeSection>
  );
}

function OnDemandDiff({
  sharedOnDemandChanges,
  perCategoryOnDemandChanges,
  currentPlan,
  newPlan,
}: {
  currentPlan: Plan;
  newPlan: Plan;
  perCategoryOnDemandChanges: PerCategoryOnDemandChange[];
  sharedOnDemandChanges: SharedOnDemandChange[];
}) {
  return (
    <Fragment>
      {sharedOnDemandChanges.length > 0 && (
        <ChangeSection>
          <ChangeGrid>
            {sharedOnDemandChanges.map((change, index) => {
              const {key, currentValue, newValue} = change;
              let leftComponent = <div />;
              if (index === 0) {
                leftComponent = (
                  <ChangeSectionTitle>{t('Shared spend cap')}</ChangeSectionTitle>
                );
              }
              return (
                <ChangeRow
                  key={key}
                  leftComponent={leftComponent}
                  currentValue={
                    currentValue === null
                      ? null
                      : utils.displayPrice({cents: currentValue})
                  }
                  newValue={
                    newValue === null ? null : utils.displayPrice({cents: newValue})
                  }
                />
              );
            })}
          </ChangeGrid>
        </ChangeSection>
      )}
      {perCategoryOnDemandChanges.length > 0 && (
        <ChangeSection>
          <ChangeSectionTitle hasBottomMargin>
            {t('Per-category spend caps')}
          </ChangeSectionTitle>
          <ChangeGrid>
            {perCategoryOnDemandChanges.map(({key, currentValue, newValue}) => {
              return (
                <ChangeRow
                  key={key}
                  leftComponent={
                    <ChangedCategory>
                      {getPlanCategoryName({
                        category: key,
                        plan: currentValue === null ? newPlan : currentPlan,
                        title: true,
                      })}
                    </ChangedCategory>
                  }
                  currentValue={
                    currentValue === null
                      ? null
                      : utils.displayPrice({cents: currentValue})
                  }
                  newValue={
                    newValue === null ? null : utils.displayPrice({cents: newValue})
                  }
                />
              );
            })}
          </ChangeGrid>
        </ChangeSection>
      )}
    </Fragment>
  );
}

function CartDiff({
  activePlan,
  formData,
  subscription,
  freePlan,
  isOpen,
  onToggle,
}: {
  activePlan: Plan;
  formData: CheckoutFormData;
  freePlan: Plan;
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
  subscription: Subscription;
}) {
  const currentPlan = isTrialPlan(subscription.plan)
    ? freePlan
    : subscription.planDetails;
  const currentOnDemandBudget = parseOnDemandBudgetsFromSubscription(subscription);
  const newOnDemandBudget = formData.onDemandBudget ?? DEFAULT_PAYG_BUDGET;
  const currentBudgetMode = currentOnDemandBudget.budgetMode;
  const newBudgetMode = newOnDemandBudget.budgetMode;

  const getPlanChanges = (): PlanChange[] => {
    const changes: PlanChange[] = [];
    if (activePlan.name !== currentPlan.name) {
      changes.push({
        key: 'plan',
        currentValue: currentPlan.name,
        newValue: activePlan.name,
      });
    }

    if (activePlan.contractInterval !== currentPlan.contractInterval) {
      changes.push({
        key: 'contractInterval',
        currentValue: currentPlan.contractInterval,
        newValue: activePlan.contractInterval,
      });
    }

    return changes;
  };

  const getProductChanges = (): ProductChange[] => {
    // TODO(checkout v3): This will need to be updated to handle non-budget products
    const currentProducts =
      subscription.reservedBudgets
        ?.filter(budget => budget.reservedBudget > 0)
        .map(budget => budget.apiName as unknown as SelectableProduct) ?? [];

    const newProducts = Object.entries(formData.selectedProducts ?? {})
      .filter(([_, value]) => value.enabled)
      .map(([key, _]) => key as unknown as SelectableProduct);

    // we need to iterate over both in case either state has more products
    // than the other
    const changes: ProductChange[] = [];
    currentProducts?.forEach(product => {
      if (!newProducts?.includes(product)) {
        changes.push({
          key: product,
          currentValue: true,
          newValue: false,
        });
      }
    });
    newProducts?.forEach(product => {
      if (!currentProducts?.includes(product)) {
        changes.push({
          key: product,
          currentValue: false,
          newValue: true,
        });
      }
    });

    return changes;
  };

  const getReservedChanges = (): ReservedChange[] => {
    const currentReserved: Partial<Record<DataCategory, number>> = {};
    const newReserved: Partial<Record<DataCategory, number>> = {...formData.reserved};
    const nodes: ReservedChange[] = [];

    Object.entries(subscription.categories).forEach(([category, history]) => {
      const reserved = history.reserved ?? 0;
      if (
        currentPlan.checkoutCategories.includes(category as DataCategory) &&
        reserved >= 0
      ) {
        currentReserved[category as DataCategory] = reserved;
      }
    });

    activePlan.checkoutCategories.forEach(category => {
      if (!(category in newReserved)) {
        const firstBucket = activePlan.planCategories[category]?.find(
          bucket => bucket.events >= 0
        );
        newReserved[category] = firstBucket?.events ?? 0;
      }
    });

    if (Object.keys(currentReserved).length > Object.keys(newReserved).length) {
      Object.entries(currentReserved).forEach(([category, currentValue]) => {
        let newValue = null;
        if (category in newReserved) {
          newValue = newReserved[category as DataCategory] ?? null;
        }
        if (newValue !== currentValue) {
          nodes.push({
            key: category as DataCategory,
            currentValue,
            newValue,
          });
        }
      });
    } else {
      Object.entries(newReserved).forEach(([category, newValue]) => {
        let currentValue = null;
        if (category in currentReserved) {
          currentValue = currentReserved[category as DataCategory] ?? null;
        }
        if (newValue !== currentValue) {
          nodes.push({
            key: category as DataCategory,
            currentValue,
            newValue,
          });
        }
      });
    }

    return nodes;
  };

  const getSharedOnDemandChanges = (): SharedOnDemandChange[] => {
    const changes: SharedOnDemandChange[] = [];
    if (
      isEqual(currentOnDemandBudget, newOnDemandBudget) ||
      (currentBudgetMode !== OnDemandBudgetMode.SHARED &&
        newBudgetMode !== OnDemandBudgetMode.SHARED)
    ) {
      return [];
    }

    if (
      currentBudgetMode === OnDemandBudgetMode.SHARED &&
      newBudgetMode === OnDemandBudgetMode.SHARED
    ) {
      changes.push({
        key: 'sharedMaxBudget',
        currentValue: currentOnDemandBudget.sharedMaxBudget,
        newValue: newOnDemandBudget.sharedMaxBudget,
      });
    } else if (currentBudgetMode === OnDemandBudgetMode.SHARED) {
      changes.push({
        key: 'sharedMaxBudget',
        currentValue: currentOnDemandBudget.sharedMaxBudget,
        newValue: null,
      });
    } else if (newBudgetMode === OnDemandBudgetMode.SHARED) {
      changes.push({
        key: 'sharedMaxBudget',
        currentValue: null,
        newValue: newOnDemandBudget.sharedMaxBudget,
      });
    }

    return changes;
  };

  const getPerCategoryOnDemandChanges = (): PerCategoryOnDemandChange[] => {
    const changes: PerCategoryOnDemandChange[] = [];
    if (
      isEqual(currentOnDemandBudget, newOnDemandBudget) ||
      (currentBudgetMode !== OnDemandBudgetMode.SHARED &&
        newBudgetMode !== OnDemandBudgetMode.SHARED)
    ) {
      return [];
    }

    if (
      currentBudgetMode === OnDemandBudgetMode.PER_CATEGORY &&
      newBudgetMode === OnDemandBudgetMode.PER_CATEGORY
    ) {
      const currentBudgetsList = Object.entries(currentOnDemandBudget.budgets);
      const newBudgetsList = Object.entries(newOnDemandBudget.budgets);

      if (currentBudgetsList.length > newBudgetsList.length) {
        currentBudgetsList.forEach(([category, currentBudget]) => {
          const newBudget = newOnDemandBudget.budgets[category as DataCategory];
          if (!(category in newOnDemandBudget.budgets)) {
            changes.push({
              key: category as DataCategory,
              currentValue: currentBudget,
              newValue: null,
            });
          } else if (newBudget !== undefined && currentBudget !== newBudget) {
            changes.push({
              key: category as DataCategory,
              currentValue: currentBudget,
              newValue: newBudget,
            });
          }
        });
      } else {
        newBudgetsList.forEach(([category, newBudget]) => {
          const currentBudget = currentOnDemandBudget.budgets[category as DataCategory];
          if (!(category in currentOnDemandBudget.budgets)) {
            changes.push({
              key: category as DataCategory,
              currentValue: null,
              newValue: newBudget,
            });
          } else if (currentBudget !== undefined && currentBudget !== newBudget) {
            changes.push({
              key: category as DataCategory,
              currentValue: currentBudget,
              newValue: newBudget,
            });
          }
        });
      }
    } else if (currentBudgetMode === OnDemandBudgetMode.PER_CATEGORY) {
      Object.entries(currentOnDemandBudget.budgets).forEach(
        ([category, currentBudget]) => {
          changes.push({
            key: category as DataCategory,
            currentValue: currentBudget,
            newValue: null,
          });
        }
      );
    } else if (newBudgetMode === OnDemandBudgetMode.PER_CATEGORY) {
      Object.entries(newOnDemandBudget.budgets).forEach(([category, newBudget]) => {
        changes.push({
          key: category as DataCategory,
          currentValue: null,
          newValue: newBudget,
        });
      });
    }

    return changes;
  };

  const planChanges = getPlanChanges();
  const productChanges = getProductChanges();
  const reservedChanges = getReservedChanges();
  const sharedOnDemandChanges = getSharedOnDemandChanges();
  const perCategoryOnDemandChanges = getPerCategoryOnDemandChanges();

  const allChanges = [
    ...planChanges,
    ...productChanges,
    ...reservedChanges,
    ...sharedOnDemandChanges,
    ...perCategoryOnDemandChanges,
  ];

  const numChanges = allChanges.length;

  if (numChanges === 0) {
    return null;
  }

  return (
    <CartDiffContainer>
      <Flex justify="between" align="center">
        <Title>{tct('Changes ([numChanges])', {numChanges})}</Title>
        <Button onClick={() => onToggle(!isOpen)} borderless>
          <IconChevron direction={isOpen ? 'up' : 'down'} />
        </Button>
      </Flex>
      {isOpen && (
        <ChangesContainer>
          {planChanges.length + productChanges.length > 0 && (
            <PlanDiff
              currentPlan={currentPlan}
              newPlan={activePlan}
              planChanges={planChanges}
              productChanges={productChanges}
            />
          )}
          {reservedChanges.length > 0 && (
            <ReservedDiff
              currentPlan={currentPlan}
              newPlan={activePlan}
              reservedChanges={reservedChanges}
            />
          )}
          {sharedOnDemandChanges.length + perCategoryOnDemandChanges.length > 0 && (
            <OnDemandDiff
              currentPlan={currentPlan}
              newPlan={activePlan}
              perCategoryOnDemandChanges={perCategoryOnDemandChanges}
              sharedOnDemandChanges={sharedOnDemandChanges}
            />
          )}
        </ChangesContainer>
      )}
    </CartDiffContainer>
  );
}

export default CartDiff;

const CartDiffContainer = styled('div')`
  display: flex;
  flex-direction: column;
  padding: ${p => p.theme.space['2xl']} ${p => p.theme.space.xl};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const ChangesContainer = styled('div')`
  & > div:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }
  max-height: 300px;
  overflow-y: scroll;
`;

const Title = styled('h1')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin: 0;
`;

const Change = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  font-family: ${p => p.theme.text.familyMono};
  background: ${p => p.theme.backgroundSecondary};
  padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.sm};

  &::before {
    content: '-';
  }
`;

const Added = styled(Change)`
  background: #e0ffe3;

  &::before {
    content: '+';
  }

  span {
    background: #a8ecaa;
  }
`;

const Removed = styled(Change)`
  background: ${p => p.theme.red100};

  span {
    background: #f7d4d3;
  }
`;

const ChangedCategory = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
`;

const ChangeSection = styled('div')`
  padding: ${p => p.theme.space.lg} 0;
`;

const ChangeGrid = styled('div')`
  display: grid;
  grid-template-columns: 3fr 2fr 2fr;
  column-gap: ${p => p.theme.space.xs};
  row-gap: ${p => p.theme.space.xs};
  align-items: center;
`;

const ChangeSectionTitle = styled('h2')<{hasBottomMargin?: boolean}>`
  font-size: ${p => p.theme.fontSize.md};
  margin: 0;
  margin-bottom: ${p => (p.hasBottomMargin ? p.theme.space.xs : 0)};
`;
