import {useMemo} from 'react';

import {Flex, Grid} from 'sentry/components/core/layout';
import {t} from 'sentry/locale';

import {ANNUAL} from 'getsentry/constants';
import BillingCycleSelectCard from 'getsentry/views/amCheckout/components/billingCycleSelectCard';
import StepHeader from 'getsentry/views/amCheckout/components/stepHeader';
import type {StepProps} from 'getsentry/views/amCheckout/types';
import * as utils from 'getsentry/views/amCheckout/utils';

function ChooseYourBillingCycle({
  formData,
  onUpdate,
  subscription,
  billingConfig,
  stepNumber,
}: StepProps) {
  const intervalOptions = useMemo(() => {
    const basePlan = formData.plan.replace('_test', '').replace('_auf', '');
    const plans = billingConfig.planList.filter(({id}) => id.indexOf(basePlan) === 0);

    if (plans.length === 0) {
      throw new Error('Cannot get billing interval options');
    }

    return plans;
  }, [billingConfig, formData.plan]);

  let previousPlanPrice = 0;
  return (
    <Flex direction="column" gap="xl">
      <StepHeader
        stepNumber={stepNumber}
        title={t('Pay monthly or yearly, your choice')}
      />
      <Grid columns={{xs: '1fr', md: `repeat(${intervalOptions.length}, 1fr)`}} gap="xl">
        {intervalOptions.map(plan => {
          const isSelected = plan.id === formData.plan;
          const isAnnual = plan.contractInterval === ANNUAL;
          const priceAfterDiscount = utils.getReservedPriceCents({
            plan,
            reserved: formData.reserved,
            addOns: formData.addOns,
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
  );
}

export default ChooseYourBillingCycle;
