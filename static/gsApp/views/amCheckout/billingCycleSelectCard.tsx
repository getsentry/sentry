import type {ReactNode} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Tag} from 'sentry/components/core/badge/tag';
import {Container, Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {t, tct} from 'sentry/locale';

import {ANNUAL} from 'getsentry/constants';
import type {Plan, Subscription} from 'getsentry/types';
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
  const today = moment();
  const contractStartDate = isCotermUpgrade
    ? today
    : moment(subscription.contractPeriodEnd).add(1, 'day');

  const onCycleSelect = () => {
    const data: Partial<CheckoutFormData> = {
      plan: plan.id,
    };
    onUpdate(data);
  };

  // TODO(checkout v3): confirm copy
  let cycleInfo: ReactNode;
  if (isPartnerMigration) {
    if (isAnnual) {
      cycleInfo = t('Billed every 12 months from your selected start date on submission');
    } else {
      cycleInfo = t('Billed monthly starting on your selected start date on submission');
    }
  } else if (isAnnual) {
    cycleInfo = tct('Billed every 12 months on the [day] of [month]', {
      day: contractStartDate.format('Do'),
      month: contractStartDate.format('MMMM'),
    });
  } else {
    cycleInfo = tct('Billed monthly starting on [contractStartDate]', {
      contractStartDate: contractStartDate.format('MMMM DD'),
    });
  }

  const additionalInfo = isAnnual
    ? tct("Discount doesn't apply to [budgetTerm] usage", {
        budgetTerm: plan.budgetTerm,
      })
    : t('Cancel anytime');

  return (
    <BillingCycleOption
      data-test-id={`billing-cycle-option-${plan.contractInterval}`}
      isSelected={isSelected}
      onClick={onCycleSelect}
    >
      <Flex align="start" justify="between" gap="md" padding="xl">
        <Container paddingTop="2xs">
          <RadioMarker isSelected={isSelected} />
        </Container>
        <Flex direction="column" gap="sm" width="100%">
          <Flex align="center" gap="sm">
            <Heading as="h3" variant="primary">
              {intervalName}
            </Heading>
            {isAnnual && <Tag type="promotion">{t('save 10%')}</Tag>}
          </Flex>
          <Flex align="center" gap="md">
            {formattedPriceBeforeDiscount && (
              <Text
                variant={'muted'}
                strikethrough
                size="2xl"
              >{`$${formattedPriceBeforeDiscount}`}</Text>
            )}
            <Text
              size="2xl"
              bold
              variant="primary"
            >{`$${formattedPriceAfterDiscount}`}</Text>
          </Flex>
          <Flex direction="column" gap="xs" paddingTop="xs">
            <Text variant="muted">{cycleInfo}</Text>
            <Text variant="muted">{additionalInfo}</Text>
          </Flex>
        </Flex>
      </Flex>
    </BillingCycleOption>
  );
}

export default BillingCycleSelectCard;

const BillingCycleOption = styled('div')<{isSelected: boolean}>`
  width: 100%;
  color: ${p => p.theme.textColor};
  cursor: pointer;
  position: relative;

  &:before,
  &:after {
    content: '';
    display: block;
    position: absolute;
    inset: 0;
  }

  &::before {
    height: calc(100% - ${p => p.theme.space['2xs']});
    top: ${p => p.theme.space['2xs']};
    transform: translateY(-${p => p.theme.space['2xs']});
    box-shadow: 0 ${p => p.theme.space['2xs']} 0 0px
      ${p => (p.isSelected ? p.theme.tokens.graphics.accent : p.theme.border)};
    background: ${p => (p.isSelected ? p.theme.tokens.graphics.accent : p.theme.border)};
    border-radius: ${p => p.theme.borderRadius};
  }

  &::after {
    background: ${p => p.theme.background};
    border-radius: ${p => p.theme.borderRadius};
    border: 1px solid
      ${p => (p.isSelected ? p.theme.tokens.graphics.accent : p.theme.border)};
    transform: ${p =>
      p.isSelected ? 'translateY(0)' : `translateY(-${p.theme.space['2xs']})`};
    transition: transform 0.06s ease-in;
  }

  > * {
    z-index: 1;
    position: relative;
    transform: ${p =>
      p.isSelected ? 'translateY(0)' : `translateY(-${p.theme.space['2xs']})`};
    transition: transform 0.06s ease-in;
  }

  &:hover {
    &::after,
    > * {
      transform: ${p =>
        p.isSelected
          ? 'translateY(0)'
          : `translateY(calc(-${p.theme.space['2xs']} - 2px))`};
    }
  }

  &:active,
  &[aria-expanded='true'],
  &[aria-checked='true'] {
    &::after,
    > * {
      transform: translateY(0);
    }
  }

  &:disabled,
  &[aria-disabled='true'] {
    &::after,
    > * {
      transform: translateY(0px);
    }
  }
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
