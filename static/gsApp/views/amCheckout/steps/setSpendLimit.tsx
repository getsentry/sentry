import {useCallback, useMemo, useState} from 'react';

import {Flex} from 'sentry/components/core/layout';
import {t} from 'sentry/locale';

import type {OnDemandBudgets} from 'getsentry/types';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import ReserveAdditionalVolume from 'getsentry/views/amCheckout/reserveAdditionalVolume';
import StepHeader from 'getsentry/views/amCheckout/steps/stepHeader';
import type {SelectableProduct, StepProps} from 'getsentry/views/amCheckout/types';
import {
  getTotalBudget,
  parseOnDemandBudgetsFromSubscription,
} from 'getsentry/views/onDemandBudgets/utils';
import SpendLimitSettings from 'getsentry/views/spendLimits/spendLimitSettings';

function SetSpendCap({
  activePlan,
  formData,
  stepNumber,
  onEdit,
  onUpdate,
  organization,
  subscription,
  checkoutTier,
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
    ({onDemandBudgets}: {onDemandBudgets: OnDemandBudgets}) => {
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
          method: 'textbox',
          isNewCheckout: true,
        });
      }
    },
    [onUpdate, organization, subscription, formData]
  );

  return (
    <Flex direction="column" gap="2xl">
      <SpendLimitSettings
        organization={organization}
        header={
          <StepHeader
            title={t('Set your %s limit', activePlan.budgetTerm)}
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
        onUpdate={({onDemandBudgets}) => handleBudgetChange({onDemandBudgets})}
        currentReserved={formData.reserved}
        additionalProducts={additionalProducts}
        isOpen={isOpen}
        footer={
          <ReserveAdditionalVolume
            activePlan={activePlan}
            formData={formData}
            onUpdate={onUpdate}
            organization={organization}
            subscription={subscription}
            checkoutTier={checkoutTier}
          />
        }
      />
    </Flex>
  );
}

export default SetSpendCap;
