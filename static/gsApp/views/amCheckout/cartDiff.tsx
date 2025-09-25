import React, {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {capitalize} from 'sentry/utils/string/capitalize';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import {
  OnDemandBudgetMode,
  type Plan,
  type SharedOnDemandBudget,
  type Subscription,
} from 'getsentry/types';
import {formatReservedWithUnits, isNewPayingCustomer} from 'getsentry/utils/billing';
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

type PlanChange = CheckoutChange<'plan', string>;

type CycleChange = CheckoutChange<'contractInterval', string>;

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
  cycleChanges,
}: {
  currentPlan: Plan;
  cycleChanges: CycleChange[];
  newPlan: Plan;
  planChanges: PlanChange[];
  productChanges: ProductChange[];
}) {
  const changes = [...planChanges, ...productChanges, ...cycleChanges];
  return (
    <ChangeSection data-test-id="plan-diff">
      <ChangeGrid>
        {changes.map((change, index) => {
          const {key, currentValue, newValue} = change;
          let leftComponent = <div />;
          if (index === 0) {
            leftComponent = <ChangeSectionTitle>{t('Plan')}</ChangeSectionTitle>;
          }
          let formattingFunction = (value: any) => value;
          if (key === 'plan' || key === 'contractInterval') {
            formattingFunction = (value: any) =>
              value === 'annual' ? t('Yearly') : value ? capitalize(value) : null;
          } else {
            formattingFunction = (value: any) =>
              value
                ? toTitleCase(
                    newPlan.addOnCategories[key]?.productName ??
                      currentPlan.addOnCategories[key]?.productName ??
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
    <ChangeSection data-test-id="reserved-diff">
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
                    plan: newValue === null ? currentPlan : newPlan,
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
        <ChangeSection data-test-id="shared-spend-limit-diff">
          <ChangeGrid>
            {sharedOnDemandChanges.map((change, index) => {
              const {key, currentValue, newValue} = change;
              let leftComponent = <div />;
              if (index === 0) {
                leftComponent = (
                  <ChangeSectionTitle>
                    {newPlan.budgetTerm === 'pay-as-you-go'
                      ? t('PAYG spend limit')
                      : t('Shared spend limit')}
                  </ChangeSectionTitle>
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
        <ChangeSection data-test-id="per-category-spend-limit-diff">
          <ChangeSectionTitle hasBottomMargin>
            {t('Per-category spend limits')}
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
                        plan: newValue === null ? currentPlan : newPlan,
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
  isOpen,
  onToggle,
  organization,
}: {
  activePlan: Plan;
  formData: CheckoutFormData;
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
  organization: Organization;
  subscription: Subscription;
}) {
  const currentPlan = subscription.planDetails;
  const currentOnDemandBudget = parseOnDemandBudgetsFromSubscription(subscription);
  const newOnDemandBudget = formData.onDemandBudget ?? DEFAULT_PAYG_BUDGET;
  const currentBudgetMode = currentOnDemandBudget.budgetMode;
  const newBudgetMode = newOnDemandBudget.budgetMode;

  const getPlanChanges = useCallback((): PlanChange[] => {
    if (activePlan.name !== currentPlan.name) {
      return [
        {
          key: 'plan',
          currentValue: currentPlan.name,
          newValue: activePlan.name,
        },
      ];
    }
    return [];
  }, [activePlan, currentPlan]);

  const getCycleChanges = useCallback((): CycleChange[] => {
    if (activePlan.contractInterval !== currentPlan.contractInterval) {
      return [
        {
          key: 'contractInterval',
          currentValue: currentPlan.contractInterval,
          newValue: activePlan.contractInterval,
        },
      ];
    }
    return [];
  }, [activePlan, currentPlan]);

  const getProductChanges = useCallback((): ProductChange[] => {
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
  }, [formData.selectedProducts, subscription.reservedBudgets]);

  const getCategoryChanges = ({
    currentValues,
    newValues,
  }: {
    currentValues: Partial<Record<DataCategory, number>>;
    newValues: Partial<Record<DataCategory, number>>;
  }): ReservedChange[] | PerCategoryOnDemandChange[] => {
    const nodes: ReservedChange[] | PerCategoryOnDemandChange[] = [];

    Object.entries(newValues).forEach(([category, newValue]) => {
      let currentValue = null;
      if (category in currentValues) {
        currentValue = currentValues[category as DataCategory] ?? null;
      }
      if (newValue !== currentValue) {
        nodes.push({
          key: category as DataCategory,
          currentValue,
          newValue,
        });
      }
    });

    // in case there are categories in the current plan that are not in the new plan
    Object.entries(currentValues).forEach(([category, currentValue]) => {
      if (!(category in newValues)) {
        nodes.push({
          key: category as DataCategory,
          currentValue,
          newValue: null,
        });
      }
    });

    return nodes;
  };

  const getReservedChanges = useCallback((): ReservedChange[] => {
    const productCategories = Object.values(activePlan.addOnCategories).flatMap(
      addOnInfo => addOnInfo.dataCategories
    );

    const currentReserved: Partial<Record<DataCategory, number>> = {};
    const relevantFormDataReserved = Object.fromEntries(
      Object.entries(formData.reserved).filter(
        ([category, _]) => !productCategories.includes(category as DataCategory)
      )
    );
    const newReserved: Partial<Record<DataCategory, number>> = {
      ...relevantFormDataReserved,
    };

    // XXX(isabella): For some reason we populate formData with reserved volumes
    // for non-checkout categories, so for now we need to compare all reserved
    // volumes so that non-checkout categories are not shown as changes.
    Object.entries(subscription.categories)
      .filter(([category, _]) => !productCategories.includes(category as DataCategory))
      .forEach(([category, history]) => {
        const reserved = history.reserved;
        if (reserved !== null) {
          currentReserved[category as DataCategory] = reserved;
        }
      });

    activePlan.categories
      .filter(category => !productCategories.includes(category))
      .forEach(category => {
        if (category in currentReserved && !(category in newReserved)) {
          const firstBucket = activePlan.planCategories[category]?.find(
            bucket => bucket.events >= 0
          );
          if (firstBucket !== undefined) {
            newReserved[category] = firstBucket.events;
          }
        }
      });

    return getCategoryChanges({
      currentValues: currentReserved,
      newValues: newReserved,
    });
  }, [activePlan, formData.reserved, subscription.categories]);

  const getSharedOnDemandChanges = useCallback((): SharedOnDemandChange[] => {
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
  }, [currentOnDemandBudget, newOnDemandBudget, currentBudgetMode, newBudgetMode]);

  const getPerCategoryOnDemandChanges = useCallback((): PerCategoryOnDemandChange[] => {
    if (
      isEqual(currentOnDemandBudget, newOnDemandBudget) ||
      (currentBudgetMode !== OnDemandBudgetMode.PER_CATEGORY &&
        newBudgetMode !== OnDemandBudgetMode.PER_CATEGORY)
    ) {
      return [];
    }
    const parsedCurrentOnDemandBudget =
      'budgets' in currentOnDemandBudget ? currentOnDemandBudget.budgets : {};
    const parsedNewOnDemandBudget =
      'budgets' in newOnDemandBudget ? newOnDemandBudget.budgets : {};
    return getCategoryChanges({
      currentValues: parsedCurrentOnDemandBudget,
      newValues: parsedNewOnDemandBudget,
    });
  }, [currentOnDemandBudget, newOnDemandBudget, currentBudgetMode, newBudgetMode]);

  const planChanges = useMemo(() => getPlanChanges(), [getPlanChanges]);
  const cycleChanges = useMemo(() => getCycleChanges(), [getCycleChanges]);
  const productChanges = useMemo(() => getProductChanges(), [getProductChanges]);
  const reservedChanges = useMemo(() => getReservedChanges(), [getReservedChanges]);
  const sharedOnDemandChanges = useMemo(
    () => getSharedOnDemandChanges(),
    [getSharedOnDemandChanges]
  );
  const perCategoryOnDemandChanges = useMemo(
    () => getPerCategoryOnDemandChanges(),
    [getPerCategoryOnDemandChanges]
  );

  const allChanges = useMemo(
    () => [
      ...planChanges,
      ...productChanges,
      ...cycleChanges,
      ...reservedChanges,
      ...sharedOnDemandChanges,
      ...perCategoryOnDemandChanges,
    ],
    [
      planChanges,
      productChanges,
      cycleChanges,
      reservedChanges,
      sharedOnDemandChanges,
      perCategoryOnDemandChanges,
    ]
  );

  if (allChanges.length === 0 || isNewPayingCustomer(subscription, organization)) {
    return null;
  }

  return (
    <Flex
      data-test-id="cart-diff"
      direction="column"
      padding="xl"
      border="primary"
      background="primary"
      radius="md"
    >
      <Flex justify="between" align="center">
        <Title>{tct('Changes ([numChanges])', {numChanges: allChanges.length})}</Title>
        <Button
          aria-label={`${isOpen ? 'Hide' : 'Show'} changes`}
          onClick={() => onToggle(!isOpen)}
          borderless
          icon={<IconChevron direction={isOpen ? 'up' : 'down'} />}
        />
      </Flex>
      {isOpen && (
        <ChangesContainer>
          {planChanges.length + productChanges.length + cycleChanges.length > 0 && (
            <PlanDiff
              currentPlan={currentPlan}
              newPlan={activePlan}
              planChanges={planChanges}
              productChanges={productChanges}
              cycleChanges={cycleChanges}
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
    </Flex>
  );
}

export default CartDiff;

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
