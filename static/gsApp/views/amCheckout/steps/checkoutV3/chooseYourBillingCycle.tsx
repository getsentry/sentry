import {useMemo, useState} from 'react';

import {Flex, Grid} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {t} from 'sentry/locale';

import {ANNUAL} from 'getsentry/constants';
import BillingCycleSelectCard from 'getsentry/views/amCheckout/billingCycleSelectCard';
import StepHeader from 'getsentry/views/amCheckout/steps/stepHeader';
import type {CheckoutV3StepProps} from 'getsentry/views/amCheckout/types';
import * as utils from 'getsentry/views/amCheckout/utils';

function ChooseYourBillingCycle({
  formData,
  onUpdate,
  subscription,
  billingConfig,
  onEdit,
  stepNumber,
}: CheckoutV3StepProps) {
  const [isOpen, setIsOpen] = useState(true);
  const intervalOptions = useMemo(() => {
    const basePlan = formData.plan.replace('_auf', '');
    const plans = billingConfig.planList.filter(({id}) => id.indexOf(basePlan) === 0);

    if (plans.length === 0) {
      throw new Error('Cannot get billing interval options');
    }

    return plans;
  }, [billingConfig, formData.plan]);

  let previousPlanPrice = 0;
  return (
    <Flex direction="column" gap="sm">
      <StepHeader
        isActive
        isCompleted={false}
        onEdit={onEdit}
        onToggleStep={setIsOpen}
        isOpen={isOpen}
        stepNumber={stepNumber}
        title={t('Choose your billing cycle')}
        isNewCheckout
      />
      {isOpen && (
        <Flex direction="column" gap="xl">
          <Text as="div" variant="muted">
            {t('Additional usage is billed separately, at the start of the next cycle')}
          </Text>
          <Grid
            columns={{xs: '1fr', md: `repeat(${intervalOptions.length}, 1fr)`}}
            gap="xl"
          >
            {intervalOptions.map(plan => {
              const isSelected = plan.id === formData.plan;
              const isAnnual = plan.contractInterval === ANNUAL;
              const priceAfterDiscount = utils.getReservedPriceCents({
                plan,
                reserved: formData.reserved,
                selectedProducts: formData.selectedProducts,
              });
              const formattedPriceAfterDiscount = utils.formatPrice({
                cents: priceAfterDiscount,
              });

              const priceBeforeDiscount = isAnnual ? previousPlanPrice * 12 : 0;
              const formattedPriceBeforeDiscount = previousPlanPrice
                ? utils.formatPrice({cents: priceBeforeDiscount})
                : '';
              previousPlanPrice = priceAfterDiscount;

              return (
                <BillingCycleSelectCard
                  key={plan.id}
                  plan={plan}
                  isSelected={isSelected}
                  onUpdate={onUpdate}
                  subscription={subscription}
                  formattedPriceAfterDiscount={formattedPriceAfterDiscount}
                  formattedPriceBeforeDiscount={formattedPriceBeforeDiscount}
                  priceAfterDiscount={priceAfterDiscount}
                />
              );
            })}
          </Grid>
        </Flex>
      )}
    </Flex>
  );
}

export default ChooseYourBillingCycle;
