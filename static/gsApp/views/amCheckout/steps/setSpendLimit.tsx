import {useCallback, useState} from 'react';

import {Flex} from 'sentry/components/core/layout';
import {t} from 'sentry/locale';

import type {OnDemandBudgets} from 'getsentry/types';
import {displayBudgetName} from 'getsentry/utils/billing';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import StepHeader from 'getsentry/views/amCheckout/components/stepHeader';
import ReserveAdditionalVolume from 'getsentry/views/amCheckout/steps/reserveAdditionalVolume';
import type {StepProps} from 'getsentry/views/amCheckout/types';
import SpendLimitSettings from 'getsentry/views/spendLimits/spendLimitSettings';
import {
  getTotalBudget,
  parseOnDemandBudgetsFromSubscription,
} from 'getsentry/views/spendLimits/utils';

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
        });
      }
    },
    [onUpdate, organization, subscription, formData]
  );

  return (
    <Flex direction="column" gap="2xl">
      <SpendLimitSettings
        organization={organization}
        subscription={subscription}
        header={
          <StepHeader
            title={t('Set your %s limit', displayBudgetName(activePlan))}
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
        addOns={formData.addOns ?? {}}
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
