import styled from '@emotion/styled';

import {Container, Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';

import {PAYG_BUSINESS_DEFAULT, PAYG_TEAM_DEFAULT} from 'getsentry/constants';
import {OnDemandBudgetMode, type Plan} from 'getsentry/types';
import {isBizPlanFamily} from 'getsentry/utils/billing';
import CheckoutOption from 'getsentry/views/amCheckout/components/checkoutOption';
import type {CheckoutFormData, PlanContent} from 'getsentry/views/amCheckout/types';
import {getShortInterval} from 'getsentry/views/amCheckout/utils';

interface PlanSelectCardProps {
  isSelected: boolean;
  onUpdate: (data: Partial<CheckoutFormData>) => void;
  plan: Plan;
  planContent: PlanContent;
  planName: string;
  planValue: string;
  price: string;
  /**
   * Flag to show default pay as you go values
   */
  shouldShowDefaultPayAsYouGo: boolean;
  badge?: React.ReactNode;
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

  return (
    <CheckoutOption
      dataTestId={`plan-option-${plan.id}`}
      ariaLabel={planName}
      isSelected={isSelected}
      onClick={onPlanSelect}
      ariaRole="radio"
    >
      <Flex align="start" justify="between" gap="md" padding="xl">
        <Container paddingTop="2xs">
          <RadioMarker isSelected={isSelected} />
        </Container>

        <Flex direction="column" gap="sm" width="100%">
          <Flex align="center" justify="between" gap="sm">
            <Flex align="center" gap="sm">
              <Heading as="h3" variant="primary">
                {planName}
              </Heading>
              {badge}
            </Flex>

            <Flex>
              <Text size="lg" bold>
                {`$${price}`}
              </Text>
              <Text size="lg" variant="muted">
                {`/${billingInterval}`}
              </Text>
            </Flex>
          </Flex>
          <Text size="md" variant="muted" textWrap="balance">
            {description}
          </Text>
        </Flex>
      </Flex>
    </CheckoutOption>
  );
}

export default PlanSelectCard;

const RadioMarker = styled('div')<{isSelected?: boolean}>`
  width: ${p => p.theme.space.xl};
  height: ${p => p.theme.space.xl};
  border-radius: ${p => p.theme.space['3xl']};
  background: ${p => p.theme.tokens.background.primary};
  border-color: ${p => (p.isSelected ? p.theme.tokens.border.accent : p.theme.border)};
  border-width: ${p => (p.isSelected ? '4px' : '1px')};
  border-style: solid;
`;
