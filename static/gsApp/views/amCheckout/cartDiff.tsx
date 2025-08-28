import React, {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {t} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';
import {capitalize} from 'sentry/utils/string/capitalize';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import {RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import {
  OnDemandBudgetMode,
  ReservedBudgetCategoryType,
  type OnDemandBudgets,
  type Plan,
  type SharedOnDemandBudget,
  type Subscription,
} from 'getsentry/types';
import {
  formatReservedWithUnits,
  isDeveloperPlan,
  isTrialPlan,
} from 'getsentry/utils/billing';
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';
import type {CheckoutFormData, SelectableProduct} from 'getsentry/views/amCheckout/types';
import * as utils from 'getsentry/views/amCheckout/utils';
import {parseOnDemandBudgets} from 'getsentry/views/onDemandBudgets/utils';

const DEFAULT_PAYG_BUDGET: SharedOnDemandBudget = {
  budgetMode: OnDemandBudgetMode.SHARED,
  sharedMaxBudget: 0,
};

type SubscriptionState = {
  contractInterval: Plan['contractInterval'];
  onDemandBudgets: OnDemandBudgets;
  planName: string;
  products: Partial<Record<SelectableProduct, boolean>>;
  reserved: Partial<Record<DataCategory, number>>;
};

function OnDemandDiff({
  currentPlan,
  newPlan,
  currentOnDemandBudgets,
  newOnDemandBudgets,
}: {
  currentOnDemandBudgets: OnDemandBudgets;
  currentPlan: Plan;
  newOnDemandBudgets: OnDemandBudgets;
  newPlan: Plan;
}) {
  const currentBudgetMode = currentOnDemandBudgets.budgetMode;
  const newBudgetMode = newOnDemandBudgets.budgetMode;

  if (currentBudgetMode !== newBudgetMode) {
    const sharedToPerCategory =
      currentBudgetMode === OnDemandBudgetMode.SHARED &&
      newBudgetMode === OnDemandBudgetMode.PER_CATEGORY;
    const perCategoryToShared =
      currentBudgetMode === OnDemandBudgetMode.PER_CATEGORY &&
      newBudgetMode === OnDemandBudgetMode.SHARED;

    if (sharedToPerCategory) {
      const budgetsList = Object.entries(newOnDemandBudgets.budgets);
      const combinedBudget = budgetsList.reduce((acc, [_, budget]) => acc + budget, 0);

      if (currentOnDemandBudgets.sharedMaxBudget === 0 && combinedBudget === 0) {
        return null;
      }

      return (
        <Fragment>
          {budgetsList
            .filter(([_, budget]) => budget > 0)
            .map(([category, budget]) => {
              const showOldBudget = budgetsList.indexOf([category, budget]) === 0;
              const formattedCategory = getPlanCategoryName({
                plan: newPlan,
                category: category as DataCategory,
                title: true,
              });

              return (
                <Fragment key={category}>
                  {showOldBudget ? (
                    <Removed>
                      {t('Shared spend cap')}
                      <span>{utils.displayPrice({cents: budget})}</span>
                    </Removed>
                  ) : (
                    <Change />
                  )}
                  <Added>
                    {t('%s spend cap', formattedCategory)}
                    <span>{utils.displayPrice({cents: budget})}</span>
                  </Added>
                </Fragment>
              );
            })}
        </Fragment>
      );
    }

    if (perCategoryToShared) {
      const budgetsList = Object.entries(currentOnDemandBudgets.budgets);
      return (
        <Fragment>
          {budgetsList
            .filter(([_, budget]) => budget > 0)
            .map(([category, budget]) => {
              const showNewBudget = budgetsList.indexOf([category, budget]) === 0;
              const formattedCategory = getPlanCategoryName({
                plan: currentPlan,
                category: category as DataCategory,
                title: true,
              });

              return (
                <Fragment key={category}>
                  <Removed>
                    {t('%s spend cap', formattedCategory)}
                    <span>${utils.displayPrice({cents: budget})}</span>
                  </Removed>
                  {showNewBudget ? (
                    <Added>
                      {t('Shared spend cap')}
                      <span>${utils.displayPrice({cents: budget})}</span>
                    </Added>
                  ) : (
                    <Change />
                  )}
                </Fragment>
              );
            })}
        </Fragment>
      );
    }
  }

  if (
    currentBudgetMode === OnDemandBudgetMode.SHARED &&
    newBudgetMode === OnDemandBudgetMode.SHARED
  ) {
    return (
      <Fragment>
        <Removed>
          {t('Spend cap')}
          <span>
            {' '}
            {utils.displayPrice({cents: currentOnDemandBudgets.sharedMaxBudget})}
          </span>
        </Removed>
        <Added>
          {t('Spend cap')}
          <span> {utils.displayPrice({cents: newOnDemandBudgets.sharedMaxBudget})}</span>
        </Added>
      </Fragment>
    );
  }

  if (
    currentBudgetMode === OnDemandBudgetMode.PER_CATEGORY &&
    newBudgetMode === OnDemandBudgetMode.PER_CATEGORY
  ) {
    const currentBudgetsList = Object.entries(currentOnDemandBudgets.budgets);
    const newBudgetsList = Object.entries(newOnDemandBudgets.budgets);
    const hasNewCategories = newBudgetsList.length > currentBudgetsList.length;

    if (hasNewCategories) {
      return newBudgetsList.map(([category, budget]) => {
        const formattedCategory = getPlanCategoryName({
          plan: currentPlan,
          category: category as DataCategory,
          title: true,
        });

        const currentBudgetEquivalent = currentBudgetsList.find(
          ([currentCategory, _]) => currentCategory === category
        )?.[1];

        if (
          budget === currentBudgetEquivalent ||
          (budget === 0 && !currentBudgetEquivalent)
        ) {
          return null;
        }

        return (
          <Fragment key={category}>
            {currentBudgetEquivalent ? (
              <Removed>
                {t('%s spend cap', formattedCategory)}
                <span>{utils.displayPrice({cents: currentBudgetEquivalent})}</span>
              </Removed>
            ) : (
              <Change />
            )}
            <Added>
              {t('%s spend cap', formattedCategory)}
              <span>{utils.displayPrice({cents: budget})}</span>
            </Added>
          </Fragment>
        );
      });
    }

    return currentBudgetsList.map(([category, budget]) => {
      const formattedCategory = getPlanCategoryName({
        plan: currentPlan,
        category: category as DataCategory,
        title: true,
      });

      const newBudgetEquivalent = newBudgetsList.find(
        ([newCategory, _]) => newCategory === category
      )?.[1];

      if (budget === newBudgetEquivalent || (budget === 0 && !newBudgetEquivalent)) {
        return null;
      }

      return (
        <Fragment key={category}>
          <Removed>
            {t('%s spend cap', formattedCategory)}
            <span>{utils.displayPrice({cents: budget})}</span>
          </Removed>
          {newBudgetEquivalent ? (
            <Added>
              {t('%s spend cap', formattedCategory)}
              <span>{utils.displayPrice({cents: newBudgetEquivalent})}</span>
            </Added>
          ) : (
            <Change />
          )}
        </Fragment>
      );
    });
  }

  return null; // shouldn't happen
}

function ProductDiff({
  currentPlan,
  newPlan,
  currentProducts,
  newProducts,
}: {
  currentPlan: Plan;
  currentProducts: Partial<Record<SelectableProduct, boolean>>;
  newPlan: Plan;
  newProducts: Partial<Record<SelectableProduct, boolean>>;
}) {
  const newProductsList: Array<[SelectableProduct, boolean]> = Object.entries(
    newProducts
  ).map(([product, enabled]) => [product as SelectableProduct, enabled]);
  const currentProductsList: Array<[SelectableProduct, boolean]> = Object.entries(
    currentProducts
  ).map(([product, enabled]) => [product as SelectableProduct, enabled]);
  const newPlanHasMoreProducts = newProductsList.length > currentProductsList.length;

  if (newPlanHasMoreProducts) {
    return newProductsList.map(([product, willBeEnabled]) => {
      const currentProductEquivalent = currentProductsList.find(
        ([currentProduct, _]) => currentProduct === product
      );
      const currentlyEnabled = !!currentProductEquivalent?.[1];

      if (willBeEnabled === currentlyEnabled || (!willBeEnabled && !currentlyEnabled)) {
        return null;
      }

      const newProductName =
        newPlan.availableReservedBudgetTypes[
          product as unknown as ReservedBudgetCategoryType
        ]!.productCheckoutName;
      const currentProductName =
        currentPlan.availableReservedBudgetTypes[
          product as unknown as ReservedBudgetCategoryType
        ]?.productCheckoutName;

      return (
        <Fragment key={product}>
          {currentlyEnabled ? (
            <Removed>
              <span>{toTitleCase(currentProductName!, {allowInnerUpperCase: true})}</span>
            </Removed>
          ) : (
            <Change />
          )}
          {willBeEnabled && (
            <Added>
              <span>{toTitleCase(newProductName, {allowInnerUpperCase: true})}</span>
            </Added>
          )}
        </Fragment>
      );
    });
  }

  return currentProductsList.map(([product, currentlyEnabled]) => {
    const newProductEquivalent = newProductsList.find(
      ([newProduct, _]) => newProduct === product
    );
    const willBeEnabled = !!newProductEquivalent?.[1];

    if (currentlyEnabled === willBeEnabled || (!currentlyEnabled && !willBeEnabled)) {
      return null;
    }

    const newProductName =
      newPlan.availableReservedBudgetTypes[
        product as unknown as ReservedBudgetCategoryType
      ]?.productCheckoutName;
    const currentProductName =
      currentPlan.availableReservedBudgetTypes[
        product as unknown as ReservedBudgetCategoryType
      ]!.productCheckoutName;

    return (
      <Fragment key={product}>
        {currentlyEnabled && (
          <Removed>
            <span>{toTitleCase(currentProductName, {allowInnerUpperCase: true})}</span>
          </Removed>
        )}
        {willBeEnabled ? (
          <Added>
            <span>{toTitleCase(newProductName!, {allowInnerUpperCase: true})}</span>
          </Added>
        ) : (
          <Change />
        )}
      </Fragment>
    );
  });
}

function ReservedDiff({
  currentPlan,
  newPlan,
  currentReservedVolumes,
  newReservedVolumes,
}: {
  currentPlan: Plan;
  currentReservedVolumes: Partial<Record<DataCategory, number>>;
  newPlan: Plan;
  newReservedVolumes: Partial<Record<DataCategory, number>>;
}) {
  const currentReservedList = Object.entries(currentReservedVolumes);
  const newReservedList = Object.entries(newReservedVolumes);

  const hasNewCategories = newReservedList.length > currentReservedList.length;

  if (hasNewCategories) {
    return newReservedList.map(([category, newReserved]) => {
      const currentEquivalent = currentReservedList.find(
        ([currentCategory, _]) => currentCategory === category
      );
      const currentReserved = currentEquivalent?.[1] ?? 0;

      if (currentReserved === newReserved) {
        return null;
      }

      const currentPlanCategoryName = currentEquivalent
        ? getPlanCategoryName({
            plan: currentPlan,
            category: category as DataCategory,
            title: true,
          })
        : null;
      const newPlanCategoryName = getPlanCategoryName({
        plan: newPlan,
        category: category as DataCategory,
        title: true,
      });

      const currentFormattedReserved = formatReservedWithUnits(
        currentReserved,
        category as DataCategory,
        {
          isAbbreviated: true,
          useUnitScaling: true,
        }
      );

      const newFormattedReserved = formatReservedWithUnits(
        newReserved,
        category as DataCategory,
        {
          isAbbreviated: true,
          useUnitScaling: true,
        }
      );

      return (
        <Fragment key={category}>
          {currentPlanCategoryName ? (
            <Removed>
              <span>{currentFormattedReserved}</span> {currentPlanCategoryName}
            </Removed>
          ) : (
            <Change />
          )}
          <Added>
            {currentEquivalent ? (
              <Fragment>
                <span>{newFormattedReserved}</span> {newPlanCategoryName}
              </Fragment>
            ) : (
              <span>
                {newFormattedReserved} {newPlanCategoryName}
              </span>
            )}
          </Added>
        </Fragment>
      );
    });
  }

  return currentReservedList.map(([category, currentReserved]) => {
    const newEquivalent = newReservedList.find(
      ([newCategory, _]) => newCategory === category
    );
    const newReserved = newEquivalent?.[1] ?? 0;

    if (currentReserved === newReserved) {
      return null;
    }

    const currentPlanCategoryName = getPlanCategoryName({
      plan: currentPlan,
      category: category as DataCategory,
      title: true,
    });

    const newPlanCategoryName = newEquivalent
      ? getPlanCategoryName({
          plan: newPlan,
          category: category as DataCategory,
          title: true,
        })
      : null;

    const currentFormattedReserved = formatReservedWithUnits(
      currentReserved,
      category as DataCategory,
      {
        isAbbreviated: true,
        useUnitScaling: true,
      }
    );

    const newFormattedReserved = formatReservedWithUnits(
      newReserved,
      category as DataCategory,
      {
        isAbbreviated: true,
        useUnitScaling: true,
      }
    );

    return (
      <Fragment key={category}>
        <Removed>
          {newEquivalent ? (
            <Fragment>
              <span>{currentFormattedReserved}</span> {currentPlanCategoryName}
            </Fragment>
          ) : (
            <span>
              {currentFormattedReserved} {currentPlanCategoryName}
            </span>
          )}
        </Removed>
        {newPlanCategoryName ? (
          <Added>
            <span>{newFormattedReserved}</span> {newPlanCategoryName}
          </Added>
        ) : (
          <Change />
        )}
      </Fragment>
    );
  });
}

function CartDiff({
  activePlan,
  formData,
  subscription,
  freePlan,
}: {
  activePlan: Plan;
  formData: CheckoutFormData;
  freePlan: Plan;
  subscription: Subscription;
}) {
  const newSubscriptionState: SubscriptionState = useMemo(() => {
    return {
      planName: activePlan.name,
      contractInterval: activePlan.contractInterval,
      onDemandBudgets: formData.onDemandBudget ?? DEFAULT_PAYG_BUDGET,
      products: Object.entries(formData.selectedProducts ?? {}).reduce(
        (acc, [product, data]) => {
          acc[product as unknown as SelectableProduct] = data.enabled;
          return acc;
        },
        {} as Partial<Record<SelectableProduct, boolean>>
      ),
      reserved: activePlan.categories.reduce(
        (acc, category) => {
          const isReservedBudgetCategory = Object.values(
            activePlan.availableReservedBudgetTypes
          ).some(budgetType => budgetType.dataCategories.includes(category));
          if (
            !isReservedBudgetCategory ||
            (formData.reserved[category] &&
              formData.reserved[category] !== RESERVED_BUDGET_QUOTA)
          ) {
            acc[category] = formData.reserved[category] ?? 0;
          }
          return acc;
        },
        {} as Partial<Record<DataCategory, number>>
      ),
    };
  }, [activePlan, formData]);

  const isOnTrialPlan = useMemo(() => {
    return isTrialPlan(subscription.plan);
  }, [subscription.plan]);

  const currentSubscriptionState: SubscriptionState = useMemo(() => {
    const plan = isOnTrialPlan ? freePlan : subscription.planDetails;
    return {
      planName: plan.name,
      contractInterval: plan.contractInterval,
      onDemandBudgets: subscription.onDemandBudgets
        ? parseOnDemandBudgets(subscription.onDemandBudgets)
        : DEFAULT_PAYG_BUDGET,
      products: Object.entries(subscription.reservedBudgets ?? {}).reduce(
        (acc, [_, reservedBudget]) => {
          acc[reservedBudget.apiName as unknown as SelectableProduct] =
            reservedBudget.reservedBudget > 0 && !isOnTrialPlan;
          return acc;
        },
        {} as Partial<Record<SelectableProduct, boolean>>
      ),
      reserved: isOnTrialPlan
        ? Object.entries(freePlan.planCategories).reduce(
            (acc, [category, buckets]) => {
              acc[category as DataCategory] = buckets[0]?.events ?? 0;
              return acc;
            },
            {} as Partial<Record<DataCategory, number>>
          )
        : Object.entries(subscription.categories).reduce(
            (acc, [category, history]) => {
              const isReservedBudgetCategory = Object.values(
                subscription.planDetails.availableReservedBudgetTypes
              ).some(budgetType =>
                budgetType.dataCategories.includes(category as DataCategory)
              );
              if (
                !isReservedBudgetCategory ||
                (history.reserved !== RESERVED_BUDGET_QUOTA && history.reserved !== 0)
              ) {
                acc[category as DataCategory] = history.reserved ?? 0;
              }
              return acc;
            },
            {} as Partial<Record<DataCategory, number>>
          ),
    };
  }, [freePlan, isOnTrialPlan, subscription]);

  const isChanged = (currentValue: any, newValue: any) => {
    // TODO(ISABELLA): NEED TO FILTER OUT 0 PER-CATEGORY
    if (typeof currentValue === 'object' && typeof newValue === 'object') {
      return !isEqual(currentValue, newValue);
    }

    return currentValue !== newValue;
  };

  const changedKeys: Array<keyof SubscriptionState> = useMemo(() => {
    return Object.entries(newSubscriptionState)
      .filter(([key, value]) => {
        return isChanged(currentSubscriptionState[key as keyof SubscriptionState], value);
      })
      .map(([key]) => key as keyof SubscriptionState);
  }, [newSubscriptionState, currentSubscriptionState]);

  const hasAnyChange = useMemo(() => {
    const naiveComparison = !isEqual(newSubscriptionState, currentSubscriptionState);

    if (!naiveComparison) {
      return false; // if the two objects are exactly equal, there is no change
    }

    const someNonCategoryChange = Object.entries(newSubscriptionState)
      .filter(([key, _]) => key !== 'reserved')
      .some(([key, value]) => {
        return isChanged(currentSubscriptionState[key as keyof SubscriptionState], value);
      });

    if (someNonCategoryChange) {
      return true;
    }

    const currentPlanCategories = subscription.planDetails.categories;
    const newPlanCategories = activePlan.categories;

    if (isEqual(currentPlanCategories, newPlanCategories)) {
      return naiveComparison; // no new categories or removed categories, so the naive comparison is enough
    }

    let hasSomeCategoryChange = false;
    for (const category of newPlanCategories) {
      if (currentPlanCategories.includes(category)) {
        hasSomeCategoryChange =
          currentSubscriptionState.reserved[category] !==
          newSubscriptionState.reserved[category];
      } else {
        hasSomeCategoryChange = newSubscriptionState.reserved[category] !== 0;
      }

      if (hasSomeCategoryChange) {
        break;
      }
    }

    for (const category of currentPlanCategories) {
      if (!newPlanCategories.includes(category)) {
        hasSomeCategoryChange = currentSubscriptionState.reserved[category] !== 0;
      }

      if (hasSomeCategoryChange) {
        break;
      }
    }

    return hasSomeCategoryChange;
  }, [
    newSubscriptionState,
    currentSubscriptionState,
    activePlan.categories,
    subscription.planDetails.categories,
  ]);

  // TODO(checkout v3): this will need to be updated once
  // things can be bought on developer
  if (isDeveloperPlan(activePlan) || !hasAnyChange) {
    return null;
  }

  return (
    <CartDiffContainer>
      <Title>{t('Changes')}</Title>
      <Changes>
        {changedKeys.map(key => {
          if (key === 'onDemandBudgets') {
            const currentOnDemandBudgets = currentSubscriptionState[key];
            const newOnDemandBudgets = newSubscriptionState[key];

            if (!isChanged(currentOnDemandBudgets, newOnDemandBudgets)) {
              return null;
            }

            return (
              <OnDemandDiff
                key={key}
                currentPlan={subscription.planDetails}
                newPlan={activePlan}
                currentOnDemandBudgets={currentOnDemandBudgets}
                newOnDemandBudgets={newOnDemandBudgets}
              />
            );
          }

          if (key === 'products') {
            return (
              <ProductDiff
                key={key}
                currentPlan={subscription.planDetails}
                newPlan={activePlan}
                currentProducts={currentSubscriptionState.products}
                newProducts={newSubscriptionState.products}
              />
            );
          }

          if (key === 'reserved') {
            return (
              <ReservedDiff
                key={key}
                currentPlan={subscription.planDetails}
                newPlan={activePlan}
                currentReservedVolumes={currentSubscriptionState.reserved}
                newReservedVolumes={newSubscriptionState.reserved}
              />
            );
          }

          const currentValue: string = currentSubscriptionState[key];
          const newValue: string = newSubscriptionState[key];
          let formattingFunction = (value: any): React.ReactNode => value;
          switch (key) {
            case 'contractInterval':
              formattingFunction = (value: SubscriptionState['contractInterval']) => (
                <span>{capitalize(value)}</span>
              );
              break;
            case 'planName':
              formattingFunction = (value: SubscriptionState['planName']) => (
                <Fragment>
                  <span>{value}</span> {t('Plan')}
                </Fragment>
              );
              break;
            default:
              break;
          }

          const formattedCurrentValue = formattingFunction(currentValue);
          const formattedNewValue = formattingFunction(newValue);

          return (
            <Fragment key={key}>
              <Removed>{formattedCurrentValue}</Removed>
              <Added>{formattedNewValue}</Added>
            </Fragment>
          );
        })}
      </Changes>
    </CartDiffContainer>
  );
}

export default CartDiff;

const CartDiffContainer = styled('div')`
  display: flex;
  flex-direction: column;
  padding: 0 ${p => p.theme.space.xl} ${p => p.theme.space['2xl']};
  margin-bottom: ${p => p.theme.space.xl};
`;

const Title = styled('h1')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin: 0 0 ${p => p.theme.space.xl};
`;

const Changes = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  row-gap: ${p => p.theme.space.xs};
  column-gap: ${p => p.theme.space.xs};

  &::before {
    position: absolute;
    left: ${p => p.theme.space['2xs']};
  }
`;

const Change = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
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

  &::before {
    content: '-';
  }

  span {
    background: #f7d4d3;
  }
`;
