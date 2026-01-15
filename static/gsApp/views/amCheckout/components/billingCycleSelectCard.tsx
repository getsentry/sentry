import type {ReactNode} from 'react';
import moment from 'moment-timezone';

import {Tag} from 'sentry/components/core/badge/tag';
import {Container, Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {t, tct} from 'sentry/locale';

import {ANNUAL} from 'getsentry/constants';
import type {Plan, Subscription} from 'getsentry/types';
import {displayBudgetName, isDeveloperPlan} from 'getsentry/utils/billing';
import CheckoutOption from 'getsentry/views/amCheckout/components/checkoutOption';
import type {CheckoutFormData} from 'getsentry/views/amCheckout/types';

type BillingCycleSelectCardProps = {
  formattedPriceAfterDiscount: string;
  formattedPriceBeforeDiscount: string;
  isSelected: boolean;
  onUpdate: (data: Partial<CheckoutFormData>) => void;
  plan: Plan;
  priceAfterDiscount: number;
  subscription: Subscription;
};

function BillingCycleSelectCard({
  subscription,
  isSelected,
  plan,
  onUpdate,
  formattedPriceAfterDiscount,
  priceAfterDiscount,
  formattedPriceBeforeDiscount,
}: BillingCycleSelectCardProps) {
  const isAnnual = plan.contractInterval === ANNUAL;
  const intervalName = isAnnual ? t('Yearly') : t('Monthly');
  const isPartnerMigration = !!subscription.partner?.partnership.id;

  const isCotermUpgrade = priceAfterDiscount >= subscription.planDetails.totalPrice;
  const isCurrentUsageCycle = subscription.contractInterval === plan.contractInterval;
  // the billing day would only change for billing cycle changes or for any upgrade from developer plan
  const shouldApplyToExistingPeriod =
    isCotermUpgrade && isCurrentUsageCycle && !isDeveloperPlan(subscription.planDetails);
  const today = moment();
  const contractStartDate =
    !shouldApplyToExistingPeriod && isCotermUpgrade
      ? today
      : moment(subscription.contractPeriodEnd).add(1, 'day');

  const onCycleSelect = () => {
    const data: Partial<CheckoutFormData> = {
      plan: plan.id,
    };
    onUpdate(data);
  };

  let cycleInfo: ReactNode;
  if (isPartnerMigration) {
    if (isAnnual) {
      cycleInfo = t('Billed annually from your selected start date on submission');
    } else {
      cycleInfo = t('Billed monthly starting on your selected start date on submission');
    }
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
    <CheckoutOption
      dataTestId={`billing-cycle-option-${plan.contractInterval}`}
      isSelected={isSelected}
      onClick={onCycleSelect}
      ariaLabel={t('%s billing cycle', intervalName)}
      ariaRole="radio"
      optionHeader={
        <Flex justify="between" align="center" flexGrow={1}>
          <Flex align="center" gap="sm">
            <Heading as="h3" variant="primary">
              {intervalName}
            </Heading>
            {isAnnual && <Tag variant="promotion">{t('save 10%')}</Tag>}
          </Flex>
          <Flex align="center" gap="xs">
            {formattedPriceBeforeDiscount && (
              <Text
                variant="muted"
                strikethrough
                size="lg"
              >{`$${formattedPriceBeforeDiscount}`}</Text>
            )}
            <Text
              size="lg"
              bold
              variant="primary"
            >{`$${formattedPriceAfterDiscount}`}</Text>
          </Flex>
        </Flex>
      }
      optionDescription={
        <Container>
          <Text variant="muted" size="md" textWrap="pretty">
            {cycleInfo}. {additionalInfo}
          </Text>
        </Container>
      }
    />
  );
}

export default BillingCycleSelectCard;
