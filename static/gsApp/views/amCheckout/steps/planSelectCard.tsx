import {cloneElement, isValidElement, useMemo} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Radio} from 'sentry/components/core/radio';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconInfo} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import oxfordizeArray from 'sentry/utils/oxfordizeArray';

import {PAYG_BUSINESS_DEFAULT, PAYG_TEAM_DEFAULT} from 'getsentry/constants';
import {OnDemandBudgetMode, type Plan} from 'getsentry/types';
import {isBizPlanFamily} from 'getsentry/utils/billing';
import {getSingularCategoryName, listDisplayNames} from 'getsentry/utils/dataCategory';
import type {PlanSelectRowProps} from 'getsentry/views/amCheckout/steps/planSelectRow';
import type {CheckoutFormData} from 'getsentry/views/amCheckout/types';
import {displayUnitPrice, getShortInterval} from 'getsentry/views/amCheckout/utils';

interface PlanSelectCardProps
  extends Omit<
    PlanSelectRowProps,
    'isFeaturesCheckmarked' | 'discountInfo' | 'planWarning' | 'priceHeader'
  > {
  /**
   * Icon to use for the plan
   */
  planIcon: React.ReactNode;
  /**
   * Prior plan to compare against (ie. prior plan for Business is Team)
   */
  priorPlan?: Plan;
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
  shouldShowEventPrice,
  priorPlan,
}: PlanSelectCardProps) {
  const billingInterval = getShortInterval(plan.billingInterval);
  const {description} = planContent;

  const perUnitPriceDiffs: Partial<Record<DataCategory, number>> = useMemo(() => {
    if (!shouldShowEventPrice || !priorPlan) {
      return {};
    }

    return Object.entries(plan.planCategories).reduce(
      (acc, [category, eventBuckets]) => {
        const priorPlanEventBuckets = priorPlan.planCategories[category as DataCategory];
        const currentStartingPrice = eventBuckets[1]?.onDemandPrice ?? 0;
        const priorStartingPrice = priorPlanEventBuckets?.[1]?.onDemandPrice ?? 0;
        const perUnitPriceDiff = currentStartingPrice - priorStartingPrice;
        if (perUnitPriceDiff > 0) {
          acc[category as DataCategory] = perUnitPriceDiff;
        }
        return acc;
      },
      {} as Partial<Record<DataCategory, number>>
    );
  }, [shouldShowEventPrice, priorPlan, plan]);

  const showEventPriceWarning = useMemo(
    () => Object.values(perUnitPriceDiffs).length > 0,
    [perUnitPriceDiffs]
  );

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
      {showEventPriceWarning && (
        <EventPriceWarning>
          <IconInfo size="xs" />
          <Tooltip
            title={tct('Starting at [priceDiffs].', {
              priceDiffs: oxfordizeArray(
                Object.entries(perUnitPriceDiffs).map(([category, diff]) => {
                  const formattedDiff = displayUnitPrice({cents: diff});
                  const formattedCategory = getSingularCategoryName({
                    plan,
                    category: category as DataCategory,
                    capitalize: false,
                  });
                  return `+${formattedDiff} / ${formattedCategory}`;
                })
              ),
            })}
          >
            {/* TODO(checkout v3): verify tooltip copy */}
            {tct('Excess usage for [categories] costs more on [planName]', {
              categories: listDisplayNames({
                plan,
                categories: Object.keys(perUnitPriceDiffs) as DataCategory[],
                shouldTitleCase: true,
              }),
              planName,
            })}
          </Tooltip>
        </EventPriceWarning>
      )}
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

const Warning = styled('div')`
  display: flex;
  align-items: flex-start;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  gap: ${p => p.theme.space.md};
  margin-top: auto;
  line-height: normal;

  > svg {
    margin-top: ${p => p.theme.space['2xs']};
  }
`;

const EventPriceWarning = styled(Warning)`
  > span {
    text-decoration: underline dotted;
    line-height: normal;
  }
`;
