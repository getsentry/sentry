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
  planValue,
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
      <Row>
        <PlanIconContainer>
          {adjustedPlanIcon}
          {badge}
        </PlanIconContainer>
        <StyledRadio
          readOnly
          id={plan.id}
          aria-label={`${planName} plan`}
          value={planValue}
          checked={isSelected}
          onClick={onPlanSelect}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              onPlanSelect();
            }
          }}
        />
      </Row>
      <div>
        <Title>{planName}</Title>
        <Description isSelected={isSelected}>{description}</Description>
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
  background: ${p => (p.isSelected ? `${p.theme.active}05` : p.theme.background)};
  color: ${p => (p.isSelected ? p.theme.activeText : p.theme.textColor)};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => (p.isSelected ? p.theme.active : p.theme.border)};
  cursor: pointer;
`;

const Row = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const PlanIconContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
`;

const Title = styled('div')`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const Description = styled('div')<{isSelected?: boolean}>`
  color: ${p => (p.isSelected ? p.theme.activeText : p.theme.subText)};
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
