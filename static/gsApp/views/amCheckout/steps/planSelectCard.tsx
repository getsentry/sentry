import {cloneElement, isValidElement} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Radio} from 'sentry/components/core/radio';
import type {SVGIconProps} from 'sentry/icons/svgIcon';

import {PAYG_BUSINESS_DEFAULT, PAYG_TEAM_DEFAULT} from 'getsentry/constants';
import {OnDemandBudgetMode} from 'getsentry/types';
import {isBizPlanFamily} from 'getsentry/utils/billing';
import type {PlanSelectRowProps} from 'getsentry/views/amCheckout/steps/planSelectRow';
import type {CheckoutFormData} from 'getsentry/views/amCheckout/types';
import {getShortInterval} from 'getsentry/views/amCheckout/utils';

interface PlanSelectCardProps
  extends Omit<
    PlanSelectRowProps,
    | 'isFeaturesCheckmarked'
    | 'discountInfo'
    | 'planWarning'
    | 'priceHeader'
    | 'shouldShowEventPrice'
  > {
  /**
   * Icon to use for the plan
   */
  planIcon: React.ReactNode;
}

function PlanSelectCard({
  plan,
  isSelected,
  onUpdate,
  planName,
  planContent,
  price,
  badge,
  shouldShowDefaultPayAsYouGo,
  planIcon,
}: PlanSelectCardProps) {
  const billingInterval = getShortInterval(plan.billingInterval);
  const {description} = planContent;

  const onPlanSelect = () => {
    const data: Partial<CheckoutFormData> = {plan: plan.id};
    if (shouldShowDefaultPayAsYouGo) {
      data.onDemandMaxSpend = isBizPlanFamily(plan)
        ? PAYG_BUSINESS_DEFAULT
        : PAYG_TEAM_DEFAULT;
      data.onDemandBudget = {
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: data.onDemandMaxSpend,
      };
    }
    onUpdate(data);
  };

  const adjustedPlanIcon = isValidElement(planIcon)
    ? cloneElement(planIcon, {size: 'md'} as SVGIconProps)
    : planIcon;

  return (
    <PlanOption
      data-test-id={`plan-option-${plan.id}`}
      isSelected={isSelected}
      onClick={onPlanSelect}
      direction="column"
      gap="md"
      padding="2xl"
    >
      <Flex align="center" justify="between" gap="md">
        <Flex align="center" gap={'sm'}>
          {adjustedPlanIcon}
          <Heading as="h3" variant={isSelected ? 'accent' : 'primary'}>
            {planName}
          </Heading>
        </Flex>
        {badge}
      </Flex>
      <div>
        <Text size="md" variant={isSelected ? 'accent' : 'muted'}>
          {description}
        </Text>
      </div>
      <div>
        <Price>{`$${price}`}</Price>
        <BillingInterval>{`/${billingInterval}`}</BillingInterval>
      </div>
    </PlanOption>
  );
}

export default PlanSelectCard;

const PlanOption = styled(Flex)<{isSelected?: boolean}>`
  background: ${p => p.theme.background};
  color: ${p => (p.isSelected ? p.theme.activeText : p.theme.textColor)};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => (p.isSelected ? p.theme.purple400 : p.theme.border)};
  border-bottom: 3px solid ${p => (p.isSelected ? p.theme.purple400 : p.theme.border)};
  cursor: pointer;
`;

const Price = styled('span')`
  font-size: ${p => p.theme.fontSize['2xl']};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const BillingInterval = styled('span')`
  font-size: ${p => p.theme.fontSize.lg};
`;

const StyledRadio = styled(Radio)`
  background: ${p => p.theme.background};
`;
