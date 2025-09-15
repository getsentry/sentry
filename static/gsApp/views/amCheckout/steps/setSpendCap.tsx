import {useCallback, useMemo, useState} from 'react';

import {capitalize} from 'sentry/utils/string/capitalize';

import type {OnDemandBudgets} from 'getsentry/types';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import StepHeader from 'getsentry/views/amCheckout/steps/stepHeader';
import type {SelectableProduct, StepProps} from 'getsentry/views/amCheckout/types';
import {
  getTotalBudget,
  parseOnDemandBudgetsFromSubscription,
} from 'getsentry/views/onDemandBudgets/utils';
import SpendCapSettings from 'getsentry/views/spendCaps/spendCapSettings';

function SetSpendCap({
  activePlan,
  formData,
  stepNumber,
  onEdit,
  onUpdate,
  organization,
  subscription,
}: StepProps) {
  const [isOpen, setIsOpen] = useState(true);
  const additionalProducts = useMemo(() => {
    return Object.entries(formData.selectedProducts ?? {})
      .filter(([_, product]) => product.enabled)
      .reduce(
        (acc, [product, value]) => {
          acc[product as SelectableProduct] = {
            // TODO(checkout v3): This will need to be updated for non-budget products
            reserved: value.budget ?? 0,
            reservedType: 'budget',
          };
          return acc;
        },
        {} as Record<
          SelectableProduct,
          {reserved: number; reservedType: 'budget' | 'volume'}
        >
      );
  }, [formData.selectedProducts]);

  const handleBudgetChange = useCallback(
    ({
      onDemandBudgets,
      fromButton,
    }: {
      fromButton: boolean;
      onDemandBudgets: OnDemandBudgets;
    }) => {
      const totalBudget = getTotalBudget(onDemandBudgets);
      onUpdate({
        ...formData,
        onDemandBudget: onDemandBudgets,
        onDemandMaxSpend: totalBudget,
      });

      if (organization) {
        trackGetsentryAnalytics('checkout.payg_changed', {
          organization,
          subscription,
          plan: formData.plan,
          cents: totalBudget || 0,
          method: fromButton ? 'button' : 'textbox',
        });
      }
    },
    [onUpdate, organization, subscription, formData]
  );

  return (
    <SpendCapSettings
      header={
        <StepHeader
          title={capitalize(activePlan.budgetTerm)}
          isActive
          stepNumber={stepNumber}
          isCompleted={false}
          onEdit={onEdit}
          isOpen={isOpen}
          onToggleStep={setIsOpen}
          isNewCheckout
        />
      }
      activePlan={activePlan}
      onDemandBudgets={
        formData.onDemandBudget ?? parseOnDemandBudgetsFromSubscription(subscription)
      }
      onUpdate={({onDemandBudgets, fromButton}) =>
        handleBudgetChange({onDemandBudgets, fromButton: !!fromButton})
      }
      currentReserved={formData.reserved}
      additionalProducts={additionalProducts}
      isOpen={isOpen}
    />
  );
}

export default SetSpendCap;
