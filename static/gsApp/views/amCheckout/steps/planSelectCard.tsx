import {cloneElement, isValidElement} from 'react';
import styled from '@emotion/styled';

import {Container, Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
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
      padding="xl"
    >
      <Flex align="start" justify="between" gap="md">
        <Container paddingTop="sm">
          <RadioMarker isSelected={isSelected} />
        </Container>

        <Flex direction="column" gap="sm" width="100%">
          <Flex align="center" justify="between" gap="sm">
            <Flex align="center" gap="sm">
              <Heading as="h3" variant={isSelected ? 'accent' : 'primary'}>
                {planName}
              </Heading>
              {badge}
            </Flex>
            <IconContainer isSelected={isSelected}>{adjustedPlanIcon}</IconContainer>
          </Flex>
          <Text size="md" variant={isSelected ? 'accent' : 'muted'}>
            {description}
          </Text>
          <Container>
            <Price>{`$${price}`}</Price>
            <BillingInterval>{`/${billingInterval}`}</BillingInterval>
          </Container>
        </Flex>
      </Flex>
    </PlanOption>
  );
}

export default PlanSelectCard;

const PlanOption = styled(Flex)<{isSelected?: boolean}>`
  background: ${p => p.theme.background};
  color: ${p => (p.isSelected ? p.theme.tokens.content.accent : p.theme.textColor)};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid
    ${p => (p.isSelected ? p.theme.tokens.graphics.accent : p.theme.border)};
  border-bottom: 3px solid
    ${p => (p.isSelected ? p.theme.tokens.graphics.accent : p.theme.border)};
  cursor: pointer;
`;

const Price = styled('span')`
  font-size: ${p => p.theme.fontSize['2xl']};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const BillingInterval = styled('span')`
  font-size: ${p => p.theme.fontSize.lg};
`;

const IconContainer = styled('div')<{isSelected?: boolean}>`
  display: flex;
  background: ${p =>
    p.isSelected ? p.theme.tokens.graphics.accent : p.theme.background};
  border: 1px solid ${p => (p.isSelected ? p.theme.tokens.border.accent : p.theme.border)};
  border-radius: ${p => p.theme.space.xs};
  padding: ${p => p.theme.space.xs};
  color: ${p => (p.isSelected ? p.theme.background : p.theme.textColor)};
`;

const RadioMarker = styled('div')<{isSelected?: boolean}>`
  width: ${p => p.theme.space.xl};
  height: ${p => p.theme.space.xl};
  border-radius: ${p => p.theme.space['3xl']};
  background: ${p => p.theme.background};
  border-color: ${p => (p.isSelected ? p.theme.tokens.border.accent : p.theme.border)};
  border-width: ${p => (p.isSelected ? '4px' : '1px')};
  border-style: solid;
`;
