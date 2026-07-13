import {useMemo} from 'react';

import {Stack, Grid} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';

import {ANNUAL} from 'getsentry/constants';
import {BillingCycleSelectCard} from 'getsentry/views/amCheckout/components/billingCycleSelectCard';
import {StepHeader} from 'getsentry/views/amCheckout/components/stepHeader';
import type {StepProps} from 'getsentry/views/amCheckout/types';
import * as utils from 'getsentry/views/amCheckout/utils';

export function ChooseYourBillingCycle({
  formData,
  onUpdate,
  subscription,
  billingConfig,
  stepNumber,
}: StepProps) {
  const intervalOptions = useMemo(() => {
    // Billing cycle variants of a plan share the same name (e.g. "Business"),
    // differing only by contract interval, so match on that rather than parsing
    // the plan id's interval suffix.
    const selectedPlan = billingConfig.planList.find(p => p.id === formData.plan);
    const plans = billingConfig.planList.filter(p => p.name === selectedPlan?.name);

    if (plans.length === 0) {
      throw new Error('Cannot get billing interval options');
    }

    return plans;
  }, [billingConfig, formData.plan]);

  let previousPlanPrice = 0;
  return (
    <Stack gap="xl" id={`step${stepNumber}`}>
      <StepHeader title={t('Pay monthly or yearly, your choice')} />
      <Grid
        columns={{
          'screen:xs': '1fr',
          'screen:lg': `repeat(${intervalOptions.length}, 1fr)`,
        }}
        gap="lg"
      >
        {intervalOptions.map(plan => {
          const isSelected = plan.id === formData.plan;
          const isAnnual = plan.billingInterval === ANNUAL;
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
    </Stack>
  );
}
