import {useMemo, type ReactNode} from 'react';
import moment from 'moment-timezone';

import {Tag} from '@sentry/scraps/badge';
import {Flex, Stack, Grid} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
import {ToggleCard} from '@sentry/scraps/toggleCard';

import {t, tct} from 'sentry/locale';

import {ANNUAL} from 'getsentry/constants';
import {displayBudgetName, formatPrice, isDeveloperPlan} from 'getsentry/utils/billing';
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
          zero: '1fr',
          '4xl': `repeat(${intervalOptions.length}, 1fr)`,
        }}
        gap="lg"
        role="radiogroup"
        aria-label={t('Billing cycle')}
      >
        {intervalOptions.map(plan => {
          const isSelected = plan.id === formData.plan;
          const isAnnual = plan.billingInterval === ANNUAL;
          const priceAfterDiscount = utils.getReservedPriceCents({
            plan,
            reserved: formData.reserved,
            addOns: formData.addOns,
          });
          const formattedPriceAfterDiscount = formatPrice({
            cents: priceAfterDiscount,
          });

          const priceBeforeDiscount = isAnnual ? previousPlanPrice * 12 : 0;
          const formattedPriceBeforeDiscount = previousPlanPrice
            ? formatPrice({cents: priceBeforeDiscount})
            : '';
          // oxlint-disable-next-line react/immutability
          previousPlanPrice = priceAfterDiscount;
          const intervalName = isAnnual ? t('Yearly') : t('Monthly');
          const isPartnerMigration = !!subscription.partner?.partnership.id;
          const isCotermUpgrade =
            priceAfterDiscount >= subscription.planDetails.totalPrice;
          const isCurrentUsageCycle =
            subscription.billingInterval === plan.billingInterval;
          const shouldApplyToExistingPeriod =
            isCotermUpgrade &&
            isCurrentUsageCycle &&
            !isDeveloperPlan(subscription.planDetails);
          const today = moment();
          const contractStartDate =
            !shouldApplyToExistingPeriod && isCotermUpgrade
              ? today
              : moment(subscription.billingPeriodEnd).add(1, 'day');
          let cycleInfo: ReactNode;
          if (isPartnerMigration) {
            cycleInfo = isAnnual
              ? t('Billed annually from your selected start date on submission')
              : t('Billed monthly starting on your selected start date on submission');
          } else if (isAnnual) {
            cycleInfo = t('Billed annually');
          } else {
            cycleInfo = tct('Billed on the [day] of each month', {
              day: contractStartDate.format('Do'),
            });
          }
          const additionalInfo = isAnnual
            ? tct('[budgetTerm] usage billed monthly, discount does not apply', {
                budgetTerm:
                  plan.budgetTerm === 'pay-as-you-go'
                    ? displayBudgetName(plan, {abbreviated: true})
                    : displayBudgetName(plan, {title: true}),
              })
            : t('Cancel anytime');

          return (
            <ToggleCard
              key={plan.id}
              variant="radio"
              name="checkout-billing-cycle"
              value={plan.id}
              checked={isSelected}
              onChange={() => onUpdate({plan: plan.id})}
              data-test-id={`billing-cycle-option-${plan.billingInterval}`}
              aria-label={t('%s billing cycle', intervalName)}
            >
              <Flex align="start" gap="md">
                <ToggleCard.Indicator />
                <Stack gap="sm" flexGrow={1}>
                  <Flex justify="between" align="center">
                    <Flex align="center" gap="sm">
                      <Heading as="h3" variant="primary">
                        {intervalName}
                      </Heading>
                      {isAnnual && <Tag variant="promotion">{t('save 10%')}</Tag>}
                    </Flex>
                    <Flex align="center" gap="xs">
                      {formattedPriceBeforeDiscount && (
                        <Text variant="muted" strikethrough size="lg">
                          {`$${formattedPriceBeforeDiscount}`}
                        </Text>
                      )}
                      <Text size="lg" bold variant="primary">
                        {`$${formattedPriceAfterDiscount}`}
                      </Text>
                    </Flex>
                  </Flex>
                  <Text variant="muted" size="md" textWrap="pretty">
                    {cycleInfo}. {additionalInfo}
                  </Text>
                </Stack>
              </Flex>
            </ToggleCard>
          );
        })}
      </Grid>
    </Stack>
  );
}
