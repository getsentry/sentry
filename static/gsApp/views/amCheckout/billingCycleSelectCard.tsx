import type {ReactNode} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Tag} from 'sentry/components/core/badge/tag';
import {Flex} from 'sentry/components/core/layout';
import {Radio} from 'sentry/components/core/radio';
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
      justify="between"
      align="start"
      padding="xl"
      onClick={onCycleSelect}
    >
      <div>
        <Flex align="center" gap="sm">
          <BillingInterval>{intervalName}</BillingInterval>
          {isAnnual && <Tag type="success">{t('save 10%')}</Tag>}
        </Flex>
        <Flex align="center" gap="sm">
          {formattedPriceBeforeDiscount && (
            <PriceBeforeDiscount>{`$${formattedPriceBeforeDiscount}`}</PriceBeforeDiscount>
          )}
          <Price>{`$${formattedPriceAfterDiscount}`}</Price>
        </Flex>
        <Description>{cycleInfo}</Description>
        <Description>{additionalInfo}</Description>
      </div>
      <StyledRadio
        readOnly
        id={plan.contractInterval}
        name="billing-cycle"
        aria-label={`${intervalName} billing cycle`}
        value={plan.contractInterval}
        checked={isSelected}
        onClick={onCycleSelect}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            onCycleSelect();
          }
        }}
      />
    </BillingCycleOption>
  );
}

export default BillingCycleSelectCard;

const BillingCycleOption = styled(Flex)<{isSelected: boolean}>`
  background: ${p => (p.isSelected ? `${p.theme.active}05` : p.theme.background)};
  color: ${p => (p.isSelected ? p.theme.activeText : p.theme.textColor)};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => (p.isSelected ? p.theme.active : p.theme.border)};
  cursor: pointer;
`;

const BillingInterval = styled('div')`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const Price = styled('div')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const PriceBeforeDiscount = styled(Price)`
  text-decoration: line-through;
  color: ${p => p.theme.subText};
`;

const Description = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;

const StyledRadio = styled(Radio)`
  background: ${p => p.theme.background};
`;
